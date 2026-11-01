// Large neighborhood search (ruin and recreate): pull a chunk of guests out of the seating (a friend
// cluster, a stretch of seats, the unhappiest guests…), seat them again one by one in the best
// free seat, tidy up with a short hill climb, and keep the result if the acceptance rule allows.
// Which ways of choosing the chunk get picked adapts to which ones have been finding improvements.

import { AlgorithmPlugin, autoTemperature, Moves, num, Params, proposeMove, RECOMPUTE_EVERY, Solver, SolverProgress } from '../core'
import { Problem, tableLevelProblem } from '../problem'
import { mulberry32, randInt, Rng } from '../random'
import { Scorer } from '../scorer'

// Ways of choosing who to pull out
const DESTROY = ['cluster', 'stretch', 'worst', 'couples', 'random', 'twoClusters', 'exact'] as const
type Destroy = (typeof DESTROY)[number]
const DESTROY_LABELS: Record<Destroy, string> = {
  cluster: 'Friend cluster',
  stretch: 'Stretch of seats',
  worst: 'Unhappiest guests',
  couples: 'Couples',
  random: 'Random guests',
  twoClusters: 'Cluster per table',
  exact: 'Best order of a few',
}

// Adaptive weights: an operator earns these points when its rebuild finds a new best, beats the
// current seating, or is merely accepted (Ropke & Pisinger's scheme)
const REWARD_BEST = 10
const REWARD_BETTER = 4
const REWARD_ACCEPTED = 1
const SEGMENT = 50 // Rebuilds between weight updates
const MIN_WEIGHT = 0.05 // Every operator keeps at least this weight so it can make a comeback

const TABLE_STAGE_CAP = 1_000_000 // Evaluations scale() lets the table stage have

type Acceptance = 'anneal' | 'recordToRecord' | 'better'

/**
 * Seats a set of removed guests into a set of freed seats, scoring each insertion against the
 * guests still seated. Couples who must sit together go in as a unit on two neighboring free seats.
 * Exported for tests.
 */
export class Rebuilder {
  readonly pos: Int32Array // Guest -> seat while seated, -1 while removed
  private readonly hp: Float64Array // Happiness from seated guests only
  private readonly free: Uint8Array // Per seat: freed and not yet refilled
  private readonly neighbors: Int32Array[] // Per seat: adjacent seats
  private readonly links: Int32Array[] // Per guest: everyone they have a nonzero rating with
  private readonly constraintsOf: { other: number; kind: string }[][]
  readonly couples: Int32Array[] // Per guest: must-sit-next-to partners
  checks = 0 // Insertion checks so far, in swap-evaluation units

  constructor(
    readonly p: Problem,
    private readonly scorer: Scorer
  ) {
    const { n, S, A, adjacent } = p
    this.pos = new Int32Array(n)
    this.hp = new Float64Array(n)
    this.free = new Uint8Array(S)
    this.neighbors = Array.from({ length: S }, (_, a) => Int32Array.from({ length: S }, (_, b) => b).filter((b) => adjacent[a * S + b]))
    this.links = Array.from({ length: n }, (_, g) => Int32Array.from({ length: n }, (_, k) => k).filter((k) => k !== g && A[g * n + k] !== 0))
    this.constraintsOf = Array.from({ length: n }, () => [])
    const couples: number[][] = Array.from({ length: n }, () => [])
    for (const c of p.pairs) {
      this.constraintsOf[c.x].push({ other: c.y, kind: c.kind })
      this.constraintsOf[c.y].push({ other: c.x, kind: c.kind })
      if (c.kind === 'ADJACENT') {
        couples[c.x].push(c.y)
        couples[c.y].push(c.x)
      }
    }
    this.couples = couples.map((list) => Int32Array.from(list))
  }

  /**
   * Plans new seats for `removed` (guest tokens) among `seats` (their current seats) and returns
   * seat -> token for those seats. Empty-seat tokens fill whatever seats are left.
   */
  rebuild(removed: number[], seats: number[], rng: Rng, regret: boolean, noise: number): Map<number, number> {
    const n = this.p.n
    const guests = removed.filter((t) => t < n)
    this.lift(guests)
    for (const s of seats) this.free[s] = 1

    // Units: a couple whose partner was removed too goes in together; everyone else alone
    const inSet = new Set(guests)
    const taken = new Set<number>()
    const units: number[][] = []
    for (const g of guests) {
      if (taken.has(g)) continue
      taken.add(g)
      const partner = Array.from(this.couples[g]).find((k) => inSet.has(k) && !taken.has(k))
      if (partner !== undefined) {
        taken.add(partner)
        units.push([g, partner])
      } else units.push([g])
    }
    // Hardest first: couples and must-be-at-a-head guests, then a random order
    for (let i = units.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1)
      ;[units[i], units[j]] = [units[j], units[i]]
    }
    const hard = (u: number[]) => (u.length === 2 ? 2 : this.p.mustHead[u[0]] ? 1 : 0)
    units.sort((a, b) => hard(b) - hard(a))

    const plan = new Map<number, number>()
    const freeList = seats.slice()
    const place = (g: number, s: number) => {
      this.seat(g, s)
      plan.set(s, g)
      this.free[s] = 0
      freeList.splice(freeList.indexOf(s), 1)
    }

    if (regret) {
      // Each round, seat the unit that would lose the most by waiting (best minus second best).
      // Couples still go first: once neighboring free seats run out they can't sit together
      while (units.length > 0) {
        let pick = 0
        let pickRegret = -Infinity
        let pickSeats: number[] = []
        const couplesLeft = units[0].length === 2
        for (let i = 0; i < units.length; i++) {
          if (couplesLeft && units[i].length === 1) break
          const [best, second, at] = this.bestSpot(units[i], freeList, rng, noise)
          const r = second === -Infinity ? 1e9 : best - second
          if (r > pickRegret) {
            pickRegret = r
            pick = i
            pickSeats = at
          }
        }
        const unit = units.splice(pick, 1)[0]
        this.placeUnit(unit, pickSeats, freeList, rng, noise, place)
      }
    } else {
      for (const unit of units) {
        const [, , at] = this.bestSpot(unit, freeList, rng, noise)
        this.placeUnit(unit, at, freeList, rng, noise, place)
      }
    }

    // Empty seats take whatever is left
    const empties = removed.filter((t) => t >= n)
    for (const s of freeList) plan.set(s, empties.pop()!)
    for (const s of seats) this.free[s] = 0
    return plan
  }

  /**
   * Takes `guests` out of the scorer's seating: everyone else's happiness drops their ties to them.
   */
  lift(guests: number[]) {
    const { n, S, A, P } = this.p
    const { pos, hp, scorer } = this
    for (let g = 0; g < n; g++) pos[g] = scorer.seatOf[g]
    for (const g of guests) pos[g] = -1
    for (let k = 0; k < n; k++) {
      if (pos[k] < 0) continue
      let h = scorer.h[k]
      const row = pos[k] * S
      for (const g of guests) h -= A[k * n + g] * P[row + scorer.seatOf[g]]
      hp[k] = h
    }
    this.checks += guests.length
  }

  // Seats a unit at `at` if it fit, otherwise its members one at a time
  private placeUnit(unit: number[], at: number[], freeList: number[], rng: Rng, noise: number, place: (g: number, s: number) => void) {
    if (at.length === unit.length) {
      unit.forEach((g, i) => place(g, at[i]))
      return
    }
    for (const g of unit) place(g, this.bestSpot([g], freeList, rng, noise)[2][0])
  }

  // Best and second-best insertion value for a unit, and the seats of the best
  private bestSpot(unit: number[], freeList: number[], rng: Rng, noise: number): [number, number, number[]] {
    let best = -Infinity
    let second = -Infinity
    let at: number[] = []
    const consider = (v: number, seats: number[]) => {
      if (noise > 0) v += noise * rng()
      if (v > best) {
        second = best
        best = v
        at = seats
      } else if (v > second) second = v
    }
    if (unit.length === 1) {
      for (const s of freeList) consider(this.insertValue(unit[0], s), [s])
    } else {
      for (const s of freeList)
        for (const t of this.neighbors[s]) if (this.free[t]) consider(this.pairValue(unit[0], unit[1], s, t), [s, t])
    }
    return [best, second, at]
  }

  // Penalty for g's hard constraints with guests already seated, if g sat at s
  private brokenAt(g: number, s: number): number {
    const { S, adjacent, tableOf, mustHead, isHead } = this.p
    let broken = mustHead[g] && !isHead[s] ? 1 : 0
    for (const c of this.constraintsOf[g]) {
      const ps = this.pos[c.other]
      if (ps < 0) continue
      const near = adjacent[s * S + ps] === 1
      const same = tableOf[s] === tableOf[ps]
      if ((c.kind === 'ADJACENT' && !near) || (c.kind === 'NOT_ADJACENT' && near) || (c.kind === 'SAME_TABLE' && !same) || (c.kind === 'DIFFERENT_TABLE' && same)) broken++
    }
    return broken
  }

  /**
   * Change in the objective (over seated guests) from seating g at s. One unit of work.
   */
  insertValue(g: number, s: number): number {
    const { n, S, A, P } = this.p
    const { pos, hp, scorer } = this
    this.checks++
    let hg = 0
    let delta = 0
    const row = s * S
    for (const k of this.links[g]) {
      const sk = pos[k]
      if (sk < 0) continue
      const v = A[g * n + k] * P[row + sk]
      if (v === 0) continue
      hg += v
      delta += scorer.utility(k, hp[k] + v, scorer.known[k], sk) - scorer.utility(k, hp[k], scorer.known[k], sk)
    }
    return delta + scorer.utility(g, hg, scorer.known[g], s) - this.p.objective.constraintPenalty * this.brokenAt(g, s)
  }

  // Seating x at s and y at t together (their own rule is kept). Two units of work.
  private pairValue(x: number, y: number, s: number, t: number): number {
    const v = this.insertValue(x, s)
    this.seat(x, s)
    const w = this.insertValue(y, t)
    this.unseat(x)
    return v + w
  }

  private seat(g: number, s: number) {
    const { n, S, A, P } = this.p
    const { pos, hp } = this
    let hg = 0
    for (const k of this.links[g]) {
      const sk = pos[k]
      if (sk < 0) continue
      const v = A[g * n + k] * P[s * S + sk]
      hp[k] += v
      hg += v
    }
    hp[g] = hg
    pos[g] = s
  }

  private unseat(g: number) {
    const { n, S, A, P } = this.p
    const { pos, hp } = this
    const s = pos[g]
    pos[g] = -1
    for (const k of this.links[g]) {
      const sk = pos[k]
      if (sk >= 0) hp[k] -= A[g * n + k] * P[s * S + sk]
    }
  }
}

type ChainConfig = {
  destroyMin: number
  destroyMax: number
  regret: boolean
  noise: number
  polish: number
  acceptance: Acceptance
  reaction: number
  blockMoveRate: number
  sameTable: boolean // Keep everyone at their table: rebuild within one table at a time
  exactSize: number // Guests the exact operator reorders (every order is tried), 0 to turn it off
}

/**
 * One ruin-and-recreate search over one scorer: the table stage runs it on the table-level
 * problem, the seat stage on the real one.
 */
export class LnsChain {
  readonly bestAt: Int32Array
  bestScore: number
  evals = 0
  iteration = 0
  accepted = 0
  lastSize = 0
  readonly weights: Float64Array
  readonly uses: Float64Array
  readonly wins: Float64Array // Rebuilds that beat the current seating
  private readonly rebuilder: Rebuilder
  private readonly p: Problem
  private readonly movableSeat: Uint8Array
  private readonly near: Int32Array[] // Per seat: movable seats at the same table, closest first
  private readonly segScore: Float64Array
  private readonly segUses: Float64Array
  private readonly swaps: number[] = [] // This rebuild's swaps, for undoing it

  constructor(
    readonly scorer: Scorer,
    private readonly moves: Moves,
    locked: Uint8Array,
    private readonly rng: Rng,
    private readonly cfg: ChainConfig
  ) {
    const p = scorer.p
    this.p = p
    this.rebuilder = new Rebuilder(p, scorer)
    this.bestAt = Int32Array.from(scorer.guestAt)
    this.bestScore = scorer.total
    const { S, seats, tableOf } = p
    this.movableSeat = Uint8Array.from({ length: S }, (_, s) => (locked[s] ? 0 : 1))
    this.near = Array.from({ length: S }, (_, a) => {
      const list = Array.from(moves.movable).filter((b) => tableOf[b] === tableOf[a])
      const d = (b: number) => (seats[a].x - seats[b].x) ** 2 + (seats[a].y - seats[b].y) ** 2
      return Int32Array.from(list.sort((x, y) => d(x) - d(y)))
    })
    const k = DESTROY.length
    this.weights = new Float64Array(k).fill(1)
    if (cfg.exactSize < 2) this.weights[DESTROY.indexOf('exact')] = 0
    this.segScore = new Float64Array(k)
    this.segUses = new Float64Array(k)
    this.uses = new Float64Array(k)
    this.wins = new Float64Array(k)
  }

  // One ruin, recreate, hill climb and accept-or-undo
  iterate(temperature: number) {
    const { scorer, rng, rebuilder, cfg } = this
    const op = this.pickOperator()
    const before = scorer.total
    const checksBefore = rebuilder.checks
    if (DESTROY[op] === 'exact') {
      this.reorder(op)
      return
    }

    const size = cfg.destroyMin + randInt(rng, cfg.destroyMax - cfg.destroyMin + 1)
    const removed = this.withPartners(this.destroy(DESTROY[op], size))
    this.lastSize = removed.length
    const seats = removed.map((t) => scorer.seatOf[t])

    // Apply the plan as swaps so the scorer stays exact and the rebuild can be undone
    const plan = rebuilder.rebuild(removed, seats, rng, cfg.regret, cfg.noise)
    this.swaps.length = 0
    for (const s of seats) {
      const want = plan.get(s)!
      if (scorer.guestAt[s] === want) continue
      const t = scorer.seatOf[want]
      scorer.applySwap(s, t)
      this.swaps.push(s, t)
    }
    this.evals += rebuilder.checks - checksBefore + this.swaps.length / 2
    this.climb(seats)

    const after = scorer.total
    let ok: boolean
    if (after >= before - 1e-9) ok = true
    else if (cfg.acceptance === 'recordToRecord') ok = after >= this.bestScore - temperature
    else if (cfg.acceptance === 'anneal') ok = rng() < Math.exp((after - before) / temperature)
    else ok = false

    let reward = 0
    if (ok) {
      this.accepted++
      if (after > this.bestScore + 1e-9) {
        this.bestScore = after
        this.bestAt.set(scorer.guestAt)
        reward = REWARD_BEST
      } else reward = after > before + 1e-9 ? REWARD_BETTER : REWARD_ACCEPTED
    } else {
      for (let i = this.swaps.length - 2; i >= 0; i -= 2) scorer.applySwap(this.swaps[i], this.swaps[i + 1])
      this.evals += this.swaps.length / 2
    }
    this.record(op, before, after, reward)
  }

  private record(op: number, before: number, after: number, reward: number) {
    if (after > before + 1e-9) this.wins[op]++
    this.uses[op]++
    this.segUses[op]++
    this.segScore[op] += reward
    this.iteration++
    if (this.iteration % SEGMENT === 0) this.updateWeights()
    if (this.iteration % 2048 === 0) this.scorer.recompute()
  }

  /**
   * Tries every order of a few guests sitting close together (or a small friend cluster) in
   * their own seats and keeps the best. Heap's algorithm reaches each order with one swap.
   */
  private reorder(op: number) {
    const { scorer, rng } = this
    const k = this.cfg.exactSize
    const tokens = rng() < 0.5 ? this.destroy('stretch', k) : this.destroy('cluster', k)
    const seats = tokens.slice(0, k).map((t) => scorer.seatOf[t])
    const m = seats.length
    this.lastSize = m
    const before = scorer.total
    let best = before
    const bestTokens = seats.map((s) => scorer.guestAt[s])
    const c = new Int32Array(m)
    for (let i = 1; i < m; ) {
      if (c[i] < i) {
        scorer.applySwap(seats[i % 2 ? c[i] : 0], seats[i])
        this.evals++
        if (scorer.total > best + 1e-9) {
          best = scorer.total
          seats.forEach((s, j) => (bestTokens[j] = scorer.guestAt[s]))
        }
        c[i]++
        i = 1
      } else {
        c[i] = 0
        i++
      }
    }
    // Move to the best order found
    seats.forEach((s, j) => {
      if (scorer.guestAt[s] === bestTokens[j]) return
      scorer.applySwap(s, scorer.seatOf[bestTokens[j]])
      this.evals++
    })
    const after = scorer.total
    this.accepted++
    let reward = REWARD_ACCEPTED
    if (after > this.bestScore + 1e-9) {
      this.bestScore = after
      this.bestAt.set(scorer.guestAt)
      reward = REWARD_BEST
    } else if (after > before + 1e-9) reward = REWARD_BETTER
    this.record(op, before, after, reward)
  }

  // Short hill climb: swaps touching the rebuilt seats, plus couple moves anywhere
  private climb(seats: number[]) {
    const { scorer, rng, moves } = this
    const trials = Math.round(this.cfg.polish * seats.length)
    for (let i = 0; i < trials; i++) {
      this.evals++
      if (this.cfg.blockMoveRate > 0 && rng() < this.cfg.blockMoveRate) {
        const b = moves.pickBlocks(rng, this.cfg.sameTable ? 'sameTable' : 'any', scorer.seatOf)
        if (!b) continue
        if (scorer.applySwap(b[0], b[1]) + scorer.applySwap(b[2], b[3]) > 1e-9) this.swaps.push(b[0], b[1], b[2], b[3])
        else {
          scorer.applySwap(b[2], b[3])
          scorer.applySwap(b[0], b[1])
        }
        continue
      }
      const a = seats[randInt(rng, seats.length)]
      const pool = this.cfg.sameTable ? this.near[a] : moves.movable
      const b = pool[randInt(rng, pool.length)]
      if (a === b || (scorer.guestAt[a] >= this.p.n && scorer.guestAt[b] >= this.p.n)) continue
      if (scorer.applySwap(a, b) > 1e-9) this.swaps.push(a, b)
      else scorer.applySwap(a, b)
    }
  }

  private pickOperator(): number {
    let total = 0
    for (const w of this.weights) total += w
    let r = this.rng() * total
    for (let i = 0; i < this.weights.length; i++) {
      r -= this.weights[i]
      if (r <= 0) return i
    }
    return this.weights.length - 1
  }

  private updateWeights() {
    const reaction = this.cfg.reaction
    if (reaction <= 0) return
    let total = 0
    for (let i = 0; i < this.weights.length; i++) {
      if (this.segUses[i] > 0) this.weights[i] = (1 - reaction) * this.weights[i] + reaction * (this.segScore[i] / this.segUses[i])
      this.segUses[i] = 0
      this.segScore[i] = 0
      total += this.weights[i]
    }
    for (let i = 0; i < this.weights.length; i++) if (this.weights[i] > 0 || this.cfg.exactSize >= 2) this.weights[i] = Math.max(this.weights[i], MIN_WEIGHT * total)
  }

  // Tokens to pull out (guests or empty seats), all on movable seats
  private destroy(op: Destroy, size: number): number[] {
    const { scorer, rng, p } = this
    const movable = this.moves.movable
    const out = new Set<number>()
    // Confined to one table, every operator works within the table of a random seat
    const only = this.cfg.sameTable ? p.tableOf[movable[randInt(rng, movable.length)]] : -1
    const randomGuest = (table = only) => {
      for (let tries = 0; tries < 50; tries++) {
        const t = scorer.guestAt[movable[randInt(rng, movable.length)]]
        if (t < p.n && (table < 0 || p.tableOf[scorer.seatOf[t]] === table)) return t
      }
      return -1
    }
    switch (op) {
      case 'cluster':
        this.cluster(randomGuest(), size, only, out)
        break
      case 'twoClusters': {
        const first = randomGuest()
        if (first < 0) break
        const table = p.tableOf[scorer.seatOf[first]]
        this.cluster(first, Math.ceil(size / 2), table, out)
        const other = randomGuest(only >= 0 ? only : (table + 1 + randInt(rng, Math.max(1, p.layout.tables - 1))) % p.layout.tables)
        if (other >= 0) this.cluster(other, size - Math.ceil(size / 2), p.tableOf[scorer.seatOf[other]], out)
        break
      }
      case 'stretch': {
        const seed = scorer.seatOf[randomGuest()]
        const list = this.near[seed >= 0 ? seed : movable[0]]
        for (let i = 0; i < list.length && out.size < size; i++) out.add(scorer.guestAt[list[i]])
        break
      }
      case 'worst': {
        // Lowest utility, jittered so the same few guests aren't always chosen
        const order = Array.from({ length: p.n }, (_, g) => g).filter((g) => this.movableSeat[scorer.seatOf[g]] && (only < 0 || p.tableOf[scorer.seatOf[g]] === only))
        const key = order.map((g) => scorer.utility(g, scorer.h[g], scorer.known[g], scorer.seatOf[g]) + 3 * rng())
        const idx = order.map((_, i) => i).sort((a, b) => key[a] - key[b])
        for (let i = 0; i < idx.length && out.size < size; i++) out.add(order[idx[i]])
        this.evals++
        break
      }
      case 'couples': {
        const couples = p.pairs.filter((c) => c.kind === 'ADJACENT')
        for (let tries = 0; tries < 4 * size && out.size < size && couples.length > 0; tries++) {
          const c = couples[randInt(rng, couples.length)]
          for (const g of [c.x, c.y]) if (this.movableSeat[scorer.seatOf[g]] && (only < 0 || p.tableOf[scorer.seatOf[g]] === only)) out.add(g)
        }
        break
      }
      case 'random':
        break
    }
    for (let tries = 0; out.size < size && tries < 10 * size; tries++) {
      const t = randomGuest()
      if (t >= 0) out.add(t)
    }
    return Array.from(out)
  }

  // A seed guest plus whoever is most attached to the guests picked so far
  private cluster(seed: number, size: number, table: number, out: Set<number>) {
    if (seed < 0) return
    const { p, scorer, rng } = this
    const { n, A, tableOf } = p
    const pull = new Float64Array(n)
    let g = seed
    let picked = 0
    while (g >= 0 && picked < size) {
      if (!out.has(g)) picked++
      out.add(g)
      for (let k = 0; k < n; k++) pull[k] += A[k * n + g]
      this.evals++
      g = -1
      let best = 0
      for (let k = 0; k < n; k++) {
        if (out.has(k) || pull[k] <= 0 || !this.movableSeat[scorer.seatOf[k]]) continue
        if (table >= 0 && tableOf[scorer.seatOf[k]] !== table) continue
        const v = pull[k] * (0.5 + rng())
        if (v > best) {
          best = v
          g = k
        }
      }
    }
  }

  // Must-sit-next-to partners come along, so they can be seated together
  private withPartners(tokens: number[]): number[] {
    const set = new Set(tokens)
    for (const t of tokens) {
      if (t >= this.p.n) continue
      for (const k of this.rebuilder.couples[t]) {
        const s = this.scorer.seatOf[k]
        if (this.movableSeat[s] && (!this.cfg.sameTable || this.p.tableOf[s] === this.p.tableOf[this.scorer.seatOf[t]])) set.add(k)
      }
    }
    return Array.from(set)
  }

  metrics(): Record<string, number | string> {
    const total = this.weights.reduce((s, w) => s + w, 0)
    const metrics: Record<string, number | string> = {
      Rebuilds: this.iteration,
      'Acceptance rate': this.iteration ? this.accepted / this.iteration : 0,
      'Guests pulled out': this.lastSize,
    }
    DESTROY.forEach((op, i) => {
      const rate = this.uses[i] ? Math.round((100 * this.wins[i]) / this.uses[i]) : 0
      metrics[DESTROY_LABELS[op]] = `${Math.round((100 * this.weights[i]) / total)}% picked · ${rate}% improve`
    })
    return metrics
  }
}

/**
 * Two stages like the two-stage solver: first settle who shares a table (on the table-level
 * problem, where everyone at a table counts equally), then ruin and recreate the real seating.
 */
export class LnsSolver implements Solver {
  private readonly p: Problem
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly locked: Uint8Array
  private readonly tableScorer: Scorer | null
  private tableChain: LnsChain | null = null
  private seatChain: LnsChain | null = null
  private readonly seatScorer: Scorer
  private readonly bestAt: Int32Array
  private bestScore: number
  private readonly bestTableAt: Int32Array
  private bestTableScore: number
  private tableEvals = 0
  private temperature = 0
  private finished = false
  private readonly cfg: ChainConfig
  private readonly maxEvaluations: number
  private readonly stage1: number // Evaluations for the table stage
  private readonly tableStage: string
  private readonly seatScope: string
  private readonly tableT0: number
  private readonly t0: number
  private readonly t1: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.p = problem
    this.locked = locked
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked, 1)
    this.maxEvaluations = Math.max(1, num(params, 'maxEvaluations', 2_000_000))
    const destroyMin = Math.max(2, num(params, 'destroyMin', 4))
    this.cfg = {
      destroyMin,
      destroyMax: Math.max(destroyMin, num(params, 'destroyMax', 14)),
      regret: params.repair === 'regret',
      noise: num(params, 'noise', 0),
      polish: num(params, 'polish', 20),
      acceptance: (['anneal', 'recordToRecord', 'better'].includes(String(params.acceptance)) ? params.acceptance : 'anneal') as Acceptance,
      reaction: num(params, 'reaction', 0.2),
      blockMoveRate: num(params, 'blockMoveRate', 0.2),
      sameTable: false,
      exactSize: num(params, 'exactSize', 0),
    }
    this.tableStage = String(params.tableStage ?? 'anneal')
    this.seatScope = String(params.seatScope ?? 'sameTable')
    this.stage1 = this.tableStage === 'none' ? 0 : Math.round(this.maxEvaluations * Math.min(0.9, Math.max(0, num(params, 'tableShare', 0.4))))
    this.t0 = Math.max(0.01, num(params, 't0', 10))
    this.t1 = Math.min(num(params, 't1', 0.3), this.t0)
    this.seatScorer = new Scorer(problem, guestAt)
    this.bestAt = Int32Array.from(this.seatScorer.guestAt)
    this.bestScore = this.seatScorer.total
    this.bestTableAt = Int32Array.from(guestAt)
    this.tableScorer = this.stage1 > 0 ? new Scorer(tableLevelProblem(problem), guestAt) : null
    this.bestTableScore = this.tableScorer?.total ?? 0
    this.tableT0 = this.tableScorer ? num(params, 'tableTemp', 1) * autoTemperature(this.tableScorer, this.moves, this.rng, 'crossTable') : 0
    if (this.tableScorer && this.tableStage === 'lns') this.tableChain = new LnsChain(this.tableScorer, this.moves, locked, this.rng, this.cfg)
    if (!this.tableScorer) this.startSeatStage(guestAt)
    if (this.moves.movable.length < 2) this.finished = true
  }

  private get evals() {
    return this.tableEvals + (this.tableChain?.evals ?? 0) + (this.seatChain?.evals ?? 0)
  }

  private startSeatStage(guestAt: Int32Array) {
    this.seatScorer.load(guestAt)
    this.seatChain = new LnsChain(this.seatScorer, this.moves, this.locked, this.rng, { ...this.cfg, sameTable: this.seatScope === 'sameTable' })
    this.bestScore = this.seatScorer.total
    this.bestAt.set(this.seatScorer.guestAt)
  }

  step(budget: number) {
    const stop = this.evals + budget
    while (this.evals < stop && !this.finished) {
      if (!this.seatChain) this.tableStep(stop)
      else {
        const f = Math.min(1, (this.evals - this.stage1) / Math.max(1, this.maxEvaluations - this.stage1))
        this.temperature = this.t0 * Math.pow(this.t1 / this.t0, f)
        this.seatChain.iterate(this.temperature)
        if (this.seatChain.bestScore > this.bestScore + 1e-9) {
          this.bestScore = this.seatChain.bestScore
          this.bestAt.set(this.seatChain.bestAt)
        }
      }
      if (this.evals >= this.maxEvaluations) this.finished = true
    }
  }

  // The table stage, cooling from the automatic temperature to a thousandth of it
  private tableStep(stop: number) {
    const scorer = this.tableScorer!
    const rng = this.rng
    while (this.evals < stop && this.evals < this.stage1) {
      this.temperature = this.tableT0 * Math.pow(0.001, this.evals / this.stage1)
      if (this.tableChain) {
        this.tableChain.iterate(this.temperature)
        continue
      }
      this.tableEvals++
      const move = proposeMove(scorer, this.moves, rng, this.cfg.blockMoveRate, 'crossTable')
      if (move && !(move.delta >= 0 || rng() < Math.exp(move.delta / this.temperature))) move.undo()
      else if (move && scorer.total > this.bestTableScore + 1e-9) {
        this.bestTableScore = scorer.total
        this.bestTableAt.set(scorer.guestAt)
      }
      if (this.tableEvals % RECOMPUTE_EVERY === 0) scorer.recompute()
    }
    if (this.evals >= this.stage1) this.startSeatStage(this.tableChain ? this.tableChain.bestAt : this.bestTableAt)
  }

  progress(): SolverProgress {
    const chain = this.seatChain ?? this.tableChain
    const metrics: Record<string, number | string> = {
      Stage: this.seatChain ? '2 · Rebuilding seats' : '1 · Who shares a table',
      Temperature: this.temperature,
      ...(chain ? chain.metrics() : {}),
    }
    if (!this.seatChain && this.tableScorer) {
      metrics['Table-level score'] = this.tableScorer.total
      // Score the table split as seated so the chart stays comparable
      this.seatScorer.load(this.tableScorer.guestAt)
      if (this.seatScorer.total > this.bestScore + 1e-9) {
        this.bestScore = this.seatScorer.total
        this.bestAt.set(this.seatScorer.guestAt)
      }
    }
    return { evaluations: this.evals, current: this.seatScorer.total, best: this.bestScore, done: this.finished, metrics }
  }

  current() {
    return this.seatChain ? this.seatScorer.guestAt : this.tableScorer!.guestAt
  }

  best() {
    return this.bestAt
  }
}

export const lns: AlgorithmPlugin<'lns'> = {
  spec: {
    id: 'lns',
    name: 'Large neighborhood search',
    description: 'Repeatedly pulls out a chunk of guests (a friend cluster, a party, a stretch of seats) and rebuilds it.',
    params: [
      { key: 'maxEvaluations', label: 'Total work', help: 'Budget in swap-sized steps; checking one guest in one seat counts as one', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      {
        key: 'tableStage',
        label: 'Table stage',
        help: 'How to first decide who shares a table: anneal swaps between tables, rebuild chunks there too, or skip it (to polish a seating whose tables you already like)',
        type: 'select',
        options: [
          { value: 'anneal', label: 'Annealing' },
          { value: 'lns', label: 'Rebuild chunks' },
          { value: 'none', label: 'Skip' },
        ],
        default: 'anneal',
      },
      { key: 'tableShare', label: 'Share spent on tables', help: 'Fraction of the work spent deciding who shares a table; the rest rebuilds seats. Capped at about a million steps, which is plenty for the table split', type: 'number', min: 0, max: 0.9, step: 0.05, default: 0.4 },
      { key: 'tableTemp', label: 'Table stage heat', help: 'Start temperature of the table stage, as a multiple of a typical bad move. Higher explores more splits', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      {
        key: 'seatScope',
        label: 'After the table stage',
        help: 'Keep the table split and only rebuild seat order within each table, or let rebuilds still move guests between tables',
        type: 'select',
        options: [
          { value: 'sameTable', label: 'Keep tables' },
          { value: 'any', label: 'Allow table changes' },
        ],
        default: 'sameTable',
      },
      { key: 'destroyMin', label: 'Smallest chunk', help: 'Fewest guests pulled out per rebuild (couples come along, so it can be a few more)', type: 'number', min: 2, max: 30, step: 1, default: 4 },
      { key: 'destroyMax', label: 'Largest chunk', help: 'Most guests pulled out per rebuild. Bigger chunks make bolder changes but each rebuild costs more', type: 'number', min: 2, max: 40, step: 1, default: 14 },
      {
        key: 'repair',
        label: 'Rebuild',
        help: 'Greedy seats guests in random order, each in their best free seat; regret seats first whoever has the most to lose by waiting (slower, smarter)',
        type: 'select',
        options: [
          { value: 'greedy', label: 'Greedy' },
          { value: 'regret', label: 'Regret' },
        ],
        default: 'greedy',
      },
      { key: 'exactSize', label: 'Exact reorder size', help: 'One rebuild type tries every seating order of this many nearby guests and keeps the best. 6 tries 720 orders; 0 turns it off', type: 'number', min: 0, max: 8, step: 1, default: 0 },
      { key: 'noise', label: 'Rebuild noise', help: 'Random points added to each seat’s value while rebuilding, so rebuilds vary. Higher explores more', type: 'number', min: 0, max: 5, step: 0.1, default: 0 },
      { key: 'polish', label: 'Hill climb per guest', help: 'Swaps tried after each rebuild, per guest pulled out. More tidies each rebuild better but leaves fewer rebuilds', type: 'number', min: 0, max: 200, step: 1, default: 20 },
      {
        key: 'acceptance',
        label: 'Keep a rebuild when',
        help: 'Annealing keeps worse rebuilds now and then (less often as it cools); record-to-record keeps any within the threshold of the best; better-only never goes backwards',
        type: 'select',
        options: [
          { value: 'anneal', label: 'Annealing' },
          { value: 'recordToRecord', label: 'Record-to-record' },
          { value: 'better', label: 'Better or equal only' },
        ],
        default: 'anneal',
      },
      { key: 't0', label: 'Start temperature', help: 'How many points worse a rebuild can be and still be kept at the start of the seat stage. Higher explores more', type: 'number', min: 0.01, max: 50, step: 0.1, default: 10 },
      { key: 't1', label: 'End temperature', help: 'The same at the end of the run. Lower settles into the best region found', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      { key: 'reaction', label: 'Adaptivity', help: 'How fast the choice of chunk type follows recent success. 0 picks every type equally often', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
      { key: 'blockMoveRate', label: 'Couple moves', help: 'Share of hill-climb moves that move a must-sit-next-to couple together', type: 'number', min: 0, max: 0.5, step: 0.05, default: 0.2 },
    ],
  },
  create: (problem, guestAt, locked, params, seed) => new LnsSolver(problem, guestAt, locked, params, seed),
  // The table stage stops paying off after about a million evaluations, so long runs give the rest to seats
  scale: (params, evaluations) => {
    const e = Math.max(1000, Math.floor(evaluations))
    return { ...params, maxEvaluations: e, tableShare: Math.min(num(params, 'tableShare', 0.4), Math.max(0.05, TABLE_STAGE_CAP / e)) }
  },
}
