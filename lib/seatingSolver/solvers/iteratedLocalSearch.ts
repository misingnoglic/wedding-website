// Iterated local search over seat order. First decide who shares a table (as in twoStage), then
// repeatedly kick each table's seating, re-optimize it, and keep the result if it's good enough.
// With the tables fixed, each table scores independently, so every table keeps its own accepted
// seating and its own best: a round that improves one table and spoils another keeps the good half.

import { AlgorithmPlugin, autoTemperature, blockMoveParam, Moves, num, Params, proposeMove, RECOMPUTE_EVERY, Solver, SolverProgress } from '../core'
import { Problem, tableLevelProblem } from '../problem'
import { mulberry32, randInt, Rng, shuffleAt } from '../random'
import { Scorer } from '../scorer'

const EPS = 1e-9
const SPLIT_ANNEAL_SHARE = 0.2 // Share of the table stage spent annealing before the split search starts kicking
const SPLIT_PATIENCE = 1500 // Table-level moves without a gain before the split search kicks again
const KICKS = ['swaps', 'segment', 'section', 'mixed'] as const
type KickKind = (typeof KICKS)[number]

class IteratedLocalSearchSolver implements Solver {
  private readonly p: Problem
  private readonly scorer: Scorer
  private readonly tableScorer: Scorer
  private readonly moves: Moves // Pair moves always carry a must-sit-next-to couple
  private readonly rng: Rng
  private evals = 0
  private finished = false

  // Stage one: who shares a table
  private readonly tableEvaluations: number
  private readonly tableT0: number
  private readonly bestSplitAt: Int32Array
  private bestSplitScore: number
  private splitDone = false
  private readonly splitAnnealEvaluations: number
  private readonly splitKickMax: number
  private readonly homeSplitAt: Int32Array
  private homeSplitScore = -Infinity
  private splitStale = 0
  private splitKicks = 0
  private splitKicksPaid = 0

  // Stage two: per-table scores, relative to the seating stage two started from
  private readonly seatsOf: Int32Array[] // Movable seats per table
  private readonly cur: Float64Array
  private readonly home: Float64Array // Accepted local optimum per table, which the next kick starts from
  private readonly bestOf: Float64Array
  private readonly homeAt: Int32Array
  private readonly bestAt: Int32Array
  private bestScore: number
  private base = 0
  private readonly strength: Int32Array
  private readonly sinceBest: Int32Array

  // Current climb: an anneal of `roundLength` moves, or a scan until nothing near a change helps
  private roundIt = 0
  private roundLength = 0
  private roundT0 = 0
  private roundT1 = 0
  private scanning = false
  private temperature = 0

  // Scan state: seats still to check, as a ring buffer
  private readonly queue: Int32Array
  private readonly queued: Uint8Array
  private head = 0
  private size = 0
  private readonly near: Int32Array[] // Seats close enough that a change at one can open a move at the other
  private readonly beside: Int32Array[] // Movable seats right next to each seat, for pair moves
  private readonly blocksOf: [number, number][][] // Neighboring seat pairs per table
  private readonly isMovable: Uint8Array
  private readonly partners: number[][] // Per guest: guests they have a hard constraint with
  private readonly rows: Int32Array[][] // Per table, its long sides in order along the table

  private kicks = 0
  private acceptedKicks = 0
  private optima = 0
  private rounds = 0

  private readonly maxEvaluations: number
  private readonly firstEvaluations: number
  private readonly t0: number
  private readonly t1: number
  private readonly climb: 'anneal' | 'scan'
  private readonly refineIterations: number
  private readonly refineT0: number
  private readonly refineT1: number
  private readonly blockMoveRate: number
  private readonly kick: KickKind
  private readonly kickMin: number
  private readonly kickMax: number
  private readonly acceptance: 'better' | 'equal' | 'anneal'
  private readonly acceptT0: number
  private readonly acceptT1: number
  private readonly restartAfter: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.p = problem
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked, 1)
    this.scorer = new Scorer(problem, guestAt)
    this.tableScorer = new Scorer(tableLevelProblem(problem), guestAt)
    this.maxEvaluations = Math.max(2, num(params, 'maxEvaluations', 2_000_000))
    this.tableEvaluations = Math.max(1, Math.floor(num(params, 'tableShare', 0.15) * this.maxEvaluations))
    this.splitAnnealEvaluations = params.splitSearch !== 'anneal' ? Math.max(1, Math.floor(this.tableEvaluations * SPLIT_ANNEAL_SHARE)) : this.tableEvaluations
    this.splitKickMax = Math.max(2, num(params, 'splitKickMax', 10))
    this.firstEvaluations = Math.floor(num(params, 'seatShare', 0) * this.maxEvaluations)
    this.t0 = num(params, 't0', 3)
    this.t1 = Math.min(num(params, 't1', 0.3), this.t0)
    this.climb = params.climb === 'scan' ? 'scan' : 'anneal'
    this.refineIterations = Math.max(1, num(params, 'refineIterations', 100_000))
    this.refineT0 = num(params, 'refineT0', 2)
    this.refineT1 = Math.min(num(params, 'refineT1', 0.1), this.refineT0)
    this.blockMoveRate = num(params, 'blockMoveRate', 0.3)
    this.kick = KICKS.find((k) => k === params.kick) ?? 'section'
    this.kickMin = Math.max(1, num(params, 'kickMin', 2))
    this.kickMax = Math.max(this.kickMin, num(params, 'kickMax', 6))
    this.acceptance = params.acceptance === 'better' ? 'better' : params.acceptance === 'equal' ? 'equal' : 'anneal'
    this.acceptT0 = num(params, 'acceptT0', 1)
    this.acceptT1 = Math.min(num(params, 'acceptT1', 0.05), this.acceptT0)
    this.restartAfter = Math.max(1, num(params, 'restartAfter', 50))

    this.tableT0 = autoTemperature(this.tableScorer, this.moves, this.rng, 'crossTable')
    this.bestSplitAt = Int32Array.from(this.scorer.guestAt)
    this.bestSplitScore = this.tableScorer.total
    this.bestAt = Int32Array.from(this.scorer.guestAt)
    this.bestScore = this.scorer.total
    this.homeAt = Int32Array.from(this.scorer.guestAt)
    this.homeSplitAt = Int32Array.from(this.scorer.guestAt)

    const { S, P, adjacent, seats, layout } = problem
    const T = layout.tables
    this.isMovable = Uint8Array.from({ length: S }, (_, s) => (locked[s] ? 0 : 1))
    this.seatsOf = Array.from({ length: T }, (_, t) => this.moves.movable.filter((s) => problem.tableOf[s] === t))
    this.cur = new Float64Array(T)
    this.home = new Float64Array(T)
    this.bestOf = new Float64Array(T)
    this.strength = new Int32Array(T).fill(this.kickMin)
    this.sinceBest = new Int32Array(T)
    this.near = Array.from({ length: S }, (_, a) => {
      const list: number[] = []
      for (let c = 0; c < S; c++) if (c !== a && !locked[c] && (P[a * S + c] >= 0.3 || adjacent[a * S + c])) list.push(c)
      return Int32Array.from(list)
    })
    this.beside = Array.from({ length: S }, (_, a) => {
      const list: number[] = []
      for (let c = 0; c < S; c++) if (c !== a && !locked[c] && adjacent[a * S + c]) list.push(c)
      return Int32Array.from(list)
    })
    this.blocksOf = Array.from({ length: T }, (_, t) => this.moves.blocks.filter(([a]) => problem.tableOf[a] === t))
    this.partners = Array.from({ length: problem.n }, () => [])
    for (const c of problem.pairs) {
      this.partners[c.x].push(c.y)
      this.partners[c.y].push(c.x)
    }
    this.rows = Array.from({ length: T }, (_, t) =>
      (['L', 'R'] as const).map((side) =>
        Int32Array.from(
          seats
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.table === t && s.side === side)
            .sort((x, y) => x.s.index - y.s.index)
            .map(({ i }) => i)
        )
      )
    )
    this.queue = new Int32Array(S)
    this.queued = new Uint8Array(S)
  }

  step(budget: number) {
    const target = this.evals + budget
    while (this.evals < target && !this.finished) {
      const before = this.evals
      if (!this.splitDone) this.tableMove()
      else if (this.scanning) {
        if (this.size > 0) this.scanSeat(this.pop())
        else this.endRound()
      } else {
        this.roundIt++
        this.temperature = this.roundT0 * Math.pow(this.roundT1 / this.roundT0, this.roundIt / this.roundLength)
        this.annealMove(this.temperature)
        if (this.roundIt >= this.roundLength) this.endRound()
      }
      if (Math.floor(before / RECOMPUTE_EVERY) !== Math.floor(this.evals / RECOMPUTE_EVERY)) {
        this.scorer.recompute()
        this.tableScorer.recompute()
      }
      if (this.evals >= this.maxEvaluations) this.finish()
    }
  }

  // ---- Stage one: anneal the table split on the table-level objective, as twoStage does

  private tableMove() {
    const ts = this.tableScorer
    this.evals++
    if (this.evals <= this.splitAnnealEvaluations) {
      const t = this.tableT0 * Math.pow(0.001, this.evals / this.splitAnnealEvaluations)
      const move = proposeMove(ts, this.moves, this.rng, this.blockMoveRate, 'crossTable')
      if (move && !(move.delta >= 0 || this.rng() < Math.exp(move.delta / t))) move.undo()
      else this.noteSplit()
      if (this.evals === this.splitAnnealEvaluations && this.splitAnnealEvaluations < this.tableEvaluations) {
        // From here on, iterated local search on the split: start from the best split so far
        ts.load(this.bestSplitAt)
        this.evals += this.p.n
        this.homeSplitAt.set(ts.guestAt)
        this.homeSplitScore = ts.total
        this.kickSplit()
      }
    } else {
      // Hill climb (sideways moves allowed) until it stalls, then keep or undo, and kick again
      const move = proposeMove(ts, this.moves, this.rng, this.blockMoveRate, 'crossTable')
      if (move && move.delta > EPS) {
        this.splitStale = 0
        this.noteSplit()
      } else {
        this.splitStale++
        if (move && move.delta < -EPS) move.undo()
      }
      if (this.splitStale >= SPLIT_PATIENCE) {
        if (ts.total >= this.homeSplitScore - EPS) {
          if (ts.total > this.homeSplitScore + EPS) this.splitKicksPaid++
          this.homeSplitAt.set(ts.guestAt)
          this.homeSplitScore = ts.total
        } else {
          ts.load(this.homeSplitAt)
          this.evals += this.p.n
        }
        this.kickSplit()
      }
    }
    if (this.evals >= this.tableEvaluations) this.startSeatStage()
  }

  private noteSplit() {
    if (this.tableScorer.total > this.bestSplitScore + EPS) {
      this.bestSplitScore = this.tableScorer.total
      this.bestSplitAt.set(this.tableScorer.guestAt)
    }
  }

  // A friend cluster from one table trades places with an equal-size cluster from another: the move
  // annealing struggles with, since moving a group one person at a time gets worse before it gets better
  private kickSplit() {
    const ts = this.tableScorer
    const { rng } = this
    const T = this.seatsOf.length
    this.splitStale = 0
    this.splitKicks++
    if (T < 2) return
    const size = 2 + randInt(rng, Math.max(1, this.splitKickMax - 1))
    const t1 = randInt(rng, T)
    let t2 = randInt(rng, T - 1)
    if (t2 >= t1) t2++
    const c1 = this.growCluster(t1, size)
    const c2 = this.growCluster(t2, c1.length)
    const len = Math.min(c1.length, c2.length)
    for (let i = 0; i < len; i++) {
      ts.applySwap(ts.seatOf[c1[i]], ts.seatOf[c2[i]])
      this.evals++
    }
  }

  // Up to `size` guests at table t, grown from a random guest by repeatedly adding whoever likes the
  // cluster most (a must-sit-together partner counts as liking it a lot)
  private growCluster(t: number, size: number): number[] {
    const { n, A } = this.p
    const ts = this.tableScorer
    const pool = this.seatsOf[t].map((s) => ts.guestAt[s]).filter((g) => g < n)
    if (pool.length === 0) return []
    const cluster = [pool[randInt(this.rng, pool.length)]]
    const pull = new Float64Array(n)
    while (cluster.length < Math.min(size, pool.length)) {
      const last = cluster[cluster.length - 1]
      for (const k of this.partners[last]) pull[k] += 1000
      let best = -1
      for (const g of pool) {
        pull[g] += A[last * n + g]
        if (!cluster.includes(g) && (best === -1 || pull[g] > pull[best])) best = g
      }
      cluster.push(best)
    }
    this.evals += Math.ceil((cluster.length * pool.length) / n)
    return cluster
  }

  private startSeatStage() {
    this.splitDone = true
    this.scorer.load(this.bestSplitAt)
    this.base = this.scorer.total
    this.homeAt.set(this.scorer.guestAt)
    this.bestAt.set(this.scorer.guestAt)
    this.bestScore = this.base
    if (this.firstEvaluations > 0) this.startAnneal(this.firstEvaluations, this.t0, this.t1)
    else this.startClimb()
  }

  // ---- Stage two: climbs within tables. Every move stays inside one table, so its delta is that table's

  private credit(t: number, delta: number) {
    this.cur[t] += delta
    if (this.cur[t] > this.bestOf[t] + EPS) {
      this.bestOf[t] = this.cur[t]
      for (const s of this.seatsOf[t]) this.bestAt[s] = this.scorer.guestAt[s]
      this.bestScore = this.base + this.bestOf.reduce((sum, v) => sum + v, 0)
      this.sinceBest[t] = 0
    }
  }

  private startAnneal(length: number, t0: number, t1: number) {
    this.scanning = false
    this.roundIt = 0
    this.roundLength = Math.max(1, length)
    this.roundT0 = t0
    this.roundT1 = t1
  }

  private startClimb() {
    if (this.climb === 'anneal') {
      this.startAnneal(this.refineIterations, this.refineT0, this.refineT1)
      return
    }
    this.scanning = true
    // Seats near the last kick are already queued; on the first climb, everyone is
    if (this.rounds === 0) {
      const order = Int32Array.from(this.moves.movable)
      shuffleAt(order, Int32Array.from(order.keys()), this.rng)
      for (const s of order) this.push(s)
    }
  }

  private annealMove(temperature: number) {
    const { scorer, rng, moves } = this
    const tableOf = this.p.tableOf
    if (rng() < this.blockMoveRate) {
      const blocks = moves.pickBlocks(rng, 'sameTable', scorer.seatOf)
      if (blocks) {
        const [a1, b1, a2, b2] = blocks
        this.evals++
        const delta = scorer.applySwap(a1, b1) + scorer.applySwap(a2, b2)
        if (delta >= 0 || rng() < Math.exp(delta / temperature)) this.credit(tableOf[a1], delta)
        else {
          scorer.applySwap(a2, b2)
          scorer.applySwap(a1, b1)
        }
        return
      }
    }
    const pair = moves.pick(rng, scorer.guestAt, 'sameTable')
    this.evals++
    if (!pair) return
    const delta = scorer.applySwap(pair[0], pair[1])
    if (delta >= 0 || rng() < Math.exp(delta / temperature)) this.credit(tableOf[pair[0]], delta)
    else scorer.applySwap(pair[0], pair[1])
  }

  private push(s: number) {
    if (this.queued[s]) return
    this.queued[s] = 1
    this.queue[(this.head + this.size) % this.queue.length] = s
    this.size++
  }

  private pop(): number {
    const s = this.queue[this.head]
    this.head = (this.head + 1) % this.queue.length
    this.size--
    this.queued[s] = 0
    return s
  }

  // Something changed at seat s: recheck it, its neighbors, and wherever its occupant's partners sit
  private touch(s: number) {
    this.push(s)
    for (const c of this.near[s]) this.push(c)
    const g = this.scorer.guestAt[s]
    if (g < this.p.n) for (const k of this.partners[g]) if (this.isMovable[this.scorer.seatOf[k]]) this.push(this.scorer.seatOf[k])
  }

  // Guests worth moving as a pair: they like each other or must sit together
  private linked(x: number, y: number): boolean {
    const { n, A } = this.p
    if (x >= n || y >= n) return false
    return A[x * n + y] > 0 || this.partners[x].includes(y)
  }

  // Tries every same-table swap and pair move involving seat a, from a random starting point, and
  // keeps the first one that helps
  private scanSeat(a: number) {
    const { scorer, p, rng } = this
    const { guestAt } = scorer
    const t = p.tableOf[a]
    const seats = this.seatsOf[t]
    const m = seats.length
    const offset = randInt(rng, m)
    for (let i = 0; i < m; i++) {
      const b = seats[(offset + i) % m]
      if (b === a || (guestAt[a] >= p.n && guestAt[b] >= p.n)) continue
      this.evals++
      const delta = scorer.applySwap(a, b)
      if (delta > EPS) {
        this.credit(t, delta)
        this.touch(a)
        this.touch(b)
        return
      }
      scorer.applySwap(a, b)
    }
    const blocks = this.blocksOf[t]
    const nb = blocks.length
    for (const a2 of this.beside[a]) {
      if (!this.linked(guestAt[a], guestAt[a2])) continue
      const start = randInt(rng, nb)
      for (let i = 0; i < nb; i++) {
        const [b1, b2] = blocks[(start + i) % nb]
        if (b1 === a || b1 === a2 || b2 === a || b2 === a2) continue
        for (let flip = 0; flip < 2; flip++) {
          const x = flip ? b2 : b1
          const y = flip ? b1 : b2
          this.evals++
          const delta = scorer.applySwap(a, x) + scorer.applySwap(a2, y)
          if (delta > EPS) {
            this.credit(t, delta)
            this.touch(a)
            this.touch(a2)
            this.touch(x)
            this.touch(y)
            return
          }
          scorer.applySwap(a2, y)
          scorer.applySwap(a, x)
        }
      }
    }
  }

  // A climb ended at a local optimum: each table keeps it or goes back to its last accepted seating,
  // then gets kicked
  private endRound() {
    this.rounds++
    this.optima++
    const f = Math.min(1, this.evals / this.maxEvaluations)
    const temperature = this.acceptT0 * Math.pow(this.acceptT1 / this.acceptT0, f)
    let reload = false
    for (let t = 0; t < this.seatsOf.length; t++) {
      if (this.seatsOf[t].length < 2) continue
      this.sinceBest[t]++
      const diff = this.cur[t] - this.home[t]
      let accept = this.rounds === 1 || diff > EPS
      if (!accept && this.acceptance !== 'better') accept = diff >= -EPS
      if (!accept && this.acceptance === 'anneal') accept = this.rng() < Math.exp(diff / temperature)
      if (accept) {
        if (this.rounds > 1) this.acceptedKicks++
        this.strength[t] = diff > EPS ? this.kickMin : Math.min(this.kickMax, this.strength[t] + 1)
        this.home[t] = this.cur[t]
        for (const s of this.seatsOf[t]) this.homeAt[s] = this.scorer.guestAt[s]
      } else {
        this.strength[t] = Math.min(this.kickMax, this.strength[t] + 1)
        reload = true
      }
      if (this.sinceBest[t] >= this.restartAfter) {
        // Stuck for a long time: this table goes back to its best seating
        this.sinceBest[t] = 0
        this.home[t] = this.bestOf[t]
        for (const s of this.seatsOf[t]) this.homeAt[s] = this.bestAt[s]
        this.strength[t] = this.kickMin
        reload = true
      }
    }
    if (reload) {
      this.scorer.load(this.homeAt)
      this.evals += this.p.n
    }
    this.cur.set(this.home)
    for (let t = 0; t < this.seatsOf.length; t++) if (this.seatsOf[t].length >= 2) this.applyKick(t)
    this.startClimb()
  }

  private swapSeats(t: number, a: number, b: number) {
    if (this.scorer.guestAt[a] >= this.p.n && this.scorer.guestAt[b] >= this.p.n) return
    this.cur[t] += this.scorer.applySwap(a, b)
    this.evals++
    if (this.climb === 'scan') {
      this.touch(a)
      this.touch(b)
    }
  }

  private applyKick(t: number) {
    this.kicks++
    const kind = this.kick === 'mixed' ? KICKS[randInt(this.rng, 3)] : this.kick
    const k = this.strength[t]
    if (kind === 'swaps') this.kickSwaps(t, k)
    else if (kind === 'segment') this.kickSegment(t, k)
    else this.kickSection(t, k)
  }

  // k random swaps or couple moves within table t
  private kickSwaps(t: number, k: number) {
    const { rng } = this
    const seats = this.seatsOf[t]
    const blocks = this.blocksOf[t]
    for (let i = 0; i < k; i++) {
      if (blocks.length >= 2 && rng() < this.blockMoveRate) {
        const [a1, a2] = blocks[randInt(rng, blocks.length)]
        const [b1, b2] = blocks[randInt(rng, blocks.length)]
        if (a1 !== b1 && a1 !== b2 && a2 !== b1 && a2 !== b2) {
          this.swapSeats(t, a1, b1)
          this.swapSeats(t, a2, b2)
          continue
        }
      }
      const a = seats[randInt(rng, seats.length)]
      const b = seats[randInt(rng, seats.length)]
      if (a !== b) this.swapSeats(t, a, b)
    }
  }

  // Double-bridge style: two stretches of k seats along table t's sides trade places, each keeping
  // its order (or reversed), so neighbors inside a stretch stay neighbors
  private kickSegment(t: number, k: number) {
    const { rng } = this
    const rows = this.rows[t]
    const movable = (s: number) => this.isMovable[s] === 1
    for (let tries = 0; tries < 20; tries++) {
      const r1 = rows[randInt(rng, rows.length)]
      const r2 = rows[randInt(rng, rows.length)]
      const len = Math.min(k, r1.length, r2.length)
      const o1 = randInt(rng, r1.length - len + 1)
      const o2 = randInt(rng, r2.length - len + 1)
      if (r1 === r2 && Math.abs(o1 - o2) < len) continue
      let ok = true
      for (let i = 0; i < len; i++) if (!movable(r1[o1 + i]) || !movable(r2[o2 + i])) ok = false
      if (!ok) continue
      const reverse = rng() < 0.5
      for (let i = 0; i < len; i++) this.swapSeats(t, r1[o1 + i], r2[o2 + (reverse ? len - 1 - i : i)])
      return
    }
    this.kickSwaps(t, k)
  }

  // Shuffles a stretch k places long across both sides of table t
  private kickSection(t: number, k: number) {
    const { rng } = this
    const [L, R] = this.rows[t]
    const len = Math.min(k, L.length, R.length)
    const o = randInt(rng, L.length - len + 1)
    const seats: number[] = []
    for (let i = 0; i < len; i++) for (const s of [L[o + i], R[o + i]]) if (this.isMovable[s]) seats.push(s)
    // Fisher-Yates through real swaps so the scores stay current
    for (let i = seats.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1)
      if (i !== j) this.swapSeats(t, seats[i], seats[j])
    }
  }

  private finish() {
    this.finished = true
    if (!this.splitDone) {
      // Out of budget before seat order: the best split as it stands
      this.scorer.load(this.bestSplitAt)
      if (this.scorer.total > this.bestScore) {
        this.bestScore = this.scorer.total
        this.bestAt.set(this.scorer.guestAt)
      }
      return
    }
    // The tables' bests were tracked by deltas; score the combined seating exactly
    this.bestScore = new Scorer(this.p, this.bestAt).total
  }

  progress(): SolverProgress {
    // During stage one, score the table split as seated so the chart stays comparable
    if (!this.splitDone && !this.finished) {
      this.scorer.load(this.tableScorer.guestAt)
      if (this.scorer.total > this.bestScore + EPS) {
        this.bestScore = this.scorer.total
        this.bestAt.set(this.scorer.guestAt)
      }
    }
    const stage = !this.splitDone ? '1 · Who shares a table' : this.rounds === 0 && this.firstEvaluations > 0 ? '2 · First seat-order anneal' : '3 · Kick and climb'
    return {
      evaluations: this.evals,
      current: this.scorer.total,
      best: this.bestScore,
      done: this.finished,
      metrics: {
        Stage: stage,
        'Table-level score': this.bestSplitScore,
        'Split kicks': `${this.splitKicksPaid} / ${this.splitKicks} paid off`,
        Kicks: this.kicks,
        'Kicks accepted': this.acceptedKicks,
        'Kick strength': Array.from(this.strength).join(' / '),
        'Local optima found': this.optima,
        ...(this.scanning ? { 'Seats to check': this.size } : { Temperature: this.temperature }),
      },
    }
  }

  current() {
    return this.scorer.guestAt
  }

  best() {
    return this.bestAt
  }
}

export const iteratedLocalSearch: AlgorithmPlugin<'iteratedLocalSearch'> = {
  spec: {
    id: 'iteratedLocalSearch',
    name: 'Iterated local search',
    description:
      'Decides who shares a table, then repeatedly shakes up each table’s seat order and re-optimizes it, keeping each table’s new arrangement if it’s good enough.',
    params: [
      { key: 'maxEvaluations', label: 'Total swaps tried', help: 'Budget for the whole search, kicks and climbs included', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'tableShare', label: 'Share spent on tables', help: 'Fraction of the budget spent deciding who shares a table. Too little and a friend group can end up split across tables', type: 'number', min: 0.05, max: 0.9, step: 0.05, default: 0.15 },
      {
        key: 'splitSearch',
        label: 'Table search',
        help: 'How to decide who shares a table. Group kicks anneal briefly, then keep trading whole friend groups between tables, which finds the best split far more reliably than annealing alone',
        type: 'select',
        options: [
          { value: 'kicks', label: 'Anneal, then trade friend groups' },
          { value: 'anneal', label: 'Anneal only (as two-stage)' },
        ],
        default: 'kicks',
      },
      { key: 'splitKickMax', label: 'Largest group traded', help: 'Table search: the most guests in a friend group traded between tables in one kick', type: 'number', min: 2, max: 30, step: 1, default: 10 },
      { key: 'seatShare', label: 'Share on first seat anneal', help: 'Fraction spent on one long anneal of seat order before the kicks start. Zero starts kicking straight away, which works as well here', type: 'number', min: 0, max: 0.9, step: 0.05, default: 0 },
      { key: 't0', label: 'First anneal start temp', help: 'Starting temperature for the first seat-order anneal', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 't1', label: 'First anneal end temp', help: 'Final temperature for the first seat-order anneal', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      {
        key: 'climb',
        label: 'Climb after each kick',
        help: 'A short anneal can climb out of small dips; a scan checks every swap and pair move near what changed and stops at the first local optimum',
        type: 'select',
        options: [
          { value: 'anneal', label: 'Short anneal' },
          { value: 'scan', label: 'Systematic scan' },
        ],
        default: 'anneal',
      },
      { key: 'refineIterations', label: 'Short anneal length', help: 'Swaps per short anneal. Longer climbs further from each kick but leaves time for fewer kicks', type: 'number', min: 1000, max: 2_000_000, step: 1000, default: 100_000 },
      { key: 'refineT0', label: 'Short anneal start temp', help: 'Starting temperature for each short anneal. Higher wanders further from the kicked seating', type: 'number', min: 0.01, max: 20, step: 0.01, default: 2 },
      { key: 'refineT1', label: 'Short anneal end temp', help: 'Final temperature for each short anneal', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.1 },
      { ...blockMoveParam, default: 0.3, help: 'Share of moves that move a must-sit-next-to couple together, in every stage' },
      {
        key: 'kick',
        label: 'Kick',
        help: 'How to shake up a table: random swaps, two stretches of seats trading places, or shuffling a stretch of the table',
        type: 'select',
        options: [
          { value: 'segment', label: 'Trade two stretches' },
          { value: 'swaps', label: 'Random swaps' },
          { value: 'section', label: 'Shuffle a stretch' },
          { value: 'mixed', label: 'A mix of all three' },
        ],
        default: 'section',
      },
      { key: 'kickMin', label: 'Gentlest kick', help: 'Kick size after a kick that paid off: swaps, or places per stretch', type: 'number', min: 1, max: 20, step: 1, default: 2 },
      { key: 'kickMax', label: 'Strongest kick', help: 'Each kick that doesn’t pay off makes that table’s next one a step bigger, up to this', type: 'number', min: 1, max: 30, step: 1, default: 6 },
      {
        key: 'acceptance',
        label: 'Keep a table’s new seating if',
        help: 'Which new local optima replace the one being kicked. Allowing some worse ones lets the search wander',
        type: 'select',
        options: [
          { value: 'anneal', label: 'Better, or worse by chance' },
          { value: 'equal', label: 'At least as good' },
          { value: 'better', label: 'Strictly better' },
        ],
        default: 'anneal',
      },
      { key: 'acceptT0', label: 'Acceptance start temp', help: '“Worse by chance” only: a seating this many points worse is kept about 37% of the time at the start', type: 'number', min: 0.01, max: 20, step: 0.01, default: 1 },
      { key: 'acceptT1', label: 'Acceptance end temp', help: '“Worse by chance” only: the same, by the end of the run', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.05 },
      { key: 'restartAfter', label: 'Back to best after', help: 'Kicks without a new best before a table jumps back to its best seating', type: 'number', min: 1, max: 10_000, step: 1, default: 50 },
    ],
  },
  create: (problem, guestAt, locked, params, seed) => new IteratedLocalSearchSolver(problem, guestAt, locked, params, seed),
  // The stages are shares of the budget, so only the budget changes; short anneals are capped at a
  // tenth of it so a small budget still gets several kicks
  scale: (params, evaluations) => {
    const e = Math.max(1000, Math.floor(evaluations))
    return { ...params, maxEvaluations: e, refineIterations: Math.max(1000, Math.min(num(params, 'refineIterations', 100_000), Math.floor(e / 10))) }
  },
}
