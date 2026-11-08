// Kernighan–Lin / Fiduccia–Mattheyses graph partitioning for the table split, then seat order.
//
// Stage one works on the table-level problem (everyone at a table counts equally). Guests who must
// sit together (must-sit-next-to or same-table, chained) merge into one node that always moves as a
// unit. A pass moves the best unlocked node to another table, locks it, and repeats, letting tables
// run a few seats over capacity mid-pass; then it rolls back to the best prefix that fits. Passes
// repeat until one stops helping. That local optimum gets kicked (a few random swaps) and refined
// again (iterated KL), with fresh random splits when kicks stop paying off.
// Stage two arranges seats one table at a time. Once the split is fixed, tables don't affect each
// other's scores, so each table gets many short annealing runs from scratch and keeps its best; the
// best arrangements of every table combine into the best seating. Best-of-many short runs beats one
// long run here because a single run's result varies far more than longer runs improve it.

import { AlgorithmPlugin, Moves, num, Params, SeatOrderAnnealer, Solver, SolverProgress } from '../core'
import { Problem, tableLevelProblem } from '../problem'
import { mulberry32, randInt, Rng } from '../random'
import { Scorer } from '../scorer'

const EPS = 1e-9

/**
 * The table split as nodes on tables, scored exactly like the table-level problem. Gains are exact
 * (fairness floors and acquaintance counts included), each costing one O(n) pass ≈ one swap evaluation.
 */
export class TableSplit {
  readonly n: number
  readonly T: number
  readonly members: Int32Array[] // Per node: its guests
  readonly size: Int32Array
  readonly heads: Int32Array // Per node: must-be-at-a-head guests not already locked in place
  readonly fixed: Int32Array // Per node: the table a locked seat pins it to, or -1
  readonly free: Int32Array // Nodes that can move
  readonly nodeOf: Int32Array // Per guest
  readonly cap: Int32Array // Per table: guests it can hold
  readonly headCap: Int32Array // Per table: head seats not locked
  readonly maxSize: number
  private readonly AX: Float64Array // nodes × n: each node's total affinity with every guest
  private readonly NA: Float64Array // nodes × nodes: total affinity between two nodes
  private readonly inner: Float64Array // Per node: affinity among its own members, both directions
  private readonly W: Float64Array // nodes × T: each node's total affinity with each table
  private readonly KX: Int32Array // nodes × n: each node's members a guest knows (only with minKnownAtTable)
  private readonly apart: number[][] // Per node: nodes it must not share a table with (once per constraint)
  private readonly countKnown: boolean
  private readonly penalty: number
  readonly table: Int32Array // Per node
  readonly cnt: Int32Array // Per table: guests seated there
  readonly headCnt: Int32Array
  private readonly w: Float64Array // n × T: each guest's affinity with everyone at each table
  private readonly kn: Int32Array // n × T: acquaintances at each table
  private readonly scorer: Scorer // Only for its utility function
  total = 0
  internalPenalty = 0 // Different-table rules inside one node, which no split can satisfy

  constructor(readonly p: Problem, tableScorer: Scorer, guestAt: Int32Array, locked: Uint8Array) {
    const { n, S, tableOf, layout, pairs, mustHead, isHead, A } = p
    const T = layout.tables
    this.n = n
    this.T = T
    this.scorer = tableScorer
    this.countKnown = p.objective.minKnownAtTable > 0
    this.penalty = p.objective.constraintPenalty

    // Locked guests pin their table
    const pin = new Int32Array(n).fill(-1)
    const cap = new Int32Array(T)
    const headCap = new Int32Array(T)
    for (let s = 0; s < S; s++) {
      const t = tableOf[s]
      const g = guestAt[s]
      if (locked[s] && g < n) pin[g] = t
      if (!locked[s] || g < n) cap[t]++
      if (isHead[s] && !locked[s]) headCap[t]++
    }
    this.cap = cap
    this.headCap = headCap

    // Union-find over keep-together rules, never merging guests pinned to different tables
    const parent = Int32Array.from({ length: n }, (_, i) => i)
    const pinOf = Int32Array.from(pin)
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    for (const c of pairs) {
      if (c.kind !== 'SAME_TABLE' && c.kind !== 'ADJACENT' && c.kind !== 'NEAR') continue
      const a = find(c.x)
      const b = find(c.y)
      if (a === b || (pinOf[a] >= 0 && pinOf[b] >= 0 && pinOf[a] !== pinOf[b])) continue
      parent[b] = a
      if (pinOf[a] < 0) pinOf[a] = pinOf[b]
    }
    const groups = new Map<number, number[]>()
    for (let g = 0; g < n; g++) {
      const r = find(g)
      if (!groups.has(r)) groups.set(r, [])
      groups.get(r)!.push(g)
    }
    const list = [...groups.entries()]
    const N = list.length
    this.members = list.map(([, m]) => Int32Array.from(m))
    this.size = Int32Array.from(this.members, (m) => m.length)
    this.heads = Int32Array.from(this.members, (m) => m.reduce((sum, g) => sum + (pin[g] < 0 ? mustHead[g] : 0), 0))
    this.fixed = Int32Array.from(list, ([r]) => pinOf[r])
    this.free = Int32Array.from(list.flatMap((_, i) => (this.fixed[i] < 0 ? [i] : [])))
    this.maxSize = Math.max(1, ...this.size)
    this.nodeOf = new Int32Array(n)
    this.members.forEach((m, i) => m.forEach((g) => (this.nodeOf[g] = i)))

    this.AX = new Float64Array(N * n)
    this.KX = new Int32Array(N * n)
    for (let i = 0; i < N; i++) {
      for (const x of this.members[i]) {
        for (let k = 0; k < n; k++) {
          const a = A[k * n + x]
          this.AX[i * n + k] += a
          if (a >= 1 && k !== x) this.KX[i * n + k]++
        }
      }
    }
    this.NA = new Float64Array(N * N)
    this.inner = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) for (const y of this.members[j]) this.NA[i * N + j] += this.AX[i * n + y]
      this.inner[i] = this.NA[i * N + i]
    }
    this.W = new Float64Array(N * T)
    this.apart = Array.from({ length: N }, () => [])
    for (const c of pairs) {
      if (c.kind !== 'DIFFERENT_TABLE') continue
      const a = this.nodeOf[c.x]
      const b = this.nodeOf[c.y]
      if (a === b) this.internalPenalty += this.penalty
      else {
        this.apart[a].push(b)
        this.apart[b].push(a)
      }
    }

    this.table = new Int32Array(N)
    this.cnt = new Int32Array(T)
    this.headCnt = new Int32Array(T)
    this.w = new Float64Array(n * T)
    this.kn = new Int32Array(n * T)
  }

  get nodes() {
    return this.members.length
  }

  // Puts every node on the given tables and rebuilds all the sums
  load(table: ArrayLike<number>) {
    const { n, T } = this
    this.table.set(table)
    for (let i = 0; i < this.nodes; i++) if (this.fixed[i] >= 0) this.table[i] = this.fixed[i]
    this.cnt.fill(0)
    this.headCnt.fill(0)
    this.w.fill(0)
    this.kn.fill(0)
    this.W.fill(0)
    const N = this.nodes
    for (let i = 0; i < N; i++) {
      const t = this.table[i]
      for (let j = 0; j < N; j++) this.W[j * T + t] += this.NA[j * N + i]
      this.cnt[t] += this.size[i]
      this.headCnt[t] += this.heads[i]
      for (let k = 0; k < n; k++) {
        this.w[k * T + t] += this.AX[i * n + k]
        this.kn[k * T + t] += this.KX[i * n + k]
      }
    }
    let total = 0
    for (let g = 0; g < n; g++) {
      const t = this.table[this.nodeOf[g]]
      total += this.scorer.utility(g, this.w[g * T + t], this.kn[g * T + t], 0)
    }
    let broken = 0
    for (let i = 0; i < this.nodes; i++) for (const j of this.apart[i]) if (this.table[i] === this.table[j]) broken++
    this.total = total - this.penalty * (broken / 2) - this.internalPenalty
  }

  // The split from a seating: each node goes where most of its guests sit
  fromSeating(guestAt: Int32Array): Int32Array {
    const { p, T } = this
    const votes = new Int32Array(this.nodes * T)
    for (let s = 0; s < p.S; s++) if (guestAt[s] < p.n) votes[this.nodeOf[guestAt[s]] * T + p.tableOf[s]]++
    return Int32Array.from({ length: this.nodes }, (_, i) => {
      let best = 0
      for (let t = 1; t < T; t++) if (votes[i * T + t] > votes[i * T + best]) best = t
      return best
    })
  }

  // A random split that fits if it can: biggest nodes first, each onto a random table with room
  random(rng: Rng): Int32Array {
    const { T } = this
    const table = new Int32Array(this.nodes)
    const cnt = new Int32Array(T)
    const headCnt = new Int32Array(T)
    for (let i = 0; i < this.nodes; i++) {
      if (this.fixed[i] < 0) continue
      table[i] = this.fixed[i]
      cnt[table[i]] += this.size[i]
      headCnt[table[i]] += this.heads[i]
    }
    const order = Array.from(this.free).map((i) => ({ i, key: this.size[i] + rng() }))
    order.sort((x, y) => y.key - x.key)
    const room: number[] = []
    for (const { i } of order) {
      room.length = 0
      for (let t = 0; t < T; t++) if (cnt[t] + this.size[i] <= this.cap[t] && headCnt[t] + this.heads[i] <= this.headCap[t]) room.push(t)
      let t = room.length > 0 ? room[randInt(rng, room.length)] : 0
      if (room.length === 0) for (let u = 1; u < T; u++) if (this.cap[u] - cnt[u] > this.cap[t] - cnt[t]) t = u
      table[i] = t
      cnt[t] += this.size[i]
      headCnt[t] += this.heads[i]
    }
    return table
  }

  fits(): boolean {
    for (let t = 0; t < this.T; t++) if (this.cnt[t] > this.cap[t] || this.headCnt[t] > this.headCap[t]) return false
    return true
  }

  // Exact change in the table-level score if node i moved to table b
  gain(i: number, b: number): number {
    const { n, T, AX, KX, w, kn, scorer } = this
    const a = this.table[i]
    const row = i * n
    const mine = this.members[i]
    let delta = 0
    for (let k = 0; k < n; k++) {
      const ax = AX[row + k]
      const kx = KX[row + k]
      if (ax === 0 && kx === 0) continue
      const t = this.table[this.nodeOf[k]]
      if (this.nodeOf[k] === i) {
        // A member: leaves table a's sums, joins table b's along with the rest of the node
        const h = w[k * T + a]
        const known = kn[k * T + a]
        delta += scorer.utility(k, w[k * T + b] + ax, kn[k * T + b] + kx, 0) - scorer.utility(k, h, known, 0)
        continue
      }
      if (t !== a && t !== b) continue // Only sums at the two tables change
      const sign = t === a ? -1 : 1
      const h = w[k * T + t]
      const known = kn[k * T + t]
      delta += scorer.utility(k, h + sign * ax, this.countKnown ? known + sign * kx : known, 0) - scorer.utility(k, h, known, 0)
    }
    // Members with no ties at all still count once
    for (const x of mine) {
      if (AX[row + x] !== 0 || KX[row + x] !== 0) continue
      delta += scorer.utility(x, w[x * T + b], kn[x * T + b], 0) - scorer.utility(x, w[x * T + a], kn[x * T + a], 0)
    }
    for (const j of this.apart[i]) {
      const t = this.table[j]
      if (t === a) delta += this.penalty
      else if (t === b) delta -= this.penalty
    }
    return delta
  }

  /**
   * The change in the table-level score if node i moved to table b, counting every affinity as if
   * happiness were linear (no fairness floor or acquaintance minimum). O(1) per node, so a pass can
   * rank every possible move cheaply and score only the one it picks exactly.
   */
  linearGain(i: number, b: number): number {
    const { T, W } = this
    const a = this.table[i]
    // Both ends of every tie count: leaving table a, joining table b, and the node's own ties come along
    let delta = 2 * (W[i * T + b] - W[i * T + a] + this.inner[i])
    for (const j of this.apart[i]) {
      const t = this.table[j]
      if (t === a) delta += this.penalty
      else if (t === b) delta -= this.penalty
    }
    return delta
  }

  move(i: number, b: number, delta: number) {
    const { n, T, AX, KX, w, kn, W, NA } = this
    const a = this.table[i]
    const row = i * n
    const N = this.nodes
    for (let j = 0; j < N; j++) {
      const v = NA[j * N + i]
      if (v === 0) continue
      W[j * T + a] -= v
      W[j * T + b] += v
    }
    for (let k = 0; k < n; k++) {
      const ax = AX[row + k]
      if (ax !== 0) {
        w[k * T + a] -= ax
        w[k * T + b] += ax
      }
      const kx = KX[row + k]
      if (kx !== 0) {
        kn[k * T + a] -= kx
        kn[k * T + b] += kx
      }
    }
    this.table[i] = b
    this.cnt[a] -= this.size[i]
    this.cnt[b] += this.size[i]
    this.headCnt[a] -= this.heads[i]
    this.headCnt[b] += this.heads[i]
    this.total += delta
  }

  /**
   * The seating for this split: head guests take their table's free head seats, everyone else fills
   * the free seats along each side in node order (so couples start out side by side), then empties.
   */
  seating(table: Int32Array, start: Int32Array, locked: Uint8Array, rng: Rng | null): Int32Array {
    const { p, n } = this
    const out = new Int32Array(p.S).fill(-1)
    const placed = new Uint8Array(p.S)
    for (let s = 0; s < p.S; s++) {
      if (!locked[s]) continue
      out[s] = start[s]
      placed[start[s]] = 1
    }
    const order = Array.from({ length: this.nodes }, (_, i) => i)
    if (rng) for (let i = order.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1)
      const t = order[i]
      order[i] = order[j]
      order[j] = t
    }
    for (let t = 0; t < this.T; t++) {
      const seats: number[] = []
      for (let s = 0; s < p.S; s++) if (p.tableOf[s] === t && !locked[s] && !p.isHead[s]) seats.push(s)
      seats.sort((x, y) => (p.seats[x].side === p.seats[y].side ? p.seats[x].index - p.seats[y].index : p.seats[x].side < p.seats[y].side ? -1 : 1))
      const headSeats: number[] = []
      for (let s = 0; s < p.S; s++) if (p.tableOf[s] === t && !locked[s] && p.isHead[s]) headSeats.push(s)
      const guests: number[] = []
      for (const i of order) if (table[i] === t) for (const g of this.members[i]) if (!placed[g]) guests.push(g)
      for (const g of guests) {
        const s = p.mustHead[g] && headSeats.length > 0 ? headSeats.shift() : seats.length > 0 ? seats.shift() : headSeats.shift()
        if (s === undefined) break // Too many for this table: they take leftover seats below
        out[s] = g
        placed[g] = 1
      }
    }
    // Empty seat tokens fill whatever is left; any guest that didn't fit (an infeasible split) goes there too
    const spare: number[] = []
    for (let tok = 0; tok < p.S; tok++) if (!placed[tok]) spare.push(tok)
    spare.sort((x, y) => (x < n ? 0 : 1) - (y < n ? 0 : 1) || x - y)
    for (let s = 0; s < p.S; s++) if (out[s] < 0) out[s] = spare.shift()!
    return out
  }
}

type RingMix = { couple: number; reverse: number }

type SeatRun = { step(budget: number): number; readonly done: boolean; readonly temperature: number; readonly bestScore: number; readonly bestAt: Int32Array }

/**
 * Anneals the seat order of one table with moves shaped like the table. Going around a table with
 * heads, each seat sits next to the one before it (head, one side, far head, other side back), so
 * the seats form a ring with "across" chords, and seating it is close to a traveling-salesman tour.
 * Besides plain swaps and SeatOrderAnnealer's couple moves, it reverses stretches of the ring
 * (2-opt), which keeps neighbors together while moving them. Each move costs the swaps it takes.
 * (Trading two short stretches and swapping facing pairs were tried too and didn't help.)
 */
export class TableAnnealer implements SeatRun {
  readonly bestAt: Int32Array
  bestScore: number
  temperature: number
  private used = 0
  private readonly ring: Int32Array // Seats in order around the table
  private readonly movable: Uint8Array
  private readonly swaps: Int32Array // The current move as seat pairs
  private count = 0

  constructor(
    private readonly scorer: Scorer,
    table: number,
    locked: Uint8Array,
    private readonly rng: Rng,
    private readonly iterations: number,
    private readonly t0: number,
    private readonly t1: number,
    private readonly mix: RingMix,
    private readonly maxStretch: number,
    private readonly moves: Moves // This table's seats only, for couple moves
  ) {
    const p = scorer.p
    const at = new Map<string, number>()
    for (let s = 0; s < p.S; s++) if (p.tableOf[s] === table) at.set(`${p.seats[s].side}${p.seats[s].index}`, s)
    const m = p.layout.seatsPerSide + 1 // Room for a squeezed side's extra seat
    const ring: number[] = []
    const push = (key: string) => at.has(key) && ring.push(at.get(key)!)
    push('HN-1')
    for (let i = 0; i < m; i++) push(`L${i}`)
    for (let i = m - 1; i <= m; i++) push(`HS${i}`)
    for (let i = m - 1; i >= 0; i--) push(`R${i}`)
    this.ring = Int32Array.from(ring)
    this.movable = Uint8Array.from({ length: p.S }, (_, s) => (locked[s] ? 0 : 1))
    this.swaps = new Int32Array(2 * ring.length + 8)
    this.temperature = t0
    this.bestAt = Int32Array.from(scorer.guestAt)
    this.bestScore = scorer.total
  }

  get done() {
    return this.used >= this.iterations
  }

  private add(a: number, b: number): boolean {
    if (!this.movable[a] || !this.movable[b]) return false
    this.swaps[2 * this.count] = a
    this.swaps[2 * this.count + 1] = b
    this.count++
    return true
  }

  // Fills `swaps` with a random move; false if it would touch a locked seat
  private propose(): boolean {
    const { ring, rng, mix } = this
    const L = ring.length
    this.count = 0
    let r = rng()
    if (r < mix.couple) {
      const blocks = this.moves.pickBlocks(rng, 'sameTable', this.scorer.seatOf)
      return !!blocks && this.add(blocks[0], blocks[1]) && this.add(blocks[2], blocks[3])
    }
    r -= mix.couple
    if (r < mix.reverse) {
      // Reverse a stretch of the ring, possibly wrapping past the start
      const len = 3 + randInt(rng, Math.max(1, Math.min(this.maxStretch, L) - 2))
      const start = randInt(rng, L)
      for (let i = 0; i < len >> 1; i++) if (!this.add(ring[(start + i) % L], ring[(start + len - 1 - i) % L])) return false
      return this.count > 0
    }
    const a = ring[randInt(rng, L)]
    const b = ring[randInt(rng, L)]
    return a !== b && this.add(a, b)
  }

  step(budget: number): number {
    const { scorer, rng, swaps } = this
    let spent = 0
    while (spent < budget && this.used < this.iterations) {
      const ok = this.propose()
      const cost = Math.max(1, this.count)
      spent += cost
      this.used += cost
      if (!ok) continue
      this.temperature = this.t0 * Math.pow(this.t1 / this.t0, this.used / this.iterations)
      let delta = 0
      for (let k = 0; k < this.count; k++) delta += scorer.applySwap(swaps[2 * k], swaps[2 * k + 1])
      if (delta >= 0 || rng() < Math.exp(delta / this.temperature)) {
        if (scorer.total > this.bestScore + 1e-9) {
          this.bestScore = scorer.total
          this.bestAt.set(scorer.guestAt)
        }
      } else {
        for (let k = this.count - 1; k >= 0; k--) scorer.applySwap(swaps[2 * k], swaps[2 * k + 1])
      }
      if ((this.used & 0xffff) < cost) scorer.recompute() // About every 65k swaps, against drift
    }
    return spent
  }
}

/**
 * Restarted annealing for each table on its own (SeatOrderAnnealer with every other table locked).
 * Each run starts from a shuffle of its table, with every other table at its best so far, so a run's
 * best is directly comparable with the best seating. Runs rotate over the tables, favoring tables
 * whose best hasn't been matched by `settleHits` runs yet.
 */
class TableByTableAnnealer {
  readonly bestAt: Int32Array
  bestScore: number
  temperature = 0
  runs = 0
  private run: SeatRun | null = null
  private runTable = -1
  private used = 0
  private readonly tables: number[] // Tables with at least two movable seats
  private readonly moves: Moves[] = []
  private readonly runsOf: Int32Array
  private readonly hits: Int32Array // Runs that reached this table's current best
  private readonly runLength: number

  constructor(
    private readonly scorer: Scorer,
    private readonly locked: Uint8Array,
    private readonly rng: Rng,
    private readonly iterations: number,
    runLength: number,
    private readonly t0: number,
    private readonly t1: number,
    private readonly blockMoveRate: number,
    private readonly settleHits: number,
    private readonly ringMoves: RingMix | null,
    private readonly maxStretch: number
  ) {
    const p = scorer.p
    const T = p.layout.tables
    this.tables = []
    for (let t = 0; t < T; t++) {
      const lock = Uint8Array.from({ length: p.S }, (_, s) => (locked[s] || p.tableOf[s] !== t ? 1 : 0))
      this.moves.push(new Moves(p, lock, 1))
      if (this.moves[t].movable.length >= 2) this.tables.push(t)
    }
    this.runsOf = new Int32Array(T)
    this.hits = new Int32Array(T)
    // Every table gets at least one run, and runs split the budget evenly
    const count = Math.max(this.tables.length, Math.round(iterations / Math.max(1, runLength)))
    this.runLength = Math.max(1, Math.floor(iterations / Math.max(1, count)))
    this.bestAt = Int32Array.from(scorer.guestAt)
    this.bestScore = scorer.total
  }

  get done() {
    return this.used >= this.iterations || this.tables.length === 0
  }

  get settled() {
    return this.tables.filter((t) => this.hits[t] >= this.settleHits).length
  }

  // Runs up to `budget` iterations and returns how many it ran
  step(budget: number): number {
    let spent = 0
    while (spent < budget && !this.done) {
      if (!this.run) this.startRun()
      const run = this.run!
      const used = run.step(Math.min(budget - spent, this.iterations - this.used))
      spent += used
      this.used += used
      this.temperature = run.temperature
      if (run.done || this.done) this.finishRun()
    }
    return spent
  }

  private startRun() {
    const unsettled = this.tables.filter((t) => this.hits[t] < this.settleHits)
    const pool = unsettled.length > 0 ? unsettled : this.tables
    let t = pool[0]
    for (const u of pool) if (this.runsOf[u] < this.runsOf[t]) t = u
    const fresh = Int32Array.from(this.bestAt)
    this.moves[t].shuffle(fresh, this.rng)
    this.scorer.load(fresh)
    this.run = this.ringMoves
      ? new TableAnnealer(this.scorer, t, this.locked, this.rng, this.runLength, this.t0, this.t1, this.ringMoves, this.maxStretch, this.moves[t])
      : new SeatOrderAnnealer(this.scorer, this.moves[t], this.rng, this.runLength, this.t0, this.t1, this.blockMoveRate)
    this.runTable = t
  }

  private finishRun() {
    const run = this.run!
    const t = this.runTable
    this.runs++
    this.runsOf[t]++
    if (run.bestScore > this.bestScore + 1e-6) {
      this.bestScore = run.bestScore
      this.bestAt.set(run.bestAt)
      this.hits[t] = 1
    } else if (run.bestScore > this.bestScore - 1e-6) {
      this.hits[t]++
    }
    this.run = null
  }
}

type Stage = 'table' | 'seat' | 'done'

class KernighanLinSolver implements Solver {
  private readonly p: Problem
  private readonly locked: Uint8Array
  private readonly start: Int32Array
  private readonly split: TableSplit
  private readonly seatScorer: Scorer
  private readonly rng: Rng
  private stage: Stage = 'table'
  private seatStage: TableByTableAnnealer | null = null
  private evals = 0

  // Table search state
  private readonly homeTable: Int32Array // The accepted local optimum kicks start from
  private homeScore = -Infinity
  private readonly bestTable: Int32Array
  private bestTableScore = -Infinity
  private sinceImproved = 0
  private passes = 0
  private starts = 0
  private kicks = 0
  private needsKick = false // Set once passes stop helping
  private freshStart = true

  // One FM pass in progress
  private inPass = false
  private readonly lockedNode: Uint8Array
  private readonly log: Int32Array // Moves made this pass: node, from-table pairs
  private logLen = 0
  private cum = 0
  private bestCum = -Infinity
  private bestLen = 0
  private passStartScore = 0

  private readonly tableIterations: number
  private readonly seatIterations: number
  private readonly kickSize: number
  private readonly restartAfter: number
  private readonly slack: number
  private readonly t0: number
  private readonly t1: number
  private readonly blockMoveRate: number
  private readonly runLength: number
  private readonly settleHits: number
  private readonly seatMoves: 'ring' | 'swaps'
  private readonly reverseRate: number
  private readonly maxStretch: number
  private bestSeatScore: number
  private readonly bestSeating: Int32Array

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.p = problem
    this.locked = locked
    this.start = Int32Array.from(guestAt)
    this.rng = mulberry32(seed)
    const tableProblem = tableLevelProblem(problem)
    // The table-level view drops head requirements from the score, but the split still caps head guests per table
    this.split = new TableSplit({ ...tableProblem, mustHead: problem.mustHead }, new Scorer(tableProblem, guestAt), guestAt, locked)
    this.seatScorer = new Scorer(problem, guestAt)
    const iterations = Math.max(2, num(params, 'iterations', 2_000_000))
    const share = Math.min(0.95, Math.max(0.02, num(params, 'tableShare', 0.05)))
    this.tableIterations = Math.round(iterations * share)
    this.seatIterations = iterations - this.tableIterations
    this.kickSize = Math.max(1, Math.round(Math.min(1, Math.max(0, num(params, 'kickShare', 0.35))) * this.split.free.length))
    this.restartAfter = Math.max(1, num(params, 'restartAfter', 30))
    this.slack = this.split.maxSize + Math.max(0, num(params, 'overfill', 0))
    this.t0 = num(params, 't0', 3)
    this.t1 = Math.min(num(params, 't1', 0.3), this.t0)
    this.blockMoveRate = num(params, 'blockMoveRate', 0.4)
    this.runLength = Math.max(1000, num(params, 'runLength', 100_000))
    this.settleHits = Math.max(1, num(params, 'settleHits', 3))
    this.seatMoves = params.seatMoves === 'swaps' ? 'swaps' : 'ring'
    this.reverseRate = num(params, 'reverseRate', 0.2)
    this.maxStretch = Math.max(3, num(params, 'maxStretch', 10))

    const N = this.split.nodes
    this.homeTable = new Int32Array(N)
    this.bestTable = new Int32Array(N)
    this.lockedNode = new Uint8Array(N)
    this.log = new Int32Array(2 * N)
    this.bestSeatScore = this.seatScorer.total
    this.bestSeating = Int32Array.from(guestAt)
    // The first start keeps the given seating's split, so a good starting seating isn't thrown away
    this.split.load(this.split.fromSeating(guestAt))
    this.evals += N
    if (this.split.T < 2 || this.split.free.length === 0) this.startSeatStage()
  }

  step(budget: number) {
    let left = budget
    while (left > 0 && this.stage !== 'done') {
      if (this.stage === 'seat') {
        const used = this.seatStage!.step(left)
        left -= used
        this.evals += used
        this.bestSeatScore = Math.max(this.bestSeatScore, this.seatStage!.bestScore)
        if (this.seatStage!.done) this.stage = 'done'
        continue
      }
      const used = this.tableOp()
      left -= used
      this.evals += used
      if (this.evals >= this.tableIterations) {
        if (this.inPass) this.endPass()
        this.startSeatStage()
      }
    }
  }

  // One unit of table-stage work: a pass move, a pass wrap-up, a kick or a fresh start. Returns its cost.
  private tableOp(): number {
    const { split } = this
    if (this.inPass) return this.passMove()
    if (this.freshStart) {
      this.freshStart = false
      if (this.starts > 0) split.load(split.random(this.rng))
      this.starts++
      this.homeScore = -Infinity
      this.sinceImproved = 0
      this.beginPass()
      return split.nodes
    }
    if (this.needsKick) {
      this.needsKick = false
      this.kick()
      this.beginPass()
      return split.nodes
    }
    this.beginPass()
    return 1
  }

  private beginPass() {
    this.inPass = true
    this.lockedNode.fill(0)
    this.logLen = 0
    this.cum = 0
    this.bestCum = this.split.fits() ? 0 : -Infinity
    this.bestLen = 0
    this.passStartScore = this.split.total
  }

  /**
   * Moves the best unlocked node anywhere it may go, or ends the pass if none can move. Moves are
   * ranked by linear gain, O(1) each; ranking by exact gain (one evaluation per candidate) found the
   * best split far less often for the same budget.
   */
  private passMove(): number {
    const { split } = this
    let bestGain = -Infinity
    let bestNode = -1
    let bestTo = -1
    let ranked = 0
    for (const i of split.free) {
      if (this.lockedNode[i]) continue
      const from = split.table[i]
      for (let b = 0; b < split.T; b++) {
        if (b === from) continue
        if (split.cnt[b] + split.size[i] > split.cap[b] + this.slack) continue
        if (split.headCnt[b] + split.heads[i] > split.headCap[b] + 1) continue
        const g = split.linearGain(i, b)
        ranked++
        // Ties broken at random so restarts explore different sequences
        if (g > bestGain + EPS || (g > bestGain - EPS && this.rng() < 0.5)) {
          bestGain = g
          bestNode = i
          bestTo = b
        }
      }
    }
    // Ranking n candidates costs about one evaluation, then one more to score the chosen move exactly
    const cost = 1 + Math.ceil(ranked / split.n)
    if (bestNode < 0) {
      this.endPass()
      return cost
    }
    const delta = split.gain(bestNode, bestTo)
    this.log[2 * this.logLen] = bestNode
    this.log[2 * this.logLen + 1] = split.table[bestNode]
    this.logLen++
    split.move(bestNode, bestTo, delta)
    this.lockedNode[bestNode] = 1
    this.cum += delta
    if (this.cum > this.bestCum + EPS && split.fits()) {
      this.bestCum = this.cum
      this.bestLen = this.logLen
    }
    return cost + 2 // The exact score and the move's update of every sum
  }

  // Rolls back to the best prefix, then decides what comes next
  private endPass() {
    const { split } = this
    this.inPass = false
    this.passes++
    for (let m = this.logLen - 1; m >= this.bestLen; m--) split.move(this.log[2 * m], this.log[2 * m + 1], 0)
    split.total = this.passStartScore + (this.bestLen > 0 ? this.bestCum : 0)
    this.evals += this.logLen - this.bestLen
    // Rebuild the sums now and then so floating-point drift can't creep in
    if (this.passes % 64 === 0) {
      split.load(split.table)
      this.evals += split.nodes
    }
    if (split.total > this.passStartScore + EPS) return // Keep passing while it helps

    // A local optimum: keep it if it's good enough, otherwise go back to the last one
    if (!split.fits()) {
      this.freshStart = true
      return
    }
    if (split.total > this.bestTableScore + EPS) {
      this.bestTableScore = split.total
      this.bestTable.set(split.table)
    }
    // Ties count as accepted, so the search drifts across plateaus of equal splits
    const accept = split.total > this.homeScore - EPS
    if (split.total > this.homeScore + EPS) this.sinceImproved = 0
    else this.sinceImproved++
    if (accept) {
      this.homeScore = split.total
      this.homeTable.set(split.table)
    } else {
      split.load(this.homeTable)
      this.evals += split.nodes
    }
    if (this.sinceImproved >= this.restartAfter) this.freshStart = true
    else this.needsKick = true
  }

  // A few random swaps of same-size nodes between tables (a move when a table has room)
  private kick() {
    const { split, rng } = this
    this.kicks++
    const free = split.free
    for (let k = 0; k < this.kickSize; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const i = free[randInt(rng, free.length)]
        const a = split.table[i]
        const b = (a + 1 + randInt(rng, split.T - 1)) % split.T
        if (split.cnt[b] + split.size[i] <= split.cap[b] && split.headCnt[b] + split.heads[i] <= split.headCap[b]) {
          split.move(i, b, split.gain(i, b))
          break
        }
        const j = free[randInt(rng, free.length)]
        if (split.table[j] !== b || split.size[j] !== split.size[i] || split.heads[j] !== split.heads[i]) continue
        split.move(i, b, split.gain(i, b))
        split.move(j, a, split.gain(j, a))
        break
      }
    }
  }

  // Seats the best split found (or the current one, if it's better or nothing fit yet)
  private startSeatStage() {
    const { split } = this
    if (this.bestTableScore === -Infinity || (split.fits() && split.total > this.bestTableScore + EPS)) {
      this.bestTableScore = split.total
      this.bestTable.set(split.table)
    }
    split.load(this.bestTable)
    this.seatScorer.load(split.seating(this.bestTable, this.start, this.locked, this.rng))
    this.seatStage = new TableByTableAnnealer(
      this.seatScorer,
      this.locked,
      this.rng,
      Math.max(1, this.seatIterations),
      this.runLength,
      this.t0,
      this.t1,
      this.blockMoveRate,
      this.settleHits,
      this.seatMoves === 'ring' ? { couple: this.blockMoveRate, reverse: this.reverseRate } : null,
      this.maxStretch
    )
    this.bestSeatScore = this.seatScorer.total
    this.stage = 'seat'
  }

  // During stage one, the best split so far as seated, so the chart stays comparable
  private seatBestSplit() {
    if (this.stage !== 'table' || this.bestTableScore === -Infinity) return
    this.bestSeating.set(this.split.seating(this.bestTable, this.start, this.locked, null))
    this.seatScorer.load(this.bestSeating)
    this.bestSeatScore = this.seatScorer.total
  }

  progress(): SolverProgress {
    this.seatBestSplit()
    return {
      evaluations: this.evals,
      current: this.stage === 'table' ? this.split.total : this.seatScorer.total,
      best: this.bestSeatScore,
      done: this.stage === 'done',
      metrics: {
        Stage: this.stage === 'table' ? '1 · Who shares a table' : '2 · Seat order',
        'Table-level score': this.bestTableScore,
        Passes: this.passes,
        Starts: this.starts,
        Kicks: this.kicks,
        ...(this.seatStage ? { Temperature: this.seatStage.temperature, 'Seat runs': this.seatStage.runs, 'Tables settled': this.seatStage.settled } : {}),
      },
    }
  }

  current() {
    this.seatBestSplit()
    return this.stage === 'table' ? this.bestSeating : this.seatScorer.guestAt
  }

  best() {
    this.seatBestSplit()
    return this.seatStage ? this.seatStage.bestAt : this.bestSeating
  }
}

export const kernighanLin: AlgorithmPlugin<'kernighanLin'> = {
  spec: {
    id: 'kernighanLin',
    name: 'Kernighan–Lin',
    description: 'Classic graph bisection: improves the table split with passes of best-move sequences, then arranges seats.',
    params: [
      { key: 'iterations', label: 'Iterations', help: 'Total work across both stages, in swap evaluations', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'tableShare', label: 'Share spent on tables', help: 'Fraction of iterations spent deciding who shares a table; the rest arranges seats within each table', type: 'number', min: 0.02, max: 0.95, step: 0.01, default: 0.05 },
      { key: 'kickShare', label: 'Kick size', help: 'Random swaps between tables after passes settle, as a share of the movable guests and couples. Bigger kicks explore further from the last split', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
      { key: 'restartAfter', label: 'Kicks before restart', help: 'Kicks in a row without a better split before starting over from a random split', type: 'number', min: 1, max: 1000, step: 1, default: 30 },
      { key: 'overfill', label: 'Extra overfill', help: 'Seats a table may run over capacity mid-pass, beyond what the biggest group needs. More allows longer detours within a pass', type: 'number', min: 0, max: 10, step: 1, default: 0 },
      { key: 'runLength', label: 'Seat run length', help: 'Iterations in each annealing run for one table. Shorter runs mean more fresh tries per table', type: 'number', min: 1000, max: 2_000_000, step: 1000, default: 100_000 },
      { key: 'settleHits', label: 'Runs to settle a table', help: 'Once this many runs reach a table\'s best, the remaining runs go to tables still improving', type: 'number', min: 1, max: 50, step: 1, default: 3 },
      {
        key: 'seatMoves',
        label: 'Seat moves',
        help: 'Moves for arranging each table. Table-shaped adds reversals of stretches of seats to the plain swaps and couple moves',
        type: 'select',
        options: [
          { value: 'ring', label: 'Table-shaped' },
          { value: 'swaps', label: 'Plain swaps' },
        ],
        default: 'ring',
      },
      { key: 'reverseRate', label: 'Stretch reversals', help: 'Share of table-shaped moves that reverse a stretch of seats around the table, keeping neighbors together', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
      { key: 'maxStretch', label: 'Longest reversal', help: 'Most seats one stretch reversal can flip. Longer reversals make bigger changes per move', type: 'number', min: 3, max: 40, step: 1, default: 10 },
      { key: 't0', label: 'Seat stage start temp', help: 'Starting temperature for arranging seats within tables', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 't1', label: 'Seat stage end temp', help: 'Final temperature for arranging seats within tables', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      { key: 'blockMoveRate', label: 'Couple moves', help: 'Share of seat-stage moves that move a must-sit-next-to couple together to another pair of seats', type: 'number', min: 0, max: 0.8, step: 0.05, default: 0.4 },
    ],
  },
  create: (problem, guestAt, locked, params, seed) => new KernighanLinSolver(problem, guestAt, locked, params, seed),
  scale: (params, evaluations) => ({ ...params, iterations: Math.max(1000, Math.floor(evaluations)) }),
}
