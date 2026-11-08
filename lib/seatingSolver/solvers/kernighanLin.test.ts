import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../../seating'
import { createSolver, randomAssignment, scaleToEvaluations } from '../algorithms'
import { LayoutConfig } from '../layout'
import { buildProblem, DEFAULT_OBJECTIVE, ObjectiveConfig, Problem, tableLevelProblem } from '../problem'
import { mulberry32 } from '../random'
import { Scorer } from '../scorer'
import { TableSplit } from './kernighanLin'

type Rule = [number, number, string]

function makeProblem(guestCount: number, layout: LayoutConfig, rules: Rule[], heads: number[] = [], objective: Partial<ObjectiveConfig> = {}): Problem {
  const rng = mulberry32(3)
  const guests = Array.from({ length: guestCount }, (_, i) => ({ id: `g${String(i).padStart(2, '0')}`, name: `Guest ${i}` }))
  const affinityMap = new Map<string, EffectiveAffinity>()
  for (let i = 0; i < guestCount; i++) {
    for (let j = i + 1; j < guestCount; j++) {
      const r = rng()
      if (r < 0.3) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: Math.ceil(rng() * 3), source: 'explicit', label: '' })
      else if (r < 0.35) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: -Math.ceil(rng() * 3), source: 'explicit', label: '' })
    }
  }
  return buildProblem({
    guests,
    affinityMap,
    relationships: rules.map(([a, b, constraint]) => ({ guestAId: guests[a].id, guestBId: guests[b].id, constraint })),
    headIds: new Set(heads.map((g) => guests[g].id)),
    layout,
    objective: { ...DEFAULT_OBJECTIVE, ...objective },
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)

function solve(p: Problem, locked: Uint8Array, start: Int32Array, evaluations: number, seed = 1, params = {}) {
  const solver = createSolver('kernighanLin', p, start, locked, scaleToEvaluations('kernighanLin', params, evaluations, p.n), seed)
  while (!solver.progress().done) solver.step(20_000)
  return solver
}

function isPermutation(guestAt: Int32Array): boolean {
  return new Set(guestAt).size === guestAt.length && Math.min(...guestAt) === 0 && Math.max(...guestAt) === guestAt.length - 1
}

// Couples (must sit next to each other, chained through guest 4), a same-table pair and a different-table pair
const RULES: Rule[] = [
  [0, 1, 'ADJACENT'],
  [2, 3, 'ADJACENT'],
  [3, 4, 'ADJACENT'],
  [5, 6, 'SAME_TABLE'],
  [7, 8, 'DIFFERENT_TABLE'],
  [9, 10, 'ADJACENT'],
]

test('table split gains and scores match the table-level scorer exactly', () => {
  const p = makeProblem(30, { tables: 3, seatsPerSide: 5, heads: true }, RULES, [], { minKnownAtTable: 2 })
  const tp = tableLevelProblem(p)
  const locked = new Uint8Array(p.S)
  const split = new TableSplit(tp, new Scorer(tp, identity(p)), identity(p), locked)
  const rng = mulberry32(9)
  split.load(split.random(rng))
  const seated = () => new Scorer(tp, split.seating(split.table, identity(p), locked, null)).total
  assert.ok(Math.abs(split.total - seated()) < 1e-9)
  for (let k = 0; k < 200; k++) {
    const i = split.free[Math.floor(rng() * split.free.length)]
    const b = (split.table[i] + 1 + Math.floor(rng() * 2)) % 3
    const before = split.total
    const gain = split.gain(i, b)
    split.move(i, b, gain)
    // Capacity isn't scored, so compare only splits that fit
    if (split.fits()) assert.ok(Math.abs(split.total - seated()) < 1e-6, `move ${k}: ${split.total} vs ${seated()}`)
    assert.ok(Math.abs(split.total - before - gain) < 1e-9)
  }
})

test('kernighanLin keeps couples and same-table pairs together and different-table pairs apart', () => {
  const p = makeProblem(40, { tables: 2, seatsPerSide: 10, heads: true }, RULES, [11])
  const locked = new Uint8Array(p.S)
  for (const seed of [1, 2, 3]) {
    const solver = solve(p, locked, randomAssignment(p, identity(p), locked, seed), 300_000, seed)
    const best = solver.best()
    assert.ok(isPermutation(best))
    const scorer = new Scorer(p, best)
    const table = (g: number) => p.tableOf[scorer.seatOf[g]]
    assert.equal(table(0), table(1))
    assert.equal(table(2), table(4))
    assert.equal(table(5), table(6))
    assert.notEqual(table(7), table(8))
    assert.deepEqual(scorer.violations(), [], `seed ${seed}`)
    assert.ok(Math.abs(solver.progress().best - scorer.total) < 1e-6)
  }
})

test('kernighanLin never puts more head guests on a table than it has head seats', () => {
  // Three head guests, two tables with two heads each: one table must take two of them
  const p = makeProblem(36, { tables: 2, seatsPerSide: 8, heads: true }, [[12, 13, 'ADJACENT']], [12, 14, 15])
  const locked = new Uint8Array(p.S)
  const tp = tableLevelProblem(p)
  const split = new TableSplit({ ...tp, mustHead: p.mustHead }, new Scorer(tp, identity(p)), identity(p), locked)
  const rng = mulberry32(4)
  for (let k = 0; k < 20; k++) {
    split.load(split.random(rng))
    assert.ok(split.fits())
  }
  const best = solve(p, locked, randomAssignment(p, identity(p), locked, 2), 200_000).best()
  const scorer = new Scorer(p, best)
  for (const g of [12, 14, 15]) assert.equal(p.isHead[scorer.seatOf[g]], 1, `guest ${g} at a head`)
  assert.deepEqual(scorer.violations(), [])
})

test('kernighanLin never moves locked seats and brings partners to a locked guest', () => {
  const p = makeProblem(28, { tables: 2, seatsPerSide: 7, heads: true }, RULES)
  const locked = new Uint8Array(p.S)
  const start = randomAssignment(p, identity(p), locked, 5)
  // Lock guest 0 where they sit and one side seat on the other table
  const seat0 = start.indexOf(0)
  locked[seat0] = 1
  const far = p.seats.findIndex((s, i) => p.tableOf[i] !== p.tableOf[seat0] && !s.isHead)
  locked[far] = 1
  const best = solve(p, locked, start, 200_000).best()
  assert.equal(best[seat0], 0)
  assert.equal(best[far], start[far])
  const scorer = new Scorer(p, best)
  assert.equal(p.tableOf[scorer.seatOf[1]], p.tableOf[seat0])
})

test('kernighanLin handles empty seats, one table and the plain-swap seat stage', () => {
  const p = makeProblem(25, { tables: 3, seatsPerSide: 4, heads: true }, RULES) // 30 seats
  const locked = new Uint8Array(p.S)
  for (const params of [{}, { seatMoves: 'swaps' }]) {
    const best = solve(p, locked, randomAssignment(p, identity(p), locked, 1), 150_000, 1, params).best()
    assert.ok(isPermutation(best))
    assert.deepEqual(new Scorer(p, best).violations(), [])
  }
  const single = makeProblem(12, { tables: 1, seatsPerSide: 6, heads: false }, [[0, 1, 'ADJACENT']])
  const none = new Uint8Array(single.S)
  const best = solve(single, none, randomAssignment(single, identity(single), none, 1), 50_000).best()
  assert.ok(isPermutation(best))
})

test('kernighanLin is deterministic for a seed', () => {
  const p = makeProblem(30, { tables: 2, seatsPerSide: 8, heads: true }, RULES)
  const locked = new Uint8Array(p.S)
  const start = randomAssignment(p, identity(p), locked, 8)
  const a = solve(p, locked, start, 100_000, 7).best()
  const b = solve(p, locked, start, 100_000, 7).best()
  assert.deepEqual(Array.from(a), Array.from(b))
})
