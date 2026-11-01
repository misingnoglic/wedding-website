import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../../seating'
import { defaultParams, randomAssignment, scaleToEvaluations } from '../algorithms'
import { autoLayout } from '../layout'
import { buildProblem, DEFAULT_OBJECTIVE, Problem } from '../problem'
import { mulberry32 } from '../random'
import { Scorer } from '../scorer'
import { LnsSolver, Rebuilder } from './lns'

// 30 guests at two tables; g0–g1, g2–g3 and g4–g5 must sit next to each other, g6 at a head
function makeProblem(seed = 3): Problem {
  const rng = mulberry32(seed)
  const guests = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, name: `Guest ${i}` }))
  const affinityMap = new Map<string, EffectiveAffinity>()
  for (let i = 0; i < guests.length; i++)
    for (let j = i + 1; j < guests.length; j++)
      if (rng() < 0.3) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: Math.ceil(rng() * 3), source: 'explicit', label: '' })
  return buildProblem({
    guests,
    affinityMap,
    relationships: [
      { guestAId: 'g0', guestBId: 'g1', constraint: 'ADJACENT' },
      { guestAId: 'g2', guestBId: 'g3', constraint: 'ADJACENT' },
      { guestAId: 'g4', guestBId: 'g5', constraint: 'ADJACENT' },
    ],
    headIds: new Set(['g6']),
    layout: autoLayout(32, 2, true), // Two empty seats
    objective: DEFAULT_OBJECTIVE,
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)

test('rebuilding seats removed couples on neighboring seats', () => {
  const p = makeProblem()
  const rng = mulberry32(1)
  for (let trial = 0; trial < 50; trial++) {
    const scorer = new Scorer(p, randomAssignment(p, identity(p), new Uint8Array(p.S), trial))
    const rebuilder = new Rebuilder(p, scorer)
    // Pull out both couples' partners plus whoever sits next to g0, so there is a neighboring pair free
    const removed = new Set([0, 1, 2, 3, 7, 8, 9, 10])
    for (let s = 0; s < p.S; s++) if (p.adjacent[scorer.seatOf[0] * p.S + s]) removed.add(scorer.guestAt[s])
    for (let s = 0; s < p.S; s++) if (p.adjacent[scorer.seatOf[2] * p.S + s]) removed.add(scorer.guestAt[s])
    const tokens = [...removed]
    const seats = tokens.map((t) => scorer.seatOf[t])
    const plan = rebuilder.rebuild(tokens, seats, rng, trial % 2 === 1, 0)
    assert.deepEqual([...plan.keys()].sort((a, b) => a - b), [...seats].sort((a, b) => a - b))
    assert.deepEqual([...plan.values()].sort((a, b) => a - b), [...tokens].sort((a, b) => a - b))
    const seatOf = new Map([...plan].map(([s, t]) => [t, s]))
    assert.ok(p.adjacent[seatOf.get(0)! * p.S + seatOf.get(1)!], `trial ${trial}: g0 and g1 split`)
    assert.ok(p.adjacent[seatOf.get(2)! * p.S + seatOf.get(3)!], `trial ${trial}: g2 and g3 split`)
  }
})

test('an insertion check matches the real change in score', () => {
  const p = makeProblem()
  const scorer = new Scorer(p, randomAssignment(p, identity(p), new Uint8Array(p.S), 4))
  // Seating g at every seat after lifting them out must be worth exactly the score with g there
  // minus the score of a problem where g has no ties, rules or head requirement
  for (const g of [0, 6, 12]) {
    const A = Float64Array.from(p.A)
    for (let k = 0; k < p.n; k++) A[g * p.n + k] = A[k * p.n + g] = 0
    const mustHead = Uint8Array.from(p.mustHead)
    mustHead[g] = 0
    const without = { ...p, A, mustHead, pairs: p.pairs.filter((c) => c.x !== g && c.y !== g) }
    const alone = scorer.utility(g, 0, 0, 0)
    for (let s = 0; s < p.S; s++) {
      const seating = Int32Array.from(scorer.guestAt)
      const t = scorer.seatOf[g]
      ;[seating[s], seating[t]] = [seating[t], seating[s]]
      const there = new Scorer(p, seating)
      const r = new Rebuilder(p, there)
      r.lift([g])
      const expected = there.total - (new Scorer(without, seating).total - alone)
      assert.ok(Math.abs(r.insertValue(g, s) - expected) < 1e-9, `guest ${g} seat ${s}`)
    }
  }
})

test('LNS never moves locked seats, finishes on budget, and keeps couples together', () => {
  const p = makeProblem()
  const locked = new Uint8Array(p.S)
  const start = randomAssignment(p, identity(p), locked, 9)
  // Lock g1 where it sits (its partner g0 has to come to it) and two other guests
  for (const g of [1, 12, 20]) locked[start.indexOf(g)] = 1
  for (const acceptance of ['anneal', 'recordToRecord', 'better']) {
    const params = { ...scaleToEvaluations('lns', { ...defaultParams('lns'), acceptance }, 150_000, p.n) }
    const solver = new LnsSolver(p, start, locked, params, 2)
    while (!solver.progress().done) {
      solver.step(5000)
      for (let s = 0; s < p.S; s++) if (locked[s]) assert.equal(solver.current()[s], start[s])
    }
    const progress = solver.progress()
    assert.ok(progress.evaluations >= 150_000 && progress.evaluations < 160_000, `${progress.evaluations}`)
    const best = new Scorer(p, solver.best())
    assert.ok(Math.abs(best.total - progress.best) < 1e-6)
    assert.ok(Math.abs(new Scorer(p, solver.current()).total - progress.current) < 1e-6, 'current score drifted')
    assert.deepEqual(best.violations(), [], `${acceptance}: ${JSON.stringify(best.violations())}`)
  }
})

test('scale fits the budget and caps the table stage on long runs', () => {
  const at = (e: number) => scaleToEvaluations('lns', defaultParams('lns'), e, 68)
  assert.equal(at(2_000_000).maxEvaluations, 2_000_000)
  assert.equal(at(2_000_000).tableShare, 0.4)
  assert.equal(at(10_000_000).tableShare, 0.1)
})
