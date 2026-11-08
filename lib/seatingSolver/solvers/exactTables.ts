// Exact table split: an integer program (solved by HiGHS, compiled to WebAssembly) decides who sits
// at which table, then simulated annealing arranges seats within each table, as in the two-stage
// solver's second stage. The program maximizes a table-level stand-in for the real objective:
// either "flat" (every same-table pair counts the same) or "nearby" (everyone at a table counts a
// little, plus the closest seats, with each guest limited to as many close neighbors as a seat has).

import type { Highs, ModelData } from 'highs'
import { AlgorithmPlugin, Moves, num, Params, proposeMove, RECOMPUTE_EVERY, Solver, SolverProgress, TwoStageSolver } from '../core'
import { seatRelation } from '../layout'
import { Problem } from '../problem'
import { mulberry32, Rng, shuffleAt } from '../random'
import { Scorer } from '../scorer'

// ---------------------------------------------------------------------------------------------
// Loading HiGHS

// The browser loads HiGHS from public/highs/ (a copy of node_modules/highs/build/highs.mjs and
// highs.wasm) outside the bundle; Node imports the package. The ignore comments keep bundlers from
// trying to bundle either import.
const BROWSER_HIGHS_URL = '/highs/highs.mjs'

let highs: Highs | null = null
let loading: Promise<Highs> | null = null

export function loadHighs(): Promise<Highs> {
  if (!loading) {
    const inNode = typeof process !== 'undefined' && !!process.versions?.node
    const specifier = inNode ? 'highs' : new URL(BROWSER_HIGHS_URL, globalThis.location.href).href
    loading = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier)
      .then((mod) => {
        // CommonJS interop can wrap the default export once more
        const load = (mod.default?.default ?? mod.default) as (options?: object) => Promise<Highs>
        return load()
      })
      .then((loaded) => (highs = loaded))
      .catch((error) => {
        loading = null // Let a later run try again
        throw error
      })
  }
  return loading
}

// ---------------------------------------------------------------------------------------------
// The integer program

export type SplitModel = 'flat' | 'nearby'

export type SplitOptions = {
  model: SplitModel
  pairWeight: number // 'flat': proximity credited to every same-table pair
  timeLimit: number // Seconds
  seed: number
  integerNearby?: boolean // 'nearby': close-neighbor variables are integer (slower, tighter)
  exclude?: Int32Array[] // Earlier splits (table per guest) the answer must differ from
}

export type SplitResult = {
  table: Int32Array // Per guest
  solved: boolean // Found any split (otherwise `table` keeps the starting tables)
  status: string
  objective: number
  bound: number
  gap: number
  ms: number
}

const STATUS_NAMES: Record<number, string> = {
  7: 'Optimal',
  8: 'Infeasible',
  11: 'Bound reached',
  13: 'Time limit',
  14: 'Iteration limit',
  16: 'Solution limit',
  17: 'Interrupted',
}

// Collects a sparse model row by row
class MilpBuilder {
  readonly cost: number[] = []
  readonly lower: number[] = []
  readonly upper: number[] = []
  readonly integer: number[] = []
  readonly rowLower: number[] = []
  readonly rowUpper: number[] = []
  readonly starts: number[] = [0]
  readonly indices: number[] = []
  readonly values: number[] = []
  offset = 0

  addVar(lower: number, upper: number, cost = 0, integer = false): number {
    this.cost.push(cost)
    this.lower.push(lower)
    this.upper.push(upper)
    this.integer.push(integer ? 1 : 0)
    return this.cost.length - 1
  }

  // lower ≤ Σ coef·var ≤ upper, from alternating [var, coef, var, coef…]
  addRow(lower: number, upper: number, terms: number[]) {
    for (let i = 0; i < terms.length; i += 2) {
      this.indices.push(terms[i])
      this.values.push(terms[i + 1])
    }
    this.starts.push(this.indices.length)
    this.rowLower.push(lower)
    this.rowUpper.push(upper)
  }

  build(h: Highs): ModelData {
    const inf = h.infinity
    const clamp = (v: number) => (v === Infinity ? inf : v === -Infinity ? -inf : v)
    return {
      numCols: this.cost.length,
      numRows: this.rowLower.length,
      sense: h.constants.objectiveSense.maximize,
      offset: this.offset,
      colCost: this.cost,
      colLower: this.lower,
      colUpper: this.upper,
      rowLower: this.rowLower.map(clamp),
      rowUpper: this.rowUpper.map(clamp),
      matrix: { format: 'csr', numRows: this.rowLower.length, numCols: this.cost.length, starts: this.starts, indices: this.indices, values: this.values },
      integrality: this.integer as ModelData['integrality'],
    }
  }
}

// Kinds of close seat pairs, from the table geometry
type NearKind = { key: string; extra: number; capSide: number; capHead: number; count: number; involvesHead: boolean }

function nearKinds(problem: Problem): NearKind[] {
  const { S, seats, P, tableOf } = problem
  const base = problem.objective.proximity.sameTable
  const kindOf = (a: number, b: number): string | null => {
    const relation = seatRelation(seats[a], seats[b])
    return relation === 'sameTable' ? null : relation
  }
  const kinds = new Map<string, NearKind & { perSeat: Int32Array }>()
  for (let a = 0; a < S; a++) {
    for (let b = 0; b < S; b++) {
      if (a === b || tableOf[a] !== tableOf[b]) continue
      const key = kindOf(a, b)
      const extra = P[a * S + b] - base
      if (!key || extra <= 1e-12) continue
      let k = kinds.get(key)
      if (!k) kinds.set(key, (k = { key, extra, capSide: 0, capHead: 0, count: 0, involvesHead: key.startsWith('head'), perSeat: new Int32Array(S) }))
      k.perSeat[a]++
      if (a < b) k.count++
    }
  }
  return [...kinds.values()].map((k) => {
    for (let s = 0; s < S; s++) {
      if (seats[s].isHead) k.capHead = Math.max(k.capHead, k.perSeat[s])
      else k.capSide = Math.max(k.capSide, k.perSeat[s])
    }
    return { key: k.key, extra: k.extra, capSide: k.capSide, capHead: k.capHead, count: k.count, involvesHead: k.involvesHead }
  })
}

// Upper envelope of a guest's utility as a function of happiness, as lines u ≤ a + b·h
function utilityLines(problem: Problem): [number, number][] {
  const o = problem.objective
  if (o.fairness === 'floor') return [[0, 1], [-o.floorPenalty * o.minHappiness, 1 + o.floorPenalty]]
  if (o.fairness === 'concave') {
    // Tangents of 4(√(1+h) − 1); the one at 0 is also the exact 2h below zero
    return [0, 0.5, 1, 2, 3, 5, 8, 12, 20, 35, 60].map((p) => {
      const b = 2 / Math.sqrt(1 + p)
      return [4 * (Math.sqrt(1 + p) - 1) - b * p, b]
    })
  }
  return []
}

/**
 * Solves the table split as an integer program. Locked guests keep their table; every hard rule
 * becomes a penalized violation, so the program is never infeasible because of a bad lock.
 */
export function solveTableSplit(h: Highs, problem: Problem, guestAt: Int32Array, locked: Uint8Array, options: SplitOptions): SplitResult {
  const started = performance.now()
  const { n, S, A, tableOf, isHead, mustHead, pairs, layout, objective: o } = problem
  const T = layout.tables
  const penalty = o.constraintPenalty
  const m = new MilpBuilder()
  const nearby = options.model === 'nearby'
  const kinds = nearby ? nearKinds(problem) : []

  // Free seats and head seats per table, after locks
  const seatOf = new Int32Array(S)
  for (let s = 0; s < S; s++) seatOf[guestAt[s]] = s
  const capacity = new Array(T).fill(0)
  const heads = new Array(T).fill(0)
  for (let s = 0; s < S; s++) {
    const g = guestAt[s]
    if (locked[s] && g >= n) continue // A locked empty seat stays empty
    capacity[tableOf[s]]++
    if (isHead[s] && (!locked[s] || mustHead[g])) heads[tableOf[s]]++
  }

  // x[g·T + t]: guest g sits at table t
  const anyLocked = locked.some((v) => v === 1)
  let anchor = -1 // Pinned to the first table to break the symmetry of identical tables
  if (!anyLocked) {
    let most = -1
    for (let g = 0; g < n; g++) {
      let ties = 0
      for (let k = 0; k < n; k++) if (A[g * n + k] !== 0) ties++
      if (ties > most) {
        most = ties
        anchor = g
      }
    }
  }
  const x = new Int32Array(n * T)
  for (let g = 0; g < n; g++) {
    const s = seatOf[g]
    const fixed = locked[s] ? tableOf[s] : g === anchor ? 0 : -1
    const row: number[] = []
    for (let t = 0; t < T; t++) {
      x[g * T + t] = fixed === -1 ? m.addVar(0, 1, 0, true) : m.addVar(+(fixed === t), +(fixed === t), 0, true)
      row.push(x[g * T + t], 1)
    }
    m.addRow(1, 1, row)
  }
  for (let t = 0; t < T; t++) {
    const row: number[] = []
    for (let g = 0; g < n; g++) row.push(x[g * T + t], 1)
    m.addRow(-Infinity, capacity[t], row)
  }

  // Happiness stand-in per guest, as alternating [var, coef…], built up below
  const happy: number[][] = Array.from({ length: n }, () => [])
  const credit = (g: number, k: number, v: number, coef: number) => {
    happy[g].push(v, A[g * n + k] * coef)
    happy[k].push(v, A[g * n + k] * coef)
  }

  // y: the pair shares a table. With positive affinity only an upper limit is needed; with
  // negative affinity, a lower one
  const sameWeight = nearby ? o.proximity.sameTable : options.pairWeight
  const y = new Map<number, number>()
  const known: number[][] = Array.from({ length: n }, () => [])
  for (let g = 0; g < n; g++) {
    for (let k = g + 1; k < n; k++) {
      const a = A[g * n + k]
      if (a === 0) continue
      const v = m.addVar(0, 1)
      y.set(g * n + k, v)
      for (let t = 0; t < T; t++) {
        if (a > 0) {
          m.addRow(-Infinity, 1, [v, 1, x[g * T + t], 1, x[k * T + t], -1])
          m.addRow(-Infinity, 1, [v, 1, x[k * T + t], 1, x[g * T + t], -1])
        } else {
          m.addRow(-Infinity, 1, [x[g * T + t], 1, x[k * T + t], 1, v, -1])
        }
      }
      credit(g, k, v, sameWeight)
      if (a >= 1) {
        known[g].push(v, 1)
        known[k].push(v, 1)
      }
    }
  }

  // H[g·T + t]: guest g sits at a head of table t. Needed for close neighbors and the head bonus
  const useHeads = layout.heads && (nearby || o.headBonus > 0)
  const H = new Int32Array(n * T).fill(-1)
  if (useHeads) {
    for (let g = 0; g < n; g++) {
      for (let t = 0; t < T; t++) {
        const s = seatOf[g]
        const fixedOff = locked[s] && (tableOf[s] !== t || !isHead[s])
        H[g * T + t] = m.addVar(0, fixedOff ? 0 : 1, o.headBonus > 0 ? o.headBonus * problem.central[g] * problem.weight[g] : 0, true)
        m.addRow(-Infinity, 0, [H[g * T + t], 1, x[g * T + t], -1])
      }
    }
  }
  const atHead = (g: number) => {
    const terms: number[] = []
    for (let t = 0; t < T; t++) terms.push(H[g * T + t], 1)
    return terms
  }

  // Head seats: must-be-at-a-head guests need one at their table
  for (let t = 0; t < T; t++) {
    const row: number[] = []
    for (let g = 0; g < n; g++) {
      if (useHeads) row.push(H[g * T + t], 1)
      else if (mustHead[g] && !(locked[seatOf[g]] && !isHead[seatOf[g]])) row.push(x[g * T + t], 1)
    }
    if (row.length) m.addRow(-Infinity, heads[t], row)
  }
  if (useHeads) {
    for (let g = 0; g < n; g++) {
      if (!mustHead[g]) continue
      const v = m.addVar(0, 1, -penalty)
      m.addRow(1, Infinity, [...atHead(g), v, 1])
    }
  }

  // Close neighbors ('nearby'): e[kind] for a pair with positive affinity at that kind of seat pair.
  // Each guest gets at most as many of each kind as one seat has, and none of the side kinds at a head
  const near: { g: number; k: number; kind: number; v: number }[] = []
  const nearOf: number[][][] = kinds.map(() => Array.from({ length: n }, () => []))
  if (nearby) {
    const closePair = new Set(pairs.filter((c) => c.kind === 'ADJACENT' || c.kind === 'NEAR').map((c) => Math.min(c.x, c.y) * n + Math.max(c.x, c.y)))
    for (let g = 0; g < n; g++) {
      for (let k = g + 1; k < n; k++) {
        if (!(A[g * n + k] > 0) && !closePair.has(g * n + k)) continue
        let v = y.get(g * n + k)
        if (v === undefined) {
          // A must-sit-next-to (or near) pair with no affinity still needs a same-table variable
          v = m.addVar(0, 1)
          y.set(g * n + k, v)
          for (let t = 0; t < T; t++) {
            m.addRow(-Infinity, 1, [v, 1, x[g * T + t], 1, x[k * T + t], -1])
            m.addRow(-Infinity, 1, [v, 1, x[k * T + t], 1, x[g * T + t], -1])
          }
        }
        const sum: number[] = []
        kinds.forEach((kind, ki) => {
          const e = m.addVar(0, 1, 0, !!options.integerNearby)
          near.push({ g, k, kind: ki, v: e })
          nearOf[ki][g].push(e, 1)
          nearOf[ki][k].push(e, 1)
          sum.push(e, 1)
          if (A[g * n + k] > 0) credit(g, k, e, kind.extra)
          if (kind.involvesHead && useHeads) {
            m.addRow(-Infinity, 0, [e, 1, ...atHead(g).map((c, i) => (i % 2 ? -c : c)), ...atHead(k).map((c, i) => (i % 2 ? -c : c))])
          }
        })
        m.addRow(-Infinity, 0, [...sum, v, -1])
      }
    }
    kinds.forEach((kind, ki) => {
      for (let g = 0; g < n; g++) {
        if (nearOf[ki][g].length === 0) continue
        // Σ e ≤ capSide + (capHead − capSide)·atHead
        const row = [...nearOf[ki][g]]
        if (useHeads) for (let t = 0; t < T; t++) row.push(H[g * T + t], kind.capSide - kind.capHead)
        m.addRow(-Infinity, kind.capSide, row)
      }
      m.addRow(-Infinity, kind.count, near.filter((e) => e.kind === ki).flatMap((e) => [e.v, 1]))
    })
  }

  // Hard rules, each with a violation variable that costs the constraint penalty
  const nearIndex = new Map<number, number[]>()
  for (const e of near) {
    const key = e.g * n + e.k
    if (!nearIndex.has(key)) nearIndex.set(key, [])
    nearIndex.get(key)!.push(e.v)
  }
  for (const c of pairs) {
    const [g, k] = [Math.min(c.x, c.y), Math.max(c.x, c.y)]
    if (c.kind === 'NOT_ADJACENT') continue
    const v = m.addVar(0, 1, -penalty)
    for (let t = 0; t < T; t++) {
      if (c.kind === 'DIFFERENT_TABLE') m.addRow(-Infinity, 1, [x[g * T + t], 1, x[k * T + t], 1, v, -1])
      else {
        m.addRow(-Infinity, 0, [x[g * T + t], 1, x[k * T + t], -1, v, -1])
        m.addRow(-Infinity, 0, [x[k * T + t], 1, x[g * T + t], -1, v, -1])
      }
    }
    if ((c.kind === 'ADJACENT' || c.kind === 'NEAR') && nearby) {
      // Next to each other means a side or head-corner pair; near also allows across and diagonal
      const allowed = c.kind === 'ADJACENT' ? ['side', 'headCorner'] : ['side', 'headCorner', 'across', 'diagonal']
      const terms = (nearIndex.get(g * n + k) ?? []).flatMap((e, i) => (allowed.includes(kinds[i].key) ? [e, 1] : []))
      if (terms.length) {
        const w = m.addVar(0, 1, -penalty)
        m.addRow(1, Infinity, [...terms, w, 1])
      }
    }
  }

  // Utility per guest, times their weight: the fairness curve's upper envelope, plus
  // too-few-acquaintances penalty
  const lines = utilityLines(problem)
  for (let g = 0; g < n; g++) {
    const weight = problem.weight[g]
    if (lines.length === 0) {
      for (let i = 0; i < happy[g].length; i += 2) m.cost[happy[g][i]] += happy[g][i + 1] * weight
    } else {
      const u = m.addVar(-Infinity, Infinity, weight)
      // u − b·h ≤ a
      for (const [a, b] of lines) m.addRow(-Infinity, a, [u, 1, ...happy[g].map((c, i) => (i % 2 ? -b * c : c))])
    }
    if (o.minKnownAtTable > 0) {
      const short = m.addVar(0, Infinity, -o.minKnownPenalty * weight)
      m.addRow(o.minKnownAtTable, Infinity, [short, 1, ...known[g]])
    }
  }

  // Cut off earlier splits
  for (const prev of options.exclude ?? []) {
    const row: number[] = []
    for (let g = 0; g < n; g++) row.push(x[g * T + prev[g]], 1)
    m.addRow(-Infinity, n - 1, row)
  }

  const model = h.createModel(m.build(h))
  try {
    model.options.set({ output_flag: false, time_limit: Math.max(0.05, options.timeLimit), random_seed: options.seed % 2147483647 })
    model.run()
    const code = model.getModelStatus()
    const values = model.getSolution().colValue
    const solved = values.length === m.cost.length && Number.isFinite(model.getObjectiveValue()) && code !== 8
    const table = new Int32Array(n)
    for (let g = 0; g < n; g++) {
      table[g] = tableOf[seatOf[g]]
      if (!solved) continue
      let best = -1
      for (let t = 0; t < T; t++) if (best === -1 || values[x[g * T + t]] > values[x[g * T + best]]) best = t
      table[g] = best
    }
    const info = (key: string) => {
      const v = Number(model.info.get(key))
      return Number.isFinite(v) ? v : NaN
    }
    return {
      table,
      solved,
      status: STATUS_NAMES[code] ?? `Status ${code}`,
      objective: solved ? model.getObjectiveValue() : NaN,
      bound: info('mip_dual_bound'),
      gap: info('mip_gap'),
      ms: performance.now() - started,
    }
  } finally {
    model.dispose()
  }
}

/**
 * A seating with each guest at their table: must-be-at-a-head guests take head seats first, the
 * rest shuffled into the table's free seats. Locked seats stay put.
 */
export function seatSplit(problem: Problem, guestAt: Int32Array, locked: Uint8Array, table: Int32Array, rng: Rng): Int32Array {
  const { n, S, tableOf, isHead, mustHead, layout } = problem
  const next = Int32Array.from(guestAt)
  const free: number[][] = Array.from({ length: layout.tables }, () => [])
  const guests: number[][] = Array.from({ length: layout.tables }, () => [])
  const empties: number[] = []
  for (let s = 0; s < S; s++) {
    if (locked[s]) continue
    free[tableOf[s]].push(s)
    const token = guestAt[s]
    if (token >= n) empties.push(token)
    else guests[table[token]].push(token)
  }
  // Anyone over a table's capacity (only if the program failed) moves to a table with room
  for (let t = 0; t < layout.tables; t++) {
    while (guests[t].length > free[t].length) {
      const to = free.findIndex((f, u) => guests[u].length < f.length)
      guests[to].push(guests[t].pop()!)
    }
  }
  for (let t = 0; t < layout.tables; t++) {
    const seats = Int32Array.from(free[t])
    shuffleAt(seats, Int32Array.from(seats.keys()), rng)
    const order = [...seats].sort((a, b) => isHead[b] - isHead[a]) // Heads first, otherwise shuffled
    const list = [...guests[t]].sort((a, b) => mustHead[b] - mustHead[a])
    order.forEach((s, i) => (next[s] = i < list.length ? list[i] : empties.pop()!))
  }
  return next
}

// ---------------------------------------------------------------------------------------------
// Arranging seats

/**
 * Anneals seat order within tables, like SeatOrderAnnealer, but keeps each table's best
 * arrangement on its own. With the split fixed, tables don't affect each other, so the best seating
 * combines every table's best moment, across all runs.
 */
export class TableWiseAnnealer {
  readonly bestAt: Int32Array // Each table's best arrangement so far
  temperature: number
  run = 0
  private it = 0
  private readonly cur: Float64Array // Score per table, as currently seated
  private readonly top: Float64Array // Best score per table
  private fixed = 0 // Score that no seat move within a table can change
  private readonly seatsOf: Int32Array[]

  constructor(
    readonly scorer: Scorer,
    private readonly moves: Moves,
    private readonly rng: Rng,
    private readonly runIterations: number,
    readonly runs: number,
    private readonly t0: number,
    private readonly t1: number,
    private readonly blockMoveRate: number,
    private readonly restart: () => Int32Array // A fresh seating for the next run
  ) {
    const T = scorer.p.layout.tables
    this.cur = new Float64Array(T)
    this.top = new Float64Array(T).fill(-Infinity)
    this.seatsOf = Array.from({ length: T }, (_, t) => Int32Array.from(scorer.guestAt.keys()).filter((s) => scorer.p.tableOf[s] === t))
    this.bestAt = Int32Array.from(scorer.guestAt)
    this.temperature = t0
    this.measure()
  }

  get done() {
    return this.run >= this.runs
  }

  get bestScore() {
    return this.fixed + this.top.reduce((sum, v) => sum + v, 0)
  }

  // Splits the score by table: guests' utilities plus broken rules within the table
  private measure() {
    const { scorer } = this
    const { n, pairs, mustHead, isHead, tableOf, objective } = scorer.p
    this.cur.fill(0)
    for (const g of scorer.guestScores()) this.cur[tableOf[g.seat]] += g.utility
    for (const c of pairs) {
      const t = tableOf[scorer.seatOf[c.x]]
      if (t === tableOf[scorer.seatOf[c.y]] && scorer.violated(c)) this.cur[t] -= objective.constraintPenalty
    }
    for (let g = 0; g < n; g++) if (mustHead[g] && !isHead[scorer.seatOf[g]]) this.cur[tableOf[scorer.seatOf[g]]] -= objective.constraintPenalty
    this.fixed = scorer.total - this.cur.reduce((sum, v) => sum + v, 0)
    this.cur.forEach((v, t) => this.keep(t))
  }

  private keep(t: number) {
    if (this.cur[t] <= this.top[t] + 1e-9) return
    this.top[t] = this.cur[t]
    for (const s of this.seatsOf[t]) this.bestAt[s] = this.scorer.guestAt[s]
  }

  // Runs up to `budget` iterations and returns how many it ran
  step(budget: number): number {
    const { scorer, rng, moves } = this
    const tableOf = scorer.p.tableOf
    let used = 0
    for (; used < budget && !this.done; used++) {
      this.it++
      this.temperature = this.t0 * Math.pow(this.t1 / this.t0, this.it / this.runIterations)
      // One proposal within a table: a single swap, or a pair move (as in proposeMove)
      let move: number[] | null = null
      if (this.blockMoveRate > 0 && rng() < this.blockMoveRate) move = moves.pickBlocks(rng, 'sameTable', scorer.seatOf)
      if (!move) move = moves.pick(rng, scorer.guestAt, 'sameTable')
      if (move) {
        let delta = 0
        for (let i = 0; i < move.length; i += 2) delta += scorer.applySwap(move[i], move[i + 1])
        if (delta >= 0 || rng() < Math.exp(delta / this.temperature)) {
          const t = tableOf[move[0]]
          this.cur[t] += delta
          this.keep(t)
        } else {
          for (let i = move.length - 2; i >= 0; i -= 2) scorer.applySwap(move[i], move[i + 1])
        }
      }
      if (this.it % RECOMPUTE_EVERY === 0) {
        scorer.recompute()
        this.measure()
      }
      if (this.it >= this.runIterations) {
        this.run++
        this.it = 0
        if (!this.done) {
          scorer.load(this.restart())
          this.measure()
        }
      }
    }
    return used
  }
}

// ---------------------------------------------------------------------------------------------
// The solver

// Swap evaluations per millisecond, to count the program's solve time in the same unit as swaps
const EVALS_PER_MS = 400

export class ExactTablesSolver implements Solver {
  private readonly scorer: Scorer
  private readonly moves: Moves
  private readonly rng: Rng
  private readonly bestAt: Int32Array
  private bestScore: number
  private evals = 0
  private split: SplitResult | null = null
  private seatStage: TableWiseAnnealer | null = null
  private fallback: Solver | null = null // Two-stage, if the program found no split in time
  private polishIt = 0
  private polishIterations = 0
  private temperature: number
  private finished = false
  private readonly iterations: number
  private readonly runs: number
  private readonly t0: number
  private readonly t1: number
  private readonly blockMoveRate: number
  private readonly polishShare: number
  private readonly restartFromBest: boolean
  private readonly options: SplitOptions

  constructor(
    private readonly problem: Problem,
    private readonly startAt: Int32Array,
    private readonly locked: Uint8Array,
    params: Params,
    seed: number
  ) {
    this.rng = mulberry32(seed)
    // Pair moves always carry a must-sit-next-to couple, so couples settle in side by side
    this.moves = new Moves(problem, locked, 1)
    this.scorer = new Scorer(problem, startAt)
    this.bestAt = Int32Array.from(this.scorer.guestAt)
    this.bestScore = this.scorer.total
    this.iterations = Math.max(1000, num(params, 'iterations', 2_000_000))
    this.runs = Math.max(1, Math.round(num(params, 'runs', 8)))
    this.t0 = num(params, 't0', 3)
    this.t1 = Math.min(num(params, 't1', 0.3), this.t0)
    this.blockMoveRate = num(params, 'blockMoveRate', 0.3)
    this.polishShare = Math.min(0.9, Math.max(0, num(params, 'polishShare', 0)))
    this.restartFromBest = params.restartFrom === 'best'
    this.temperature = this.t0
    this.options = {
      model: params.model === 'nearby' ? 'nearby' : 'flat',
      pairWeight: num(params, 'pairWeight', 1),
      timeLimit: num(params, 'timeLimit', 60),
      integerNearby: params.integerNearby === true,
      seed,
    }
  }

  // The program runs in one go: HiGHS is synchronous
  private solveSplit() {
    if (!highs) throw new Error('HiGHS is not loaded yet: call prepareAlgorithm first')
    const split = solveTableSplit(highs, this.problem, this.startAt, this.locked, this.options)
    this.split = split
    this.evals += Math.round(split.ms * EVALS_PER_MS)
    if (!split.solved) {
      // Without a split, the start's tables would break must-sit-together rules
      const left = Math.max(this.iterations * 0.2, this.iterations - this.evals)
      this.fallback = new TwoStageSolver(this.problem, this.startAt, this.locked, { iterations: left, stage1Share: 0.6, t0: this.t0, t1: this.t1, blockMoveRate: this.blockMoveRate }, this.options.seed)
      return
    }
    const fresh = () => seatSplit(this.problem, this.startAt, this.locked, split.table, this.rng)
    this.scorer.load(fresh())
    this.record()
    // Whatever the program's time didn't use goes to arranging seats
    const left = Math.max(this.iterations * 0.2, this.iterations - this.evals)
    this.polishIterations = Math.round(left * this.polishShare)
    const perRun = Math.max(1, Math.round((left - this.polishIterations) / this.runs))
    const restart = () => (this.restartFromBest ? Int32Array.from(this.seatStage!.bestAt) : fresh())
    this.seatStage = new TableWiseAnnealer(this.scorer, this.moves, this.rng, perRun, this.runs, this.t0, this.t1, this.blockMoveRate, restart)
  }

  private record() {
    if (this.scorer.total > this.bestScore + 1e-9) {
      this.bestScore = this.scorer.total
      this.bestAt.set(this.scorer.guestAt)
    }
  }

  step(budget: number) {
    if (!this.split) {
      this.solveSplit()
      return
    }
    if (this.fallback) {
      this.fallback.step(budget)
      return
    }
    const stage = this.seatStage!
    let left = budget
    if (!stage.done) {
      const used = stage.step(left)
      left -= used
      this.evals += used
      this.temperature = stage.temperature
      if (stage.bestScore > this.bestScore + 1e-9) {
        this.bestScore = stage.bestScore
        this.bestAt.set(stage.bestAt)
      }
      if (stage.done) this.scorer.load(this.bestAt)
    }
    // Polish: a cool anneal that may also move guests between tables, in case the program's
    // stand-in objective put someone at the wrong one
    const { scorer, rng } = this
    for (; left > 0 && stage.done && this.polishIt < this.polishIterations; left--) {
      this.polishIt++
      this.evals++
      this.temperature = this.t1 * Math.pow(0.1, this.polishIt / this.polishIterations)
      const move = proposeMove(scorer, this.moves, rng, this.blockMoveRate)
      if (move) {
        if (move.delta >= 0 || rng() < Math.exp(move.delta / this.temperature)) this.record()
        else move.undo()
      }
      if (this.polishIt % RECOMPUTE_EVERY === 0) scorer.recompute()
    }
    if (stage.done && this.polishIt >= this.polishIterations) this.finished = true
  }

  progress(): SolverProgress {
    if (this.fallback) {
      const p = this.fallback.progress()
      return { ...p, evaluations: this.evals + p.evaluations, metrics: { ...p.metrics, 'Program status': `${this.split!.status} · using two-stage` } }
    }
    const s = this.split
    const stage = this.seatStage
    return {
      evaluations: this.evals,
      current: this.scorer.total,
      best: this.bestScore,
      done: this.finished,
      metrics: {
        Stage: !stage ? '1 · Integer program' : !stage.done ? '2 · Seat order' : '3 · Polish',
        Temperature: this.temperature,
        ...(stage ? { Run: `${Math.min(stage.run + 1, stage.runs)} / ${stage.runs}` } : {}),
        ...(s
          ? {
              'Program status': s.status,
              'Table-level objective': s.objective,
              'Program bound': s.bound,
              'Program gap': Number.isFinite(s.gap) ? `${(100 * s.gap).toFixed(2)}%` : '—',
              'Solve time (ms)': Math.round(s.ms),
            }
          : {}),
      },
    }
  }

  current() {
    return this.fallback?.current() ?? this.scorer.guestAt
  }

  best() {
    return this.fallback?.best() ?? this.bestAt
  }
}

export const exactTables: AlgorithmPlugin<'exactTables'> = {
  spec: {
    id: 'exactTables',
    name: 'Exact table split',
    description: 'Solves who sits at which table exactly with an integer program (HiGHS, in WebAssembly), then arranges seats.',
    params: [
      { key: 'iterations', label: 'Iterations', help: 'Total work, in swaps; the integer program’s solve time counts against it', type: 'number', min: 10_000, max: 20_000_000, step: 10_000, default: 2_000_000 },
      {
        key: 'model',
        label: 'Table objective',
        help: 'What the program maximizes. Flat counts everyone at a table the same; nearby also credits the closest seats, as many as one seat has',
        type: 'select',
        options: [
          { value: 'flat', label: 'Flat' },
          { value: 'nearby', label: 'Nearby seats' },
        ],
        default: 'flat',
      },
      { key: 'pairWeight', label: 'Same-table weight', help: 'Flat only: how close two people at the same table count as sitting. Only matters with a fairness rule', type: 'number', min: 0.05, max: 1, step: 0.05, default: 1 },
      { key: 'integerNearby', label: 'Exact close seats', help: 'Nearby only: make the close-seat choices whole numbers. Slower, and rarely changes the split', type: 'boolean', default: false },
      { key: 'timeLimit', label: 'Program time limit (s)', help: 'Longest the integer program may run before taking its best split so far. It usually needs about a second; if it finds no split at all, two-stage takes over', type: 'number', min: 0.5, max: 120, step: 0.5, default: 60 },
      { key: 'runs', label: 'Seat runs', help: 'Times to anneal the seats within tables, sharing the work. Each table keeps its best arrangement from any run', type: 'number', min: 1, max: 50, step: 1, default: 8 },
      {
        key: 'restartFrom',
        label: 'Later runs start from',
        help: 'With more than one run: start each later run from a fresh shuffle within each table, or reheat the best so far',
        type: 'select',
        options: [
          { value: 'random', label: 'A fresh shuffle' },
          { value: 'best', label: 'The best so far (reheat)' },
        ],
        default: 'random',
      },
      { key: 't0', label: 'Seat stage start temp', help: 'Starting temperature for arranging seats within tables', type: 'number', min: 0.1, max: 50, step: 0.1, default: 3 },
      { key: 't1', label: 'Seat stage end temp', help: 'Final temperature for arranging seats within tables', type: 'number', min: 0.001, max: 5, step: 0.001, default: 0.3 },
      { key: 'polishShare', label: 'Share spent polishing', help: 'Fraction of the seat work spent at the end on a cool anneal that can also move guests between tables', type: 'number', min: 0, max: 0.9, step: 0.05, default: 0 },
      { key: 'blockMoveRate', label: 'Pair moves', help: 'Share of moves that move a must-sit-next-to couple together', type: 'number', min: 0, max: 0.5, step: 0.05, default: 0.3 },
    ],
  },
  prepare: async () => {
    await loadHighs()
  },
  create: (problem, guestAt, locked, params, seed) => new ExactTablesSolver(problem, guestAt, locked, params, seed),
  scale: (params, evaluations) => ({ ...params, iterations: Math.max(1000, Math.floor(evaluations)) }),
}
