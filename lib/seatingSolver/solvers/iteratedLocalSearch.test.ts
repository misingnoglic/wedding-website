import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../../seating'
import { createSolver, defaultParams, randomAssignment } from '../algorithms'
import { autoLayout } from '../layout'
import { buildProblem, DEFAULT_OBJECTIVE, Problem } from '../problem'
import { Params } from '../core'
import { Scorer } from '../scorer'

// Two friend groups of 10 that should each get a table, plus two must-sit-next-to couples
function plantedProblem(): Problem {
  const guests = Array.from({ length: 20 }, (_, i) => ({ id: `g${String(i).padStart(2, '0')}`, name: `Guest ${i}` }))
  const affinityMap = new Map<string, EffectiveAffinity>()
  for (let i = 0; i < 20; i++) {
    for (let j = i + 1; j < 20; j++) {
      const sameGroup = i < 10 === j < 10
      affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: sameGroup ? 2 : -1, source: 'explicit', label: '' })
    }
  }
  return buildProblem({
    guests,
    affinityMap,
    relationships: [
      { guestAId: 'g00', guestBId: 'g01', constraint: 'ADJACENT' },
      { guestAId: 'g12', guestBId: 'g13', constraint: 'ADJACENT' },
    ],
    headIds: new Set(),
    layout: autoLayout(20, 2, true),
    objective: DEFAULT_OBJECTIVE,
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)

function run(p: Problem, start: Int32Array, locked: Uint8Array, params: Params, seed = 3) {
  const solver = createSolver('iteratedLocalSearch', p, start, locked, { ...defaultParams('iteratedLocalSearch'), ...params }, seed)
  for (let i = 0; i < 2000 && !solver.progress().done; i++) solver.step(5000)
  return solver
}

test('iterated local search puts each friend group at its own table and keeps couples together', () => {
  const p = plantedProblem()
  const locked = new Uint8Array(p.S)
  const start = randomAssignment(p, identity(p), locked, 5)
  const solver = run(p, start, locked, { maxEvaluations: 200_000 })
  const scorer = new Scorer(p, solver.best())
  const tableOf = (g: number) => p.tableOf[scorer.seatOf[g]]
  for (let g = 1; g < 10; g++) assert.equal(tableOf(g), tableOf(0), `guest ${g} should sit with group A`)
  for (let g = 11; g < 20; g++) assert.equal(tableOf(g), tableOf(10), `guest ${g} should sit with group B`)
  assert.notEqual(tableOf(0), tableOf(10))
  assert.deepEqual(scorer.violations(), [])
})

test('every climb and kick keeps locked seats, stays a valid seating, and reports its true best', () => {
  const p = plantedProblem()
  const locked = new Uint8Array(p.S)
  locked[2] = 1
  locked[p.S - 3] = 1
  const start = randomAssignment(p, identity(p), locked, 9)
  for (const climb of ['anneal', 'scan']) {
    for (const kick of ['segment', 'swaps', 'section', 'mixed']) {
      for (const splitSearch of ['kicks', 'anneal']) {
        const solver = run(p, start, locked, { maxEvaluations: 60_000, climb, kick, splitSearch, refineIterations: 5000, seatShare: 0.1 })
        const label = `${climb}/${kick}/${splitSearch}`
        const best = solver.best()
        assert.equal(new Set(best).size, p.S, `${label}: not a permutation`)
        assert.equal(best[2], start[2], `${label}: moved a locked seat`)
        assert.equal(best[p.S - 3], start[p.S - 3], `${label}: moved a locked seat`)
        assert.ok(Math.abs(new Scorer(p, best).total - solver.progress().best) < 1e-6, `${label}: best score should match its seating`)
        assert.ok(solver.progress().evaluations <= 60_000 + 5000, `${label}: overran its budget`)
      }
    }
  }
})
