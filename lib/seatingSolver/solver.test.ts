import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../seating'
import { ALGORITHMS, AlgorithmId, createSolver, defaultParams, greedyAssignment, prepareAlgorithm, randomAssignment, scaleToEvaluations } from './algorithms'
import { autoLayout, buildSeats, DEFAULT_PROXIMITY, seatCount, seatProximity, seatsAdjacent } from './layout'
import { assignmentFromSeatKeys, buildProblem, DEFAULT_OBJECTIVE, happinessPotential, ObjectiveConfig, Problem } from './problem'
import { mulberry32 } from './random'
import { Scorer } from './scorer'

function makeProblem(guestCount: number, objective: Partial<ObjectiveConfig> = {}, seed = 7): Problem {
  const rng = mulberry32(seed)
  const guests = Array.from({ length: guestCount }, (_, i) => ({ id: `g${String(i).padStart(2, '0')}`, name: `Guest ${i}` }))
  const affinityMap = new Map<string, EffectiveAffinity>()
  for (let i = 0; i < guestCount; i++) {
    for (let j = i + 1; j < guestCount; j++) {
      const r = rng()
      if (r < 0.25) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: Math.ceil(rng() * 3), source: 'explicit', label: '' })
      else if (r < 0.3) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: -Math.ceil(rng() * 3), source: 'explicit', label: '' })
    }
  }
  const relationships = [
    { guestAId: 'g00', guestBId: 'g01', constraint: 'ADJACENT' },
    { guestAId: 'g02', guestBId: 'g03', constraint: 'NOT_ADJACENT' },
    { guestAId: 'g04', guestBId: 'g05', constraint: 'SAME_TABLE' },
    { guestAId: 'g06', guestBId: 'g07', constraint: 'DIFFERENT_TABLE' },
  ]
  return buildProblem({
    guests,
    affinityMap,
    relationships,
    headIds: new Set(['g08']),
    layout: autoLayout(guestCount + 3, 2, true), // A few empty seats
    objective: { ...DEFAULT_OBJECTIVE, ...objective },
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)

function isPermutation(guestAt: Int32Array): boolean {
  const seen = new Set(guestAt)
  return seen.size === guestAt.length && Math.min(...guestAt) === 0 && Math.max(...guestAt) === guestAt.length - 1
}

test('autoLayout fits everyone, squeezing in a seat where that fits exactly', () => {
  const layout = autoLayout(68, 2, true)
  assert.deepEqual(layout, { tables: 2, seatsPerSide: 16, heads: true, extraSeats: 0 })
  assert.equal(seatCount(layout), 68)
  assert.equal(buildSeats(layout).length, 68)
  assert.deepEqual(autoLayout(69, 2, true), { tables: 2, seatsPerSide: 16, heads: true, extraSeats: 1 })
  assert.equal(buildSeats(autoLayout(69, 2, true)).length, 69)
  assert.equal(seatCount(autoLayout(71, 2, true)), 72) // Three extra seats would be a bigger table
  assert.equal(seatCount(autoLayout(12, 2, false)), 12)
  assert.equal(seatCount(autoLayout(10, 2, false)), 10) // Tables of 5: two seats a side plus one squeezed in
})

test('seat proximity and adjacency follow the table geometry', () => {
  const layout = { tables: 2, seatsPerSide: 4, heads: true }
  const seats = buildSeats(layout)
  const at = (key: string) => seats.find((s) => s.key === key)!
  const w = { ...DEFAULT_PROXIMITY, headSecondRow: 0.3 }
  const prox = (a: string, b: string) => seatProximity(at(a), at(b), w)
  assert.equal(prox('T1-L-01', 'T1-L-02'), w.side)
  assert.equal(prox('T1-L-02', 'T1-R-02'), w.across)
  assert.equal(prox('T1-L-02', 'T1-R-03'), w.diagonal)
  assert.equal(prox('T1-HEAD-N', 'T1-L-01'), w.headCorner)
  assert.equal(prox('T1-HEAD-S', 'T1-R-04'), w.headCorner)
  assert.equal(prox('T1-HEAD-N', 'T1-R-02'), 0.3)
  assert.equal(prox('T1-L-01', 'T1-L-04'), w.sameTable)
  assert.equal(prox('T1-L-01', 'T2-L-01'), 0)
  assert.ok(seatsAdjacent(at('T1-HEAD-N'), at('T1-R-01')))
  assert.ok(!seatsAdjacent(at('T1-HEAD-N'), at('T1-HEAD-S')))
  assert.ok(!seatsAdjacent(at('T1-L-01'), at('T1-R-01')))
})

test('a squeezed-in seat makes one side longer without stretching the table', () => {
  const layout = { tables: 2, seatsPerSide: 4, heads: true, extraSeats: 1 }
  const seats = buildSeats(layout)
  const at = (key: string) => seats.find((s) => s.key === key)!
  const prox = (a: string, b: string) => seatProximity(at(a), at(b), DEFAULT_PROXIMITY)
  assert.equal(seats.filter((s) => s.table === 0).length, 11)
  assert.equal(seats.filter((s) => s.table === 1).length, 10)
  assert.equal(at('T1-HEAD-S').x, at('T2-HEAD-S').x)
  // Both ends still line up across the table; the corners belong to the heads
  assert.equal(prox('T1-L-01', 'T1-R-01'), DEFAULT_PROXIMITY.across)
  assert.equal(prox('T1-L-05', 'T1-R-04'), DEFAULT_PROXIMITY.across)
  assert.ok(seatsAdjacent(at('T1-HEAD-S'), at('T1-L-05')))
  assert.ok(seatsAdjacent(at('T1-HEAD-S'), at('T1-R-04')))
  assert.ok(!seatsAdjacent(at('T1-HEAD-S'), at('T1-L-04')))
  assert.ok(seatsAdjacent(at('T1-L-04'), at('T1-L-05')))
  // The middle seat of the squeezed side sits between two seats across
  assert.equal(prox('T1-L-03', 'T1-R-02'), DEFAULT_PROXIMITY.diagonal)
  assert.equal(prox('T1-L-03', 'T1-R-03'), DEFAULT_PROXIMITY.diagonal)
})

test("a guest's weight multiplies their utility", () => {
  const plain = makeProblem(20)
  const guestAt = identity(plain)
  const weighted = { ...plain, weight: Float64Array.from(plain.weight, (w, g) => (g === 3 ? 2 : w)) }
  const a = new Scorer(plain, guestAt)
  const b = new Scorer(weighted, guestAt)
  const u = (s: Scorer, g: number) => s.utility(g, s.h[g], s.known[g], s.seatOf[g])
  assert.equal(u(b, 3), 2 * u(a, 3))
  assert.equal(u(b, 4), u(a, 4))
  assert.ok(Math.abs(b.total - a.total - u(a, 3)) < 1e-9)
})

test('incremental swaps always match a full recompute', () => {
  for (const objective of [
    {},
    { fairness: 'sum' as const },
    { fairness: 'concave' as const, headBonus: 0.2 },
    { minKnownAtTable: 3, headBonus: 0.1, proximity: { ...DEFAULT_PROXIMITY, headSecondRow: 0.4 } },
  ]) {
    const p = makeProblem(20, objective)
    p.weight[0] = 2 // Weighted guests too
    p.weight[9] = 0.5
    const scorer = new Scorer(p, identity(p))
    const rng = mulberry32(3)
    for (let i = 0; i < 3000; i++) {
      const a = Math.floor(rng() * p.S)
      const b = Math.floor(rng() * p.S)
      const before = scorer.total
      const d = scorer.applySwap(a, b)
      assert.ok(Math.abs(scorer.total - (before + d)) < 1e-9)
      if (rng() < 0.3) scorer.applySwap(a, b)
    }
    const incremental = scorer.total
    const h = Array.from(scorer.h)
    scorer.recompute()
    assert.ok(Math.abs(incremental - scorer.total) < 1e-6, `${JSON.stringify(objective)}: ${incremental} vs ${scorer.total}`)
    h.forEach((v, g) => assert.ok(Math.abs(v - scorer.h[g]) < 1e-6))
  }
})

test('swapDelta leaves the seating unchanged', () => {
  const p = makeProblem(16)
  const scorer = new Scorer(p, identity(p))
  const before = Int32Array.from(scorer.guestAt)
  const total = scorer.total
  const d = scorer.swapDelta(0, 5)
  assert.deepEqual(scorer.guestAt, before)
  assert.ok(Math.abs(scorer.total - total) < 1e-9)
  scorer.applySwap(0, 5)
  assert.ok(Math.abs(scorer.total - (total + d)) < 1e-9)
})

test('violations count broken constraints and head requirements', () => {
  const p = makeProblem(16)
  const scorer = new Scorer(p, identity(p))
  const kinds = scorer.violations().map((v) => v.kind)
  const penalty = p.objective.constraintPenalty
  const withoutPenalty = scorer.guestScores().reduce((sum, g) => sum + g.utility, 0)
  assert.ok(Math.abs(scorer.total - (withoutPenalty - penalty * kinds.length)) < 1e-9)
})

test('greedy assignment is valid, keeps locks, and seats head guests at heads', () => {
  const p = makeProblem(20)
  const locked = new Uint8Array(p.S)
  const start = identity(p)
  locked[5] = 1
  const guestAt = greedyAssignment(p, start, locked)
  assert.ok(isPermutation(guestAt))
  assert.equal(guestAt[5], start[5])
  const scorer = new Scorer(p, guestAt)
  assert.ok(scorer.violations().every((v) => v.kind !== 'HEAD'))
})

for (const spec of ALGORITHMS) {
  test(`${spec.name} improves on a random seating and never moves locked seats`, async () => {
    await prepareAlgorithm(spec.id as AlgorithmId)
    const p = makeProblem(24)
    const locked = new Uint8Array(p.S)
    locked[3] = 1
    locked[10] = 1
    const start = randomAssignment(p, identity(p), locked, 11)
    const startScore = new Scorer(p, start).total
    const params = { ...defaultParams(spec.id as AlgorithmId) }
    // Keep the test quick
    for (const key of ['iterations', 'maxEvaluations']) if (key in params) params[key] = 60_000
    if ('steps' in params) params.steps = 400
    if ('generations' in params) params.generations = 60
    const solver = createSolver(spec.id, p, start, locked, params, 5)
    for (let i = 0; i < 1000 && !solver.progress().done; i++) solver.step(5000)
    const progress = solver.progress()
    assert.ok(progress.done, `${spec.id} should finish`)
    const best = solver.best()
    assert.ok(isPermutation(best))
    assert.equal(best[3], start[3])
    assert.equal(best[10], start[10])
    assert.ok(progress.best > startScore, `${spec.id}: ${progress.best} <= ${startScore}`)
    assert.ok(Math.abs(new Scorer(p, best).total - progress.best) < 1e-6, `${spec.id} best score should match its seating`)
  })
}

test('assignmentFromSeatKeys restores saved seats and fills the rest', () => {
  const p = makeProblem(10)
  const saved = new Map([
    [p.guestIds[0], p.seats[4].key],
    [p.guestIds[1], 'T9-L-01'], // A seat that doesn't exist
  ])
  const guestAt = assignmentFromSeatKeys(p, saved)
  assert.ok(isPermutation(guestAt))
  assert.equal(guestAt[4], 0)
  assert.ok(Array.from(guestAt).includes(1))
})

test('scaleToEvaluations sizes each schedule to the budget', () => {
  assert.equal(scaleToEvaluations('annealing', { ...defaultParams('annealing'), runs: 2 }, 1_000_000, 50).iterations, 500_000)
  assert.equal(scaleToEvaluations('hillClimbing', defaultParams('hillClimbing'), 300_000, 50).maxEvaluations, 300_000)
  assert.equal(scaleToEvaluations('tabu', { ...defaultParams('tabu'), neighborhood: 100 }, 50_000, 50).steps, 500)
  assert.equal(scaleToEvaluations('genetic', { ...defaultParams('genetic'), populationSize: 10, memeticSteps: 50 }, 100_000, 50).generations, 100)
  assert.equal(scaleToEvaluations('twoStage', defaultParams('twoStage'), 123_456, 50).iterations, 123_456)
})

test('happinessPotential bounds every guest’s happiness and is exact for a simple case', () => {
  const p = makeProblem(20, { proximity: { ...DEFAULT_PROXIMITY, headSecondRow: 0.3 } })
  const potential = happinessPotential(p)
  const rng = mulberry32(11)
  for (let i = 0; i < 200; i++) {
    const scorer = new Scorer(p, randomAssignment(p, identity(p), new Uint8Array(p.S), Math.floor(rng() * 1e6)))
    scorer.h.forEach((h, g) => assert.ok(h <= potential[g] + 1e-9, `guest ${g}: ${h} > ${potential[g]}`))
  }

  // One guest who likes three people (3, 2, 1): best is the two side seats and across, at a side seat
  const guests = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id }))
  const affinityMap = new Map<string, EffectiveAffinity>([
    [pairKey('a', 'b'), { affinity: 3, source: 'explicit', label: '' }],
    [pairKey('a', 'c'), { affinity: 2, source: 'explicit', label: '' }],
    [pairKey('a', 'd'), { affinity: 1, source: 'explicit', label: '' }],
    [pairKey('a', 'e'), { affinity: -3, source: 'explicit', label: '' }],
  ])
  const small = buildProblem({ guests, affinityMap, relationships: [], headIds: new Set(), layout: { tables: 2, seatsPerSide: 3, heads: false }, objective: DEFAULT_OBJECTIVE })
  const w = DEFAULT_PROXIMITY
  assert.ok(Math.abs(happinessPotential(small)[0] - (3 * w.side + 2 * w.side + 1 * w.across)) < 1e-9)
  assert.equal(happinessPotential(small)[4], 0) // e has no positive ties
})
