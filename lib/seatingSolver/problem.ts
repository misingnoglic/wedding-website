// A seating problem flattened into typed arrays so it can be scored fast and posted to a worker.
// Seats hold "tokens" 0..S-1: tokens below n are guests, the rest are empty seats.

import { EffectiveAffinity, getAffinity } from '../seating'
import {
  buildSeats,
  DEFAULT_PROXIMITY,
  LayoutConfig,
  ProximityWeights,
  Seat,
  seatProximity,
  seatsAdjacent,
} from './layout'

export type Fairness = 'sum' | 'floor' | 'concave'

export type ObjectiveConfig = {
  proximity: ProximityWeights
  fairness: Fairness
  minHappiness: number // 'floor': each point a guest falls below this costs floorPenalty
  floorPenalty: number
  headBonus: number // Reward per point of a guest's total positive ties when they sit at a head
  minKnownAtTable: number // Bellows & Peterson's b: everyone should know at least this many at their table
  minKnownPenalty: number // Per missing acquaintance
  constraintPenalty: number // Per broken hard constraint
  partyPairsAdjacent: boolean // Parties of two must sit next to each other (applied when building the problem's relationships)
}

export const DEFAULT_OBJECTIVE: ObjectiveConfig = {
  proximity: DEFAULT_PROXIMITY,
  fairness: 'floor',
  minHappiness: 2,
  floorPenalty: 3,
  headBonus: 0,
  minKnownAtTable: 0,
  minKnownPenalty: 2,
  constraintPenalty: 50,
  partyPairsAdjacent: true,
}

export type PairConstraintKind = 'ADJACENT' | 'NOT_ADJACENT' | 'SAME_TABLE' | 'DIFFERENT_TABLE'
export type PairConstraint = { x: number; y: number; kind: PairConstraintKind }

export type Problem = {
  n: number // Guests
  S: number // Seats (>= n)
  guestIds: string[]
  guestNames: string[]
  seats: Seat[]
  layout: LayoutConfig
  A: Float64Array // n×n affinity
  P: Float64Array // S×S proximity
  adjacent: Uint8Array // S×S geometric "next to"
  tableOf: Int32Array // Per seat
  isHead: Uint8Array // Per seat
  central: Float64Array // Per guest: sum of positive affinities, for the head bonus
  weight: Float64Array // Per guest: how much their utility counts in the total
  mustHead: Uint8Array // Per guest
  pairs: PairConstraint[]
  objective: ObjectiveConfig
}

export type ProblemInput = {
  guests: { id: string; name: string }[]
  affinityMap: Map<string, EffectiveAffinity>
  relationships: { guestAId: string; guestBId: string; constraint: string | null }[]
  headIds: Set<string>
  weights?: Map<string, number> // Guests not in it count once
  layout: LayoutConfig
  objective: ObjectiveConfig
}

// Affinity at or above this means two guests "know" each other for minKnownAtTable
export const KNOWS_THRESHOLD = 1

export function buildProblem(input: ProblemInput): Problem {
  const { guests, layout, objective } = input
  const seats = buildSeats(layout)
  const n = guests.length
  const S = seats.length
  if (n > S) throw new Error(`${n} guests don't fit in ${S} seats`)

  const A = new Float64Array(n * n)
  const central = new Float64Array(n)
  for (let x = 0; x < n; x++) {
    for (let y = x + 1; y < n; y++) {
      const v = getAffinity(input.affinityMap, guests[x].id, guests[y].id)
      A[x * n + y] = v
      A[y * n + x] = v
      if (v > 0) {
        central[x] += v
        central[y] += v
      }
    }
  }

  const P = buildProximityMatrix(seats, objective.proximity)
  const adjacent = new Uint8Array(S * S)
  for (let a = 0; a < S; a++)
    for (let b = 0; b < S; b++) adjacent[a * S + b] = seatsAdjacent(seats[a], seats[b]) ? 1 : 0

  const index = new Map(guests.map((g, i) => [g.id, i]))
  const pairs: PairConstraint[] = []
  for (const r of input.relationships) {
    const x = index.get(r.guestAId)
    const y = index.get(r.guestBId)
    if (x === undefined || y === undefined || !r.constraint) continue
    pairs.push({ x, y, kind: r.constraint as PairConstraintKind })
  }

  return {
    n,
    S,
    guestIds: guests.map((g) => g.id),
    guestNames: guests.map((g) => g.name),
    seats,
    layout,
    A,
    P,
    adjacent,
    tableOf: Int32Array.from(seats.map((s) => s.table)),
    isHead: Uint8Array.from(seats.map((s) => (s.isHead ? 1 : 0))),
    central,
    weight: Float64Array.from(guests, (g) => input.weights?.get(g.id) ?? 1),
    mustHead: Uint8Array.from(guests.map((g) => (input.headIds.has(g.id) ? 1 : 0))),
    pairs,
    objective,
  }
}

export function buildProximityMatrix(seats: Seat[], w: ProximityWeights): Float64Array {
  const S = seats.length
  const P = new Float64Array(S * S)
  for (let a = 0; a < S; a++)
    for (let b = 0; b < S; b++) P[a * S + b] = seatProximity(seats[a], seats[b], w)
  return P
}

/**
 * The table-level view used by stage one of the two-stage solver (and by Bellows & Peterson):
 * everyone at a table counts equally, and "next to" constraints relax to "same table".
 */
export function tableLevelProblem(problem: Problem): Problem {
  const { S, tableOf } = problem
  const P = new Float64Array(S * S)
  for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) P[a * S + b] = a !== b && tableOf[a] === tableOf[b] ? 1 : 0
  const pairs = problem.pairs.flatMap((c): PairConstraint[] =>
    c.kind === 'ADJACENT' ? [{ ...c, kind: 'SAME_TABLE' }] : c.kind === 'NOT_ADJACENT' ? [] : [c]
  )
  // Heads don't exist at this level, so the head bonus and head requirements wait for stage two
  return {
    ...problem,
    P,
    pairs,
    mustHead: new Uint8Array(problem.n),
    objective: { ...problem.objective, headBonus: 0 },
  }
}

/**
 * Seat tokens (guests 0..n-1, empties n..S-1) from saved seat keys; anyone without a valid seat
 * fills the remaining seats in order.
 */
export function assignmentFromSeatKeys(problem: Problem, seatOfGuest: Map<string, string>): Int32Array {
  const guestAt = new Int32Array(problem.S).fill(-1)
  const seatIndex = new Map(problem.seats.map((s, i) => [s.key, i]))
  const unplaced: number[] = []
  problem.guestIds.forEach((id, g) => {
    const s = seatIndex.get(seatOfGuest.get(id) ?? '')
    if (s !== undefined && guestAt[s] === -1) guestAt[s] = g
    else unplaced.push(g)
  })
  let empty = problem.n
  for (let s = 0; s < problem.S; s++) {
    if (guestAt[s] !== -1) continue
    guestAt[s] = unplaced.length > 0 ? unplaced.shift()! : empty++
  }
  return guestAt
}

/**
 * Each guest's best possible happiness: their favorite people in the closest seats around the best
 * seat for them, and everyone they dislike out of reach. Pairing the highest ratings with the highest
 * proximities gives this upper bound (the rearrangement inequality), so happiness / potential is
 * the share of what this guest could get. Zero for guests with no positive ties.
 */
export function happinessPotential(problem: Problem): Float64Array {
  const { n, S, A, P } = problem
  // Each seat's proximities to the other seats, closest first, without the zeros. Seats of the same
  // shape (e.g. every middle side seat) share a row.
  const shapes = new Map<string, number[]>()
  for (let s = 0; s < S; s++) {
    const row = Array.from(P.subarray(s * S, s * S + S)).filter((v, b) => b !== s && v > 0)
    row.sort((x, y) => y - x)
    shapes.set(row.join(','), row)
  }
  const rows = [...shapes.values()]

  const potential = new Float64Array(n)
  for (let g = 0; g < n; g++) {
    const likes: number[] = []
    for (let k = 0; k < n; k++) if (A[g * n + k] > 0) likes.push(A[g * n + k])
    likes.sort((x, y) => y - x)
    for (const row of rows) {
      let sum = 0
      for (let i = 0; i < likes.length && i < row.length; i++) sum += likes[i] * row[i]
      if (sum > potential[g]) potential[g] = sum
    }
  }
  return potential
}
