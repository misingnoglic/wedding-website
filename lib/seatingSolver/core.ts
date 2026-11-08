// Core search algorithms over seatings and the move machinery other solvers build on. Each solver
// advances in small budgets so a runner can interleave work with progress updates; one unit of
// budget ≈ one swap evaluation (O(n)). algorithms.ts combines these with the solvers in their own files.

import { Problem, tableLevelProblem } from './problem'
import { mulberry32, randInt, Rng, shuffleAt } from './random'
import { Scorer } from './scorer'

export type CoreAlgorithmId = 'annealing' | 'hillClimbing' | 'tabu' | 'genetic' | 'twoStage'
export type ParamValue = number | string | boolean
export type Params = Record<string, ParamValue>

export type ParamSpec = {
  key: string
  label: string
  help?: string
  default: ParamValue
} & (
  | { type: 'number'; min: number; max: number; step: number }
  | { type: 'select'; options: { value: string; label: string }[] }
  | { type: 'boolean' }
)

export type AlgorithmSpec<Id extends string = string> = { id: Id; name: string; description: string; params: ParamSpec[] }

export const blockMoveParam: ParamSpec = {
  key: 'blockMoveRate',
  label: 'Pair moves',
  help: 'Share of moves that swap two neighboring pairs at once, so couples move together',
  type: 'number',
  min: 0,
  max: 0.5,
  step: 0.05,
  default: 0.1,
}

export const CORE_ALGORITHMS: AlgorithmSpec<CoreAlgorithmId>[] = [
  {
    id: 'annealing',
    name: 'Simulated annealing',
    description: 'Random swaps, accepting some bad ones while "hot" so it can escape local optima, then cooling down.',
    params: [
      { key: 'iterations', label: 'Iterations per run', help: 'Swaps tried in each run. More iterations cool more slowly and usually find better seatings', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'runs', label: 'Runs', help: 'How many times to anneal from start to finish; the best run wins', type: 'number', min: 1, max: 20, step: 1, default: 1 },
      { key: 't0', label: 'Start temperature', help: 'How willing it is to accept a worse swap at the start. A swap that costs this many points is accepted about 37% of the time', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 't1', label: 'End temperature', help: 'Temperature at the end of a run. Lower only accepts swaps that help; below about 0.1 it rarely finds anything new', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      {
        key: 'cooling',
        label: 'Cooling schedule',
        help: 'Geometric spends more time cool, fine-tuning; linear spends more time hot, exploring',
        type: 'select',
        options: [
          { value: 'geometric', label: 'Geometric' },
          { value: 'linear', label: 'Linear' },
        ],
        default: 'geometric',
      },
      { ...blockMoveParam, default: 0.25 },
      {
        key: 'restartFrom',
        label: 'Later runs start from',
        help: 'With more than one run: start each later run from a fresh shuffle, or reheat the best seating found so far',
        type: 'select',
        options: [
          { value: 'random', label: 'A fresh shuffle' },
          { value: 'best', label: 'The best so far (reheat)' },
        ],
        default: 'random',
      },
    ],
  },
  {
    id: 'hillClimbing',
    name: 'Hill climbing',
    description: 'Only accepts swaps that help. Fast, but stops at the first local optimum, so it restarts from new shuffles.',
    params: [
      { key: 'maxEvaluations', label: 'Total swaps tried', help: 'Budget shared across all restarts', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'patience', label: 'Give up after', help: 'Swaps without improvement before restarting', type: 'number', min: 500, max: 200_000, step: 500, default: 20_000 },
      { key: 'runs', label: 'Restarts', help: 'Times to start over from a fresh shuffle after getting stuck; the best climb wins', type: 'number', min: 1, max: 100, step: 1, default: 50 },
      { key: 'sideways', label: 'Allow sideways moves', help: 'Accept swaps that keep the score equal', type: 'boolean', default: true },
      { ...blockMoveParam, default: 0.4 },
    ],
  },
  {
    id: 'tabu',
    name: 'Tabu search',
    description: 'Each step takes the best of a sample of swaps, even if worse, but recently moved guests are off limits for a while.',
    params: [
      { key: 'steps', label: 'Steps', help: 'Moves to make. Each step takes the best sampled swap, even if it makes things worse', type: 'number', min: 100, max: 200_000, step: 100, default: 10_000 },
      { key: 'neighborhood', label: 'Swaps sampled per step', help: 'Candidate swaps checked before each step. More finds better steps but costs more time', type: 'number', min: 10, max: 2000, step: 10, default: 200 },
      { key: 'tenure', label: 'Tabu tenure', help: 'Steps a moved seat stays frozen, so the search can’t just undo its last move. Small values work best here; long tenures freeze couples apart', type: 'number', min: 1, max: 60, step: 1, default: 2 },
      { ...blockMoveParam, default: 0.3 },
    ],
  },
  {
    id: 'genetic',
    name: 'Genetic algorithm',
    description: 'A population of seatings that breed (order crossover) and mutate; the fittest survive.',
    params: [
      { key: 'populationSize', label: 'Population', help: 'Seatings alive in each generation. Small populations with lots of local search per child work best here', type: 'number', min: 4, max: 300, step: 2, default: 10 },
      { key: 'generations', label: 'Generations', help: 'Rounds of breeding and selection', type: 'number', min: 2, max: 20_000, step: 1, default: 20 },
      { key: 'mutationRate', label: 'Mutation rate', help: 'Chance that a child gets one to three random swaps after crossover', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
      { key: 'eliteCount', label: 'Elites kept', help: 'The best seatings copied unchanged into the next generation', type: 'number', min: 0, max: 20, step: 1, default: 2 },
      { key: 'tournamentSize', label: 'Tournament size', help: 'Each parent is the best of this many random picks. Bigger means stronger selection and less variety', type: 'number', min: 2, max: 10, step: 1, default: 3 },
      {
        key: 'memeticSteps',
        label: 'Local search per child',
        help: 'Memetic modifier: hill-climb each child this many swaps before it joins the population. Without it, crossover splits couples and the population rarely recovers',
        type: 'number',
        min: 0,
        max: 50_000,
        step: 500,
        default: 10_000,
      },
      { ...blockMoveParam, default: 0.3 },
    ],
  },
  {
    id: 'twoStage',
    name: 'Two-stage decomposition',
    description: 'First decide who shares a table (everyone at a table counts equally), then anneal seat order within each table.',
    params: [
      { key: 'iterations', label: 'Iterations', help: 'Total swaps tried across both stages', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      { key: 'stage1Share', label: 'Share spent on tables', help: 'Fraction of iterations spent deciding who shares a table; the rest arranges seats within each table', type: 'number', min: 0.1, max: 0.9, step: 0.05, default: 0.6 },
      { key: 't0', label: 'Seat stage start temp', help: 'Starting temperature for arranging seats within tables. The table stage picks its own', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 't1', label: 'Seat stage end temp', help: 'Final temperature for arranging seats within tables', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      { ...blockMoveParam, default: 0.3, help: 'Share of moves that move a must-sit-next-to couple together, in both stages. In the table stage this is how couples change tables' },
    ],
  },
]

export function specDefaults(spec: AlgorithmSpec): Params {
  return Object.fromEntries(spec.params.map((p) => [p.key, p.default]))
}

const coreDefaults = (id: CoreAlgorithmId) => specDefaults(CORE_ALGORITHMS.find((a) => a.id === id)!)

export type SolverProgress = {
  evaluations: number
  current: number
  best: number
  done: boolean
  metrics: Record<string, number | string>
}

export interface Solver {
  step(budget: number): void
  progress(): SolverProgress
  current(): Int32Array
  best(): Int32Array
}

/**
 * A solver in its own file. `scale` sizes its schedule to about `evaluations` swap evaluations
 * (see scaleCoreToEvaluations); `prepare` loads anything asynchronous, like a WebAssembly
 * module, and must resolve before `create` is called.
 */
export type AlgorithmPlugin<Id extends string> = {
  spec: AlgorithmSpec<Id>
  create(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number): Solver
  scale(params: Params, evaluations: number, guestCount: number): Params
  prepare?(): Promise<void>
}

// ---------------------------------------------------------------------------------------------
// Shared move machinery

export class Moves {
  readonly movable: Int32Array
  readonly blocks: [number, number][]
  private readonly byTable: Int32Array[]
  private readonly isMovable: Uint8Array
  private readonly couples: [number, number][] // Guests who must sit next to each other

  constructor(
    readonly p: Problem,
    locked: Uint8Array,
    readonly coupleShare = 0 // Share of pair moves that move an actual must-sit-next-to pair
  ) {
    const movable: number[] = []
    for (let s = 0; s < p.S; s++) if (!locked[s]) movable.push(s)
    this.movable = Int32Array.from(movable)
    this.isMovable = Uint8Array.from({ length: p.S }, (_, s) => (locked[s] ? 0 : 1))
    this.byTable = Array.from({ length: p.layout.tables }, (_, t) => Int32Array.from(movable.filter((s) => p.tableOf[s] === t)))
    this.blocks = []
    for (const a of movable) for (const b of movable) if (a < b && p.adjacent[a * p.S + b]) this.blocks.push([a, b])
    this.couples = p.pairs.filter((c) => c.kind === 'ADJACENT').map((c) => [c.x, c.y])
  }

  // A must-sit-next-to pair's seats, if both can move
  private pickCouple(rng: Rng, seatOf: Int32Array): [number, number] | null {
    if (this.couples.length === 0) return null
    const [x, y] = this.couples[randInt(rng, this.couples.length)]
    const a = seatOf[x]
    const b = seatOf[y]
    return this.isMovable[a] && this.isMovable[b] ? [a, b] : null
  }

  // Two distinct movable seats that aren't both empty, or null if none were found quickly
  pick(rng: Rng, guestAt: Int32Array, scope: 'any' | 'sameTable' | 'crossTable' = 'any'): [number, number] | null {
    const { movable, p } = this
    if (movable.length < 2) return null
    for (let tries = 0; tries < 20; tries++) {
      const a = movable[randInt(rng, movable.length)]
      let b: number
      if (scope === 'sameTable') {
        const pool = this.byTable[p.tableOf[a]]
        b = pool[randInt(rng, pool.length)]
      } else {
        b = movable[randInt(rng, movable.length)]
        if (scope === 'crossTable' && p.tableOf[a] === p.tableOf[b]) continue
      }
      if (a === b || (guestAt[a] >= p.n && guestAt[b] >= p.n)) continue
      return [a, b]
    }
    return null
  }

  // Two non-overlapping neighbor pairs, optionally mirrored, as two seat swaps. With coupleShare,
  // the first pair is often a must-sit-next-to couple, wherever they sit, so couples travel together.
  pickBlocks(rng: Rng, scope: 'any' | 'sameTable' | 'crossTable' = 'any', seatOf?: Int32Array): [number, number, number, number] | null {
    if (this.blocks.length < 2) return null
    const couple = seatOf && this.coupleShare > 0 && rng() < this.coupleShare ? this.pickCouple(rng, seatOf) : null
    for (let tries = 0; tries < 20; tries++) {
      const [a1, a2] = couple ?? this.blocks[randInt(rng, this.blocks.length)]
      const [b1, b2] = this.blocks[randInt(rng, this.blocks.length)]
      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue
      if (scope === 'sameTable' && this.p.tableOf[a1] !== this.p.tableOf[b1]) continue
      if (scope === 'crossTable' && this.p.tableOf[a1] === this.p.tableOf[b1]) continue
      return rng() < 0.5 ? [a1, b1, a2, b2] : [a1, b2, a2, b1]
    }
    return null
  }

  shuffle(guestAt: Int32Array, rng: Rng) {
    shuffleAt(guestAt, this.movable, rng)
  }
}

/**
 * One proposed move: a single swap or a pair move. Applies it and returns the delta and an undo.
 */
export function proposeMove(
  scorer: Scorer,
  moves: Moves,
  rng: Rng,
  blockMoveRate: number,
  scope: 'any' | 'sameTable' | 'crossTable' = 'any'
): { delta: number; undo: () => void } | null {
  if (blockMoveRate > 0 && rng() < blockMoveRate) {
    const blocks = moves.pickBlocks(rng, scope, scorer.seatOf)
    if (blocks) {
      const [a1, b1, a2, b2] = blocks
      const delta = scorer.applySwap(a1, b1) + scorer.applySwap(a2, b2)
      return {
        delta,
        undo: () => {
          scorer.applySwap(a2, b2)
          scorer.applySwap(a1, b1)
        },
      }
    }
  }
  const pair = moves.pick(rng, scorer.guestAt, scope)
  if (!pair) return null
  const [a, b] = pair
  return { delta: scorer.applySwap(a, b), undo: () => scorer.applySwap(a, b) }
}

export const num = (params: Params, key: string, fallback: number) => {
  const v = Number(params[key])
  return Number.isFinite(v) ? v : fallback
}

// Floating-point drift from incremental updates is reset this often
export const RECOMPUTE_EVERY = 1 << 16

// ---------------------------------------------------------------------------------------------
// Simulated annealing

export class AnnealingSolver implements Solver {
  private readonly scorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly bestAt: Int32Array
  private bestScore: number
  private evals = 0
  private it = 0
  private run = 1
  private accepted = 0
  private proposed = 0
  private temperature: number
  private finished = false
  private readonly iterations: number
  private readonly runs: number
  private readonly t0: number
  private readonly t1: number
  private readonly linear: boolean
  private readonly blockMoveRate: number
  private readonly restartFromBest: boolean

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked)
    this.scorer = new Scorer(problem, guestAt)
    this.bestAt = Int32Array.from(this.scorer.guestAt)
    this.bestScore = this.scorer.total
    this.iterations = Math.max(1, num(params, 'iterations', 2_000_000))
    this.runs = Math.max(1, num(params, 'runs', 1))
    this.t0 = num(params, 't0', 5)
    this.t1 = Math.min(num(params, 't1', 0.01), this.t0)
    this.linear = params.cooling === 'linear'
    this.blockMoveRate = num(params, 'blockMoveRate', 0.1)
    this.restartFromBest = params.restartFrom === 'best'
    this.temperature = this.t0
  }

  step(budget: number) {
    const { scorer, rng } = this
    this.accepted = 0
    this.proposed = 0
    for (let i = 0; i < budget && !this.finished; i++) {
      const f = this.it / this.iterations
      this.temperature = this.linear ? this.t0 + (this.t1 - this.t0) * f : this.t0 * Math.pow(this.t1 / this.t0, f)
      const move = proposeMove(scorer, this.moves, rng, this.blockMoveRate)
      this.evals++
      this.it++
      if (move) {
        this.proposed++
        if (move.delta >= 0 || rng() < Math.exp(move.delta / this.temperature)) {
          this.accepted++
          if (scorer.total > this.bestScore + 1e-9) {
            this.bestScore = scorer.total
            this.bestAt.set(scorer.guestAt)
          }
        } else {
          move.undo()
        }
      }
      if (this.evals % RECOMPUTE_EVERY === 0) scorer.recompute()
      if (this.it >= this.iterations) this.nextRun()
    }
  }

  private nextRun() {
    if (this.run >= this.runs) {
      this.finished = true
      return
    }
    this.run++
    this.it = 0
    if (this.restartFromBest) {
      this.scorer.load(this.bestAt)
    } else {
      const fresh = Int32Array.from(this.scorer.guestAt)
      this.moves.shuffle(fresh, this.rng)
      this.scorer.load(fresh)
    }
  }

  progress(): SolverProgress {
    return {
      evaluations: this.evals,
      current: this.scorer.total,
      best: this.bestScore,
      done: this.finished,
      metrics: {
        Temperature: this.temperature,
        Run: `${this.run} / ${this.runs}`,
        'Acceptance rate': this.proposed ? this.accepted / this.proposed : 0,
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

// ---------------------------------------------------------------------------------------------
// Hill climbing with random restarts

export class HillClimbingSolver implements Solver {
  private readonly scorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly bestAt: Int32Array
  private bestScore: number
  private evals = 0
  private stale = 0
  private run = 1
  private optima: number[] = []
  private finished = false
  private readonly maxEvaluations: number
  private readonly patience: number
  private readonly runs: number
  private readonly sideways: boolean
  private readonly blockMoveRate: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked)
    this.scorer = new Scorer(problem, guestAt)
    this.bestAt = Int32Array.from(this.scorer.guestAt)
    this.bestScore = this.scorer.total
    this.maxEvaluations = num(params, 'maxEvaluations', 2_000_000)
    this.patience = num(params, 'patience', 20_000)
    this.runs = Math.max(1, num(params, 'runs', 10))
    this.sideways = params.sideways !== false
    this.blockMoveRate = num(params, 'blockMoveRate', 0.1)
  }

  step(budget: number) {
    const { scorer, rng } = this
    for (let i = 0; i < budget && !this.finished; i++) {
      const move = proposeMove(scorer, this.moves, rng, this.blockMoveRate)
      this.evals++
      if (move) {
        if (move.delta > 1e-9) {
          this.stale = 0
          if (scorer.total > this.bestScore + 1e-9) {
            this.bestScore = scorer.total
            this.bestAt.set(scorer.guestAt)
          }
        } else {
          this.stale++
          if (!(this.sideways && Math.abs(move.delta) <= 1e-9)) move.undo()
        }
      }
      if (this.evals % RECOMPUTE_EVERY === 0) scorer.recompute()
      if (this.stale >= this.patience) this.restart()
      if (this.evals >= this.maxEvaluations) this.finished = true
    }
  }

  private restart() {
    this.optima.push(this.scorer.total)
    this.stale = 0
    if (this.run >= this.runs) {
      this.finished = true
      return
    }
    this.run++
    const fresh = Int32Array.from(this.scorer.guestAt)
    this.moves.shuffle(fresh, this.rng)
    this.scorer.load(fresh)
  }

  progress(): SolverProgress {
    const last = this.optima[this.optima.length - 1]
    return {
      evaluations: this.evals,
      current: this.scorer.total,
      best: this.bestScore,
      done: this.finished,
      metrics: {
        Climb: `${this.run} / ${this.runs}`,
        'Swaps since last gain': this.stale,
        'Local optima found': this.optima.length,
        ...(last !== undefined ? { 'Last optimum': last } : {}),
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

// ---------------------------------------------------------------------------------------------
// Tabu search

export class TabuSolver implements Solver {
  private readonly scorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly bestAt: Int32Array
  private bestScore: number
  private readonly tabuUntil: Int32Array
  private evals = 0
  private iteration = 0
  private lastDelta = 0
  private finished = false
  private readonly steps: number
  private readonly neighborhood: number
  private readonly tenure: number
  private readonly blockMoveRate: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked)
    this.scorer = new Scorer(problem, guestAt)
    this.bestAt = Int32Array.from(this.scorer.guestAt)
    this.bestScore = this.scorer.total
    this.tabuUntil = new Int32Array(problem.S)
    this.steps = num(params, 'steps', 10_000)
    this.neighborhood = Math.max(1, num(params, 'neighborhood', 300))
    this.tenure = Math.max(1, num(params, 'tenure', 8))
    this.blockMoveRate = num(params, 'blockMoveRate', 0.1)
  }

  // A candidate is one swap, or two for a pair move
  private sample(): number[] | null {
    if (this.blockMoveRate > 0 && this.rng() < this.blockMoveRate) {
      const blocks = this.moves.pickBlocks(this.rng, 'any', this.scorer.seatOf)
      if (blocks) return blocks
    }
    return this.moves.pick(this.rng, this.scorer.guestAt)
  }

  private apply(move: number[]): number {
    let delta = 0
    for (let i = 0; i < move.length; i += 2) delta += this.scorer.applySwap(move[i], move[i + 1])
    return delta
  }

  private undo(move: number[]) {
    for (let i = move.length - 2; i >= 0; i -= 2) this.scorer.applySwap(move[i], move[i + 1])
  }

  step(budget: number) {
    const { scorer, rng, tabuUntil } = this
    let used = 0
    while (used < budget && !this.finished) {
      let bestMove: number[] | null = null
      let bestDelta = -Infinity
      for (let i = 0; i < this.neighborhood; i++) {
        const move = this.sample()
        if (!move) continue
        const isTabu = move.some((seat) => tabuUntil[scorer.guestAt[seat]] > this.iteration)
        const delta = this.apply(move)
        this.undo(move)
        // Aspiration: a tabu move is fine if it beats the best ever
        if (isTabu && scorer.total + delta <= this.bestScore + 1e-9) continue
        if (delta > bestDelta) {
          bestDelta = delta
          bestMove = move
        }
      }
      used += this.neighborhood
      this.evals += this.neighborhood
      this.iteration++
      if (bestMove) {
        this.lastDelta = this.apply(bestMove)
        const until = this.iteration + this.tenure + randInt(rng, Math.ceil(this.tenure / 2) + 1)
        for (const seat of bestMove) tabuUntil[scorer.guestAt[seat]] = until
        if (scorer.total > this.bestScore + 1e-9) {
          this.bestScore = scorer.total
          this.bestAt.set(scorer.guestAt)
        }
      }
      if (this.iteration % 2048 === 0) scorer.recompute()
      if (this.iteration >= this.steps) this.finished = true
    }
  }

  progress(): SolverProgress {
    let frozen = 0
    for (let g = 0; g < this.scorer.p.n; g++) if (this.tabuUntil[g] > this.iteration) frozen++
    return {
      evaluations: this.evals,
      current: this.scorer.total,
      best: this.bestScore,
      done: this.finished,
      metrics: { Step: `${this.iteration} / ${this.steps}`, 'Guests frozen': frozen, 'Last move': this.lastDelta },
    }
  }

  current() {
    return this.scorer.guestAt
  }

  best() {
    return this.bestAt
  }
}

// ---------------------------------------------------------------------------------------------
// Genetic algorithm (optionally memetic)

type Individual = { guestAt: Int32Array; fitness: number }

export class GeneticSolver implements Solver {
  private readonly scorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private population: Individual[]
  private readonly bestAt: Int32Array
  private bestScore: number
  private evals = 0
  private generation = 0
  private finished = false
  private readonly populationSize: number
  private readonly generations: number
  private readonly mutationRate: number
  private readonly eliteCount: number
  private readonly tournamentSize: number
  private readonly memeticSteps: number
  private readonly blockMoveRate: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    this.moves = new Moves(problem, locked)
    this.scorer = new Scorer(problem, guestAt)
    this.populationSize = Math.max(4, num(params, 'populationSize', 60))
    this.generations = num(params, 'generations', 1500)
    this.mutationRate = num(params, 'mutationRate', 0.4)
    this.eliteCount = Math.min(num(params, 'eliteCount', 2), this.populationSize - 1)
    this.tournamentSize = Math.max(2, num(params, 'tournamentSize', 3))
    this.memeticSteps = num(params, 'memeticSteps', 0)
    this.blockMoveRate = num(params, 'blockMoveRate', 0.1)

    this.population = [this.evaluate(Int32Array.from(guestAt))]
    while (this.population.length < this.populationSize) {
      const fresh = Int32Array.from(guestAt)
      this.moves.shuffle(fresh, this.rng)
      this.population.push(this.evaluate(fresh))
    }
    this.population.sort((a, b) => b.fitness - a.fitness)
    this.bestAt = Int32Array.from(this.population[0].guestAt)
    this.bestScore = this.population[0].fitness
    this.scorer.load(this.bestAt)
  }

  private evaluate(guestAt: Int32Array): Individual {
    this.scorer.load(guestAt)
    this.evals += this.scorer.p.n
    for (let i = 0; i < this.memeticSteps; i++) {
      const move = proposeMove(this.scorer, this.moves, this.rng, this.blockMoveRate)
      this.evals++
      if (move && move.delta < 0) move.undo()
    }
    return { guestAt: Int32Array.from(this.scorer.guestAt), fitness: this.scorer.total }
  }

  private tournament(): Individual {
    let best = this.population[randInt(this.rng, this.population.length)]
    for (let i = 1; i < this.tournamentSize; i++) {
      const c = this.population[randInt(this.rng, this.population.length)]
      if (c.fitness > best.fitness) best = c
    }
    return best
  }

  // Order crossover over the movable seats: a slice from one parent, the rest in the other's order
  private crossover(p1: Int32Array, p2: Int32Array): Int32Array {
    const M = this.moves.movable
    const m = M.length
    const child = Int32Array.from(p1)
    if (m < 2) return child
    let i = randInt(this.rng, m)
    let j = randInt(this.rng, m)
    if (i > j) [i, j] = [j, i]
    const taken = new Uint8Array(this.scorer.p.S)
    for (let k = i; k <= j; k++) taken[p1[M[k]]] = 1
    let write = (j + 1) % m
    for (let r = 0; r < m; r++) {
      const token = p2[M[(j + 1 + r) % m]]
      if (taken[token]) continue
      child[M[write]] = token
      taken[token] = 1
      write = (write + 1) % m
    }
    return child
  }

  private mutate(guestAt: Int32Array) {
    if (this.rng() >= this.mutationRate) return
    const swaps = 1 + randInt(this.rng, 3)
    for (let s = 0; s < swaps; s++) {
      const pair = this.moves.pick(this.rng, guestAt)
      if (!pair) return
      const [a, b] = pair
      const t = guestAt[a]
      guestAt[a] = guestAt[b]
      guestAt[b] = t
    }
  }

  step(budget: number) {
    const cost = this.populationSize * (this.scorer.p.n + this.memeticSteps)
    let used = 0
    do {
      if (this.finished) return
      const next = this.population.slice(0, this.eliteCount)
      while (next.length < this.populationSize) {
        const child = this.crossover(this.tournament().guestAt, this.tournament().guestAt)
        this.mutate(child)
        next.push(this.evaluate(child))
      }
      next.sort((a, b) => b.fitness - a.fitness)
      this.population = next
      if (next[0].fitness > this.bestScore + 1e-9) {
        this.bestScore = next[0].fitness
        this.bestAt.set(next[0].guestAt)
      }
      this.scorer.load(next[0].guestAt)
      this.generation++
      used += cost
      if (this.generation >= this.generations) this.finished = true
    } while (used < budget)
  }

  progress(): SolverProgress {
    const avg = this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length
    return {
      evaluations: this.evals,
      current: this.population[0].fitness,
      best: this.bestScore,
      done: this.finished,
      metrics: {
        Generation: `${this.generation} / ${this.generations}`,
        'Population average': avg,
        'Population worst': this.population[this.population.length - 1].fitness,
      },
    }
  }

  current() {
    return this.population[0].guestAt
  }

  best() {
    return this.bestAt
  }
}

// ---------------------------------------------------------------------------------------------
// Two-stage decomposition: tables first (table-level objective), then seats within tables

/**
 * A start temperature that accepts a typical worsening move about a third of the time.
 */
export function autoTemperature(scorer: Scorer, moves: Moves, rng: Rng, scope: 'any' | 'crossTable'): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < 300; i++) {
    const pair = moves.pick(rng, scorer.guestAt, scope)
    if (!pair) continue
    const d = scorer.swapDelta(pair[0], pair[1])
    if (d < 0) {
      sum -= d
      count++
    }
  }
  return count ? sum / count : 1
}

/**
 * Anneals seat order within tables, never moving anyone to another table: the second stage of
 * TwoStageSolver, and the finish for any solver that settles the table split another way.
 * Works on the scorer it's given, which should already hold the table split.
 */
export class SeatOrderAnnealer {
  readonly bestAt: Int32Array
  bestScore: number
  temperature: number
  private it = 0

  constructor(
    readonly scorer: Scorer,
    private readonly moves: Moves,
    private readonly rng: Rng,
    private readonly iterations: number,
    private readonly t0: number,
    private readonly t1: number,
    private readonly blockMoveRate: number
  ) {
    this.temperature = t0
    this.bestAt = Int32Array.from(scorer.guestAt)
    this.bestScore = scorer.total
  }

  get done() {
    return this.it >= this.iterations
  }

  // Runs up to `budget` iterations and returns how many it ran
  step(budget: number): number {
    const { scorer, rng } = this
    let used = 0
    for (; used < budget && this.it < this.iterations; used++) {
      this.it++
      this.temperature = this.t0 * Math.pow(this.t1 / this.t0, this.it / this.iterations)
      const move = proposeMove(scorer, this.moves, rng, this.blockMoveRate, 'sameTable')
      if (move) {
        if (move.delta >= 0 || rng() < Math.exp(move.delta / this.temperature)) {
          if (scorer.total > this.bestScore + 1e-9) {
            this.bestScore = scorer.total
            this.bestAt.set(scorer.guestAt)
          }
        } else {
          move.undo()
        }
      }
      if (this.it % RECOMPUTE_EVERY === 0) scorer.recompute()
    }
    return used
  }
}

export class TwoStageSolver implements Solver {
  private readonly tableScorer: Scorer
  private readonly seatScorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private seatStage: SeatOrderAnnealer | null = null
  private bestScore: number
  private readonly bestTableAt: Int32Array
  private bestTableScore: number
  private evals = 0
  private it = 0
  private temperature: number
  private readonly stage1Iterations: number
  private readonly stage2Iterations: number
  private readonly tableT0: number
  private readonly t0: number
  private readonly t1: number
  private readonly blockMoveRate: number

  constructor(problem: Problem, guestAt: Int32Array, locked: Uint8Array, params: Params, seed: number) {
    this.rng = mulberry32(seed)
    // Pair moves always carry a must-sit-next-to couple, so stage one can move couples between tables
    // without splitting them (a single swap would break their same-table rule)
    this.moves = new Moves(problem, locked, 1)
    this.tableScorer = new Scorer(tableLevelProblem(problem), guestAt)
    this.seatScorer = new Scorer(problem, guestAt)
    const iterations = Math.max(2, num(params, 'iterations', 2_000_000))
    const share = Math.min(0.9, Math.max(0.1, num(params, 'stage1Share', 0.4)))
    this.stage1Iterations = Math.round(iterations * share)
    this.stage2Iterations = iterations - this.stage1Iterations
    this.t0 = num(params, 't0', 3)
    this.t1 = Math.min(num(params, 't1', 0.01), this.t0)
    this.blockMoveRate = num(params, 'blockMoveRate', 0.1)
    this.tableT0 = autoTemperature(this.tableScorer, this.moves, this.rng, 'crossTable')
    this.temperature = this.tableT0
    this.bestScore = this.seatScorer.total
    this.bestTableAt = Int32Array.from(guestAt)
    this.bestTableScore = this.tableScorer.total
  }

  step(budget: number) {
    const rng = this.rng
    let left = budget
    while (left > 0 && !this.seatStage?.done) {
      if (this.seatStage) {
        const used = this.seatStage.step(left)
        left -= used
        this.evals += used
        this.temperature = this.seatStage.temperature
        this.bestScore = this.seatStage.bestScore
        continue
      }
      left--
      this.evals++
      this.it++
      this.temperature = this.tableT0 * Math.pow(0.001, this.it / this.stage1Iterations)
      const move = proposeMove(this.tableScorer, this.moves, rng, this.blockMoveRate, 'crossTable')
      if (move && !(move.delta >= 0 || rng() < Math.exp(move.delta / this.temperature))) move.undo()
      else if (move && this.tableScorer.total > this.bestTableScore + 1e-9) {
        this.bestTableScore = this.tableScorer.total
        this.bestTableAt.set(this.tableScorer.guestAt)
      }
      if (this.evals % RECOMPUTE_EVERY === 0) this.tableScorer.recompute()
      if (this.it >= this.stage1Iterations) {
        this.seatScorer.load(this.bestTableAt)
        this.seatStage = new SeatOrderAnnealer(this.seatScorer, this.moves, rng, this.stage2Iterations, this.t0, this.t1, this.blockMoveRate)
        this.bestScore = this.seatScorer.total
      }
    }
  }

  progress(): SolverProgress {
    // During stage one, score the table split as seated so the chart stays comparable
    if (!this.seatStage) {
      this.seatScorer.load(this.tableScorer.guestAt)
      this.bestScore = Math.max(this.bestScore, this.seatScorer.total)
    }
    return {
      evaluations: this.evals,
      current: this.seatScorer.total,
      best: this.bestScore,
      done: !!this.seatStage?.done,
      metrics: {
        Stage: this.seatStage ? '2 · Seat order' : '1 · Who shares a table',
        Temperature: this.temperature,
        'Table-level score': this.tableScorer.total,
      },
    }
  }

  current() {
    return this.seatStage ? this.seatScorer.guestAt : this.tableScorer.guestAt
  }

  best() {
    return this.seatStage ? this.seatStage.bestAt : this.seatScorer.guestAt
  }
}

/**
 * Params with the length of the run (iterations, steps, generations…) scaled so the whole
 * schedule takes about `evaluations` swap evaluations. Lets time-boxed comparisons be fair to
 * algorithms whose behavior depends on reaching the end of their schedule, like annealing.
 */
export function scaleCoreToEvaluations(algorithm: CoreAlgorithmId, partial: Params, evaluations: number, guestCount: number): Params {
  const params = { ...coreDefaults(algorithm), ...partial }
  const e = Math.max(1000, Math.floor(evaluations))
  switch (algorithm) {
    case 'annealing':
      return { ...params, iterations: Math.floor(e / Math.max(1, num(params, 'runs', 1))) }
    case 'hillClimbing':
      return { ...params, maxEvaluations: e }
    case 'tabu':
      return { ...params, steps: Math.max(10, Math.floor(e / Math.max(1, num(params, 'neighborhood', 300)))) }
    case 'genetic': {
      const perGeneration = num(params, 'populationSize', 60) * (guestCount + num(params, 'memeticSteps', 200))
      return { ...params, generations: Math.max(2, Math.floor(e / perGeneration)) }
    }
    case 'twoStage':
      return { ...params, iterations: e }
  }
}

export function createCoreSolver(
  algorithm: CoreAlgorithmId,
  problem: Problem,
  guestAt: Int32Array,
  locked: Uint8Array,
  partial: Params,
  seed: number
): Solver {
  // Missing params take the spec defaults, so the constructors' fallbacks never apply
  const params = { ...coreDefaults(algorithm), ...partial }
  switch (algorithm) {
    case 'annealing':
      return new AnnealingSolver(problem, guestAt, locked, params, seed)
    case 'hillClimbing':
      return new HillClimbingSolver(problem, guestAt, locked, params, seed)
    case 'tabu':
      return new TabuSolver(problem, guestAt, locked, params, seed)
    case 'genetic':
      return new GeneticSolver(problem, guestAt, locked, params, seed)
    case 'twoStage':
      return new TwoStageSolver(problem, guestAt, locked, params, seed)
  }
}

// ---------------------------------------------------------------------------------------------
// Starting seatings

export function randomAssignment(problem: Problem, guestAt: Int32Array, locked: Uint8Array, seed: number): Int32Array {
  const next = Int32Array.from(guestAt)
  new Moves(problem, locked).shuffle(next, mulberry32(seed))
  return next
}

/**
 * Builds each table outward from its first seat: every next seat goes to whoever likes the people
 * already seated nearby the most, honoring hard constraints with guests already placed.
 * Must-be-at-a-head guests take head seats first, and locked guests stay put.
 */
export function greedyAssignment(problem: Problem, guestAt: Int32Array, locked: Uint8Array): Int32Array {
  const { n, S, A, P, seats, central, mustHead, layout, adjacent, tableOf, pairs } = problem
  const penalty = Math.max(problem.objective.constraintPenalty, 1)
  const constraintsOf: { other: number; kind: string }[][] = Array.from({ length: n }, () => [])
  for (const c of pairs) {
    constraintsOf[c.x].push({ other: c.y, kind: c.kind })
    constraintsOf[c.y].push({ other: c.x, kind: c.kind })
  }
  const next = new Int32Array(S).fill(-1)
  const placed = new Uint8Array(n)
  for (let s = 0; s < S; s++) {
    if (locked[s] && guestAt[s] < n) {
      next[s] = guestAt[s]
      placed[guestAt[s]] = 1
    }
  }
  const seatIndex = new Map(seats.map((s, i) => [s.key, i]))
  const seatAt = (t: number, part: string) => seatIndex.get(`T${t + 1}-${part}`)!
  const pad = (i: number) => String(i + 1).padStart(2, '0')

  // Head guests go to free head seats, one table at a time so they spread out
  if (layout.heads) {
    const headSeats = [
      ...Array.from({ length: layout.tables }, (_, t) => seatAt(t, 'HEAD-N')),
      ...Array.from({ length: layout.tables }, (_, t) => seatAt(t, 'HEAD-S')),
    ].filter((s) => next[s] === -1)
    for (let g = 0; g < n && headSeats.length > 0; g++) {
      if (!mustHead[g] || placed[g]) continue
      next[headSeats.shift()!] = g
      placed[g] = 1
    }
  }

  // Fill order per table: head, then the long sides pairwise from that end, then the far head
  const order = Array.from({ length: layout.tables }, (_, t) => {
    const list: number[] = []
    if (layout.heads) list.push(seatAt(t, 'HEAD-N'))
    for (let i = 0; i <= layout.seatsPerSide; i++) list.push(seatAt(t, `L-${pad(i)}`), seatAt(t, `R-${pad(i)}`))
    if (layout.heads) list.push(seatAt(t, 'HEAD-S'))
    return list.filter((s) => s !== undefined) // A squeezed side has one more seat
  })

  let unplaced = n - placed.reduce((sum, v) => sum + v, 0)
  for (let t = 0; t < layout.tables; t++) {
    // Spread guests evenly: this table takes its share of whoever is left
    const quota = Math.ceil(unplaced / (layout.tables - t))
    let seated = 0
    for (const s of order[t]) {
      if (next[s] !== -1 || seated >= quota) continue
      let best = -1
      let bestScore = -Infinity
      for (let g = 0; g < n; g++) {
        if (placed[g]) continue
        let score = central[g] * 0.01
        for (const other of order[t]) {
          const k = next[other]
          if (k >= 0) score += A[g * n + k] * P[s * S + other]
        }
        // Hard constraints with partners who already have seats
        for (const c of constraintsOf[g]) {
          const ps = next.indexOf(c.other)
          if (ps === -1) continue
          const near = adjacent[s * S + ps] === 1
          const sameTable = tableOf[s] === tableOf[ps]
          if (c.kind === 'ADJACENT' && near) score += penalty
          else if (c.kind === 'NEAR' && problem.near[s * S + ps]) score += penalty
          else if (c.kind === 'NOT_ADJACENT' && near) score -= penalty
          else if (c.kind === 'SAME_TABLE') score += sameTable ? penalty / 2 : -penalty
          else if (c.kind === 'DIFFERENT_TABLE' && sameTable) score -= penalty
        }
        if (score > bestScore) {
          bestScore = score
          best = g
        }
      }
      if (best === -1) break
      next[s] = best
      placed[best] = 1
      seated++
    }
    unplaced -= seated
  }

  // Anyone still unplaced takes any free seat, then empty tokens fill the rest
  let g = 0
  let empty = n
  for (let s = 0; s < S; s++) {
    if (next[s] !== -1) continue
    while (g < n && placed[g]) g++
    if (g < n) {
      next[s] = g
      placed[g] = 1
    } else {
      next[s] = empty++
    }
  }
  return next
}

/**
 * Quick hill climb: keeps only improving swaps. Used to tidy a greedy seating.
 */
export function polishAssignment(problem: Problem, guestAt: Int32Array, locked: Uint8Array, steps: number, seed: number): Int32Array {
  const scorer = new Scorer(problem, guestAt)
  const moves = new Moves(problem, locked)
  const rng = mulberry32(seed)
  for (let i = 0; i < steps; i++) {
    const move = proposeMove(scorer, moves, rng, 0.2)
    if (move && move.delta <= 1e-9) move.undo()
  }
  return Int32Array.from(scorer.guestAt)
}
