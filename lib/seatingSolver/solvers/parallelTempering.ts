// Parallel tempering (replica exchange): several copies of the seating search run side by side at
// a ladder of temperatures. Hot copies wander freely, cold ones refine, and neighbors on the ladder
// periodically trade seatings, so a good arrangement found while hot drifts down to be polished.
//
// Like two-stage, it first settles who shares a table (a ladder on the table-level problem, which
// finds the best split far more reliably than one anneal), then tempers seat order within tables.
// With the split fixed, each table scores independently, so copies trade one table at a time and
// the best arrangement of each table is kept separately and combined at the end.

import { AlgorithmPlugin, autoTemperature, Moves, num, Params, RECOMPUTE_EVERY, Solver, SolverProgress } from '../core'
import { Problem, tableLevelProblem } from '../problem'
import { mulberry32, Rng } from '../random'
import { Scorer } from '../scorer'

/**
 * Each table's share of the objective. With the table split fixed, these always add up to the
 * total minus a constant (constraints across tables, which seat order can't change).
 */
export function tableScores(scorer: Scorer, out: Float64Array): Float64Array {
  const { n, pairs, mustHead, isHead, tableOf, objective } = scorer.p
  out.fill(0)
  for (let g = 0; g < n; g++) {
    const s = scorer.seatOf[g]
    out[tableOf[s]] += scorer.utility(g, scorer.h[g], scorer.known[g], s)
    if (mustHead[g] && !isHead[s]) out[tableOf[s]] -= objective.constraintPenalty
  }
  for (const c of pairs) {
    const t = tableOf[scorer.seatOf[c.x]]
    if (t === tableOf[scorer.seatOf[c.y]] && scorer.violated(c)) out[t] -= objective.constraintPenalty
  }
  return out
}

/**
 * A ladder of copies doing Metropolis moves in `scope`, coldest in slot 0. Whole copies trade
 * places by swapping slots, which is free. Within tables ('sameTable') each table scores on its own:
 * the best of each table is kept separately, and copies can trade a single table, which means
 * reloading both copies (about one swap per guest each).
 */
export class TemperingLadder {
  readonly replicas: Scorer[]
  readonly temps: Float64Array // Coldest first, before the end-of-run cooling
  private readonly scores: Float64Array[] // Per replica, per table, kept alongside replicas[]
  private readonly bestTable: Int32Array[] // Per table: a seating whose seats at that table are the best seen
  private readonly bestTableScore: Float64Array
  private readonly tableSeats: Int32Array[]
  private readonly constant: number
  private readonly perTable: boolean
  private readonly bestWhole: Int32Array
  private bestWholeScore: number
  private readonly tried: Float64Array // Trade attempts per rung (slot i with i + 1)
  private readonly traded: Float64Array
  private recentTried = 0
  private recentTraded = 0
  private it = 0
  private slot = 0 // Replica being stepped this round
  private inSlot = 0 // Moves it has made this round
  private parity = 0
  cool = 1 // Every temperature is multiplied by this
  extraWork = 0 // Swap-equivalents spent reloading copies after table trades, included in iterations

  constructor(
    problem: Problem,
    starts: Int32Array[],
    tMin: number,
    tMax: number,
    private readonly moves: Moves,
    private readonly rng: Rng,
    readonly iterations: number,
    private readonly exchangeEvery: number,
    private readonly blockMoveRate: number,
    private readonly finalCool: number, // The ladder ends at this fraction of its starting temperatures
    private readonly scope: 'sameTable' | 'crossTable',
    private readonly tradeTables: boolean
  ) {
    const k = starts.length
    const tables = problem.layout.tables
    this.perTable = scope === 'sameTable'
    this.replicas = starts.map((g) => new Scorer(problem, g))
    const start = starts[0]
    this.temps = Float64Array.from({ length: k }, (_, i) => (k === 1 ? tMin : tMin * Math.pow(tMax / tMin, i / (k - 1))))
    this.scores = this.replicas.map((r) => tableScores(r, new Float64Array(tables)))
    this.bestTable = Array.from({ length: tables }, () => Int32Array.from(start))
    this.bestTableScore = Float64Array.from(this.scores[0])
    this.tableSeats = Array.from({ length: tables }, (_, t) => Int32Array.from(moves.movable.filter((s) => problem.tableOf[s] === t)))
    this.constant = this.replicas[0].total - this.scores[0].reduce((a, b) => a + b, 0)
    this.tried = new Float64Array(Math.max(0, k - 1))
    this.traded = new Float64Array(Math.max(0, k - 1))
    const best = this.replicas.reduce((x, r) => (r.total > x.total ? r : x))
    this.bestWhole = Int32Array.from(best.guestAt)
    this.bestWholeScore = best.total
  }

  get done() {
    return this.it >= this.iterations
  }

  get coldest() {
    return this.replicas[0]
  }

  get bestScore() {
    return this.perTable ? this.constant + this.bestTableScore.reduce((a, b) => a + b, 0) : this.bestWholeScore
  }

  // The best seating; within tables, the best arrangement of every table put together
  bestAt(): Int32Array {
    if (!this.perTable) return this.bestWhole
    const out = Int32Array.from(this.bestTable[0])
    for (let t = 1; t < this.tableSeats.length; t++) for (const s of this.tableSeats[t]) out[s] = this.bestTable[t][s]
    return out
  }

  // Runs up to `budget` moves, spread round-robin over the replicas, and returns how many it ran
  step(budget: number): number {
    const { rng, replicas, moves, scope, perTable } = this
    const tableOf = replicas[0].p.tableOf
    const k = replicas.length
    let used = 0
    while (used < budget && this.it < this.iterations) {
      this.cool = Math.pow(this.finalCool, this.it / this.iterations)
      const scorer = replicas[this.slot]
      const scores = this.scores[this.slot]
      const t = this.temps[this.slot] * this.cool
      const run = Math.min(budget - used, this.iterations - this.it, this.exchangeEvery - this.inSlot)
      for (let i = 0; i < run; i++) {
        // A single swap or a pair move. Within tables, the change belongs to the table it's at
        const blocks = this.blockMoveRate > 0 && rng() < this.blockMoveRate ? moves.pickBlocks(rng, scope, scorer.seatOf) : null
        const pair = blocks ? null : moves.pick(rng, scorer.guestAt, scope)
        if (!blocks && !pair) continue
        const delta = blocks ? scorer.applySwap(blocks[0], blocks[1]) + scorer.applySwap(blocks[2], blocks[3]) : scorer.applySwap(pair![0], pair![1])
        if (delta >= 0 || rng() < Math.exp(delta / t)) {
          if (!perTable) {
            if (scorer.total > this.bestWholeScore + 1e-9) {
              this.bestWholeScore = scorer.total
              this.bestWhole.set(scorer.guestAt)
            }
            continue
          }
          const table = tableOf[blocks ? blocks[0] : pair![0]]
          scores[table] += delta
          if (scores[table] > this.bestTableScore[table] + 1e-9) {
            this.bestTableScore[table] = scores[table]
            this.bestTable[table].set(scorer.guestAt)
          }
        } else if (blocks) {
          scorer.applySwap(blocks[2], blocks[3])
          scorer.applySwap(blocks[0], blocks[1])
        } else {
          scorer.applySwap(pair![0], pair![1])
        }
      }
      const before = this.it
      used += run
      this.it += run
      this.inSlot += run
      if (Math.floor(this.it / RECOMPUTE_EVERY) !== Math.floor(before / RECOMPUTE_EVERY)) {
        replicas.forEach((r, i) => {
          r.recompute()
          if (perTable) tableScores(r, this.scores[i])
        })
      }
      if (this.inSlot < this.exchangeEvery) continue
      this.inSlot = 0
      this.slot++
      if (this.slot < k) continue
      this.slot = 0
      this.exchange()
    }
    return used
  }

  // Neighbors on the ladder try trading, alternating even and odd rungs. Maximizing, so energy is
  // −score and a trade is accepted with min(1, exp((Sb − Sa)(1/Ta − 1/Tb)))
  private exchange() {
    const { replicas, temps, scores, rng } = this
    for (let i = this.parity; i + 1 < replicas.length; i += 2) {
      const beta = 1 / (temps[i] * this.cool) - 1 / (temps[i + 1] * this.cool)
      if (!this.tradeTables || !this.perTable) {
        const x = (replicas[i + 1].total - replicas[i].total) * beta
        const accept = x >= 0 || rng() < Math.exp(x)
        this.count(i, accept)
        if (accept) this.swapSlots(i)
        continue
      }
      // Each table trades on its own score
      const a = replicas[i]
      const b = replicas[i + 1]
      let ga: Int32Array | null = null
      let gb: Int32Array | null = null
      for (let t = 0; t < this.tableSeats.length; t++) {
        const x = (scores[i + 1][t] - scores[i][t]) * beta
        const accept = x >= 0 || rng() < Math.exp(x)
        this.count(i, accept)
        if (!accept) continue
        ga ??= Int32Array.from(a.guestAt)
        gb ??= Int32Array.from(b.guestAt)
        for (const s of this.tableSeats[t]) {
          ga[s] = b.guestAt[s]
          gb[s] = a.guestAt[s]
        }
        const tmp = scores[i][t]
        scores[i][t] = scores[i + 1][t]
        scores[i + 1][t] = tmp
      }
      if (!ga || !gb) continue
      a.load(ga)
      b.load(gb)
      // Reloads come out of the stage's iterations so the schedule still fits the budget
      this.extraWork += 2 * a.p.n
      this.it += 2 * a.p.n
    }
    this.parity ^= 1
  }

  private count(rung: number, accepted: boolean) {
    this.tried[rung]++
    this.recentTried++
    if (accepted) {
      this.traded[rung]++
      this.recentTraded++
    }
  }

  private swapSlots(i: number) {
    const r = this.replicas[i]
    this.replicas[i] = this.replicas[i + 1]
    this.replicas[i + 1] = r
    const s = this.scores[i]
    this.scores[i] = this.scores[i + 1]
    this.scores[i + 1] = s
  }

  // Trade acceptance since the last call
  takeTradeRate(): number {
    const rate = this.recentTried ? this.recentTraded / this.recentTried : 0
    this.recentTried = 0
    this.recentTraded = 0
    return rate
  }

  rungRates(): string {
    return Array.from(this.tried, (t, i) => (t ? Math.round((100 * this.traded[i]) / t) : 0)).join(' · ')
  }
}

export class ParallelTemperingSolver implements Solver {
  private readonly seatScorer: Scorer // Scores stage one's split as seated, for the chart
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly tableStage: TemperingLadder
  private seatStage: TemperingLadder | null = null
  private bestScore: number
  private bestAt: Int32Array
  private evals = 0
  private tradeRate = 0
  private readonly stage2Iterations: number
  private readonly params: Params
  private readonly blockMoveRate: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    this.params = params
    this.blockMoveRate = num(params, 'blockMoveRate', 0.3)
    // Pair moves always carry a must-sit-next-to couple, so stage one can move couples between tables
    this.moves = new Moves(problem, locked, 1)
    this.seatScorer = new Scorer(problem, guestAt)
    const iterations = Math.max(2, num(params, 'iterations', 2_000_000))
    const share = Math.min(0.9, Math.max(0.05, num(params, 'stage1Share', 0.25)))
    const stage1Iterations = Math.round(iterations * share)
    this.stage2Iterations = iterations - stage1Iterations
    const tables = tableLevelProblem(problem)
    // Table-stage temperatures are relative to a typical worsening move there, like two-stage's
    const unit = autoTemperature(new Scorer(tables, guestAt), this.moves, this.rng, 'crossTable')
    const tMin = num(params, 'tableTMin', 0.3)
    // The coldest copy keeps the given seating; the rest start from their own shuffles
    const starts = Array.from({ length: Math.max(1, Math.round(num(params, 'tableReplicas', 4))) }, (_, i) => {
      const g = Int32Array.from(guestAt)
      if (i > 0) this.moves.shuffle(g, this.rng)
      return g
    })
    this.tableStage = new TemperingLadder(
      tables,
      starts,
      tMin * unit,
      Math.max(tMin, num(params, 'tableTMax', 2)) * unit,
      this.moves,
      this.rng,
      stage1Iterations,
      Math.max(1, Math.round(num(params, 'exchangeEvery', 500))),
      this.blockMoveRate,
      Math.min(1, Math.max(1e-4, num(params, 'tableFinalCool', 0.03))),
      'crossTable',
      false
    )
    this.bestAt = Int32Array.from(guestAt)
    this.bestScore = this.seatScorer.total
  }

  step(budget: number) {
    let left = budget
    while (left > 0 && !this.seatStage?.done) {
      const stage = this.seatStage ?? this.tableStage
      const extra = stage.extraWork
      const used = stage.step(left)
      const reloads = stage.extraWork - extra
      left -= used + reloads
      this.evals += used + reloads
      if (!this.seatStage && this.tableStage.done) this.startSeatStage()
    }
  }

  // Stage two tempers seat order on the best table split, every copy starting from it
  private startSeatStage() {
    const p = this.params
    const split = this.tableStage.bestAt()
    const tMin = num(p, 'tMin', 0.5)
    this.seatStage = new TemperingLadder(
      this.seatScorer.p,
      Array.from({ length: Math.max(1, Math.round(num(p, 'replicas', 8))) }, () => split),
      tMin,
      Math.max(tMin, num(p, 'tMax', 3)),
      this.moves,
      this.rng,
      this.stage2Iterations,
      Math.max(1, Math.round(num(p, 'exchangeEvery', 500))),
      this.blockMoveRate,
      Math.min(1, Math.max(1e-4, num(p, 'finalCool', 1))),
      'sameTable',
      p.tradeTables !== false
    )
  }

  // Picks up the seat stage's best, or scores stage one's coldest split as seated
  private refreshBest() {
    const stage = this.seatStage
    if (stage) {
      if (stage.bestScore > this.bestScore + 1e-9) {
        this.bestAt = stage.bestAt()
        this.bestScore = stage.bestScore
      }
      return
    }
    this.seatScorer.load(this.tableStage.coldest.guestAt)
    if (this.seatScorer.total > this.bestScore + 1e-9) {
      this.bestScore = this.seatScorer.total
      this.bestAt = Int32Array.from(this.seatScorer.guestAt)
    }
  }

  progress(): SolverProgress {
    this.refreshBest()
    const ladder = this.seatStage ?? this.tableStage
    this.tradeRate = ladder.takeTradeRate() || this.tradeRate
    const fmt = (x: number) => x.toFixed(1)
    return {
      evaluations: this.evals,
      current: this.seatStage ? this.seatStage.coldest.total : this.seatScorer.total,
      best: this.bestScore,
      done: !!this.seatStage?.done,
      metrics: {
        Stage: this.seatStage ? '2 · Seat order within tables' : '1 · Who shares a table',
        'Coldest temperature': ladder.temps[0] * ladder.cool,
        'Hottest temperature': ladder.temps[ladder.temps.length - 1] * ladder.cool,
        'Trade acceptance': this.tradeRate,
        'Trade % by rung (cold → hot)': ladder.rungRates(),
        [this.seatStage ? 'Copy scores (cold → hot)' : 'Copy table-level scores (cold → hot)']: ladder.replicas.map((r) => fmt(r.total)).join(' · '),
      },
    }
  }

  current() {
    return (this.seatStage ?? this.tableStage).coldest.guestAt
  }

  best() {
    this.refreshBest()
    return this.bestAt
  }
}

export const parallelTempering: AlgorithmPlugin<'parallelTempering'> = {
  spec: {
    id: 'parallelTempering',
    name: 'Parallel tempering',
    description:
      'Settles who shares a table, then runs several copies at different temperatures that trade tables; hot copies explore, cold ones refine, and the best of each table is kept.',
    params: [
      { key: 'iterations', label: 'Iterations', help: 'Swaps tried in total, across both stages and every copy', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'stage1Share', label: 'Share spent on tables', help: 'Fraction of iterations spent deciding who shares a table; the rest goes to seat order. Too little and it sometimes settles on a worse split', type: 'number', min: 0.05, max: 0.9, step: 0.05, default: 0.25 },
      { key: 'tableReplicas', label: 'Table stage copies', help: 'Copies searching for the table split, each from its own shuffle. 1 is plain annealing, like two-stage', type: 'number', min: 1, max: 32, step: 1, default: 4 },
      { key: 'tableTMin', label: 'Table stage coldest temp', help: 'Coldest table-stage copy, as a share of a typical worsening move there', type: 'number', min: 0.01, max: 5, step: 0.01, default: 0.3 },
      { key: 'tableTMax', label: 'Table stage hottest temp', help: 'Hottest table-stage copy, as a share of a typical worsening move. Higher explores more splits', type: 'number', min: 0.01, max: 5, step: 0.01, default: 2 },
      { key: 'tableFinalCool', label: 'Table stage final cooling', help: 'Cools the table ladder to this fraction of its temperatures by the end of the stage, so it finishes settled', type: 'number', min: 0.001, max: 1, step: 0.001, default: 0.03 },
      { key: 'replicas', label: 'Seat stage copies', help: 'Seatings searched side by side within tables, each at its own temperature. More copies cover the ladder more smoothly but each gets fewer swaps', type: 'number', min: 1, max: 32, step: 1, default: 8 },
      { key: 'tMin', label: 'Seat stage coldest temp', help: 'Temperature of the coldest seat-order copy. Surprisingly warm works best: the best of each table is kept anyway', type: 'number', min: 0.01, max: 5, step: 0.01, default: 0.5 },
      { key: 'tMax', label: 'Seat stage hottest temp', help: 'Temperature of the hottest seat-order copy. Higher explores more but its finds take longer to reach the cold end', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 'exchangeEvery', label: 'Swaps between trades', help: 'Swaps each copy tries before neighbors on the ladder try trading, in both stages. Lower trades more often', type: 'number', min: 1, max: 100_000, step: 1, default: 500 },
      { key: 'tradeTables', label: 'Trade single tables', help: 'Seat-order copies trade one table at a time instead of whole seatings. Trades succeed more often, at the cost of reloading both copies', type: 'boolean', default: true },
      { key: 'finalCool', label: 'Seat stage final cooling', help: 'Cools the seat-order ladder to this fraction of its temperatures by the end. 1 keeps it fixed; lower ends colder, like annealing', type: 'number', min: 0.01, max: 1, step: 0.01, default: 1 },
      { key: 'blockMoveRate', label: 'Pair moves', help: 'Share of moves that move a must-sit-next-to couple together. Without them couples get split and the score collapses', type: 'number', min: 0, max: 0.5, step: 0.05, default: 0.3 },
    ],
  },
  create: (problem, guestAt, locked, params, seed) => new ParallelTemperingSolver(problem, guestAt, locked, params, seed),
  // The table stage needs about 600k swaps to find the best split reliably whatever the budget, so
  // longer runs give it a smaller share and spend the rest on seat order
  scale: (params, evaluations) => {
    const iterations = Math.max(1000, Math.floor(evaluations))
    const share = Math.min(num(params, 'stage1Share', 0.25), Math.max(0.1, (num(params, 'stage1Share', 0.25) * 2_000_000) / iterations))
    return { ...params, iterations, stage1Share: Math.round(share * 1000) / 1000 }
  },
}
