import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../../seating'
import { defaultParams, randomAssignment, scaleToEvaluations } from '../algorithms'
import { Moves } from '../core'
import { autoLayout } from '../layout'
import { buildProblem, DEFAULT_OBJECTIVE, ObjectiveConfig, Problem } from '../problem'
import { mulberry32 } from '../random'
import { Scorer } from '../scorer'
import { tableScores, TemperingLadder } from './parallelTempering'

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
    layout: autoLayout(guestCount + 3, 2, true),
    objective: { ...DEFAULT_OBJECTIVE, ...objective },
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)
const tablesOf = (p: Problem, guestAt: Int32Array) => Array.from({ length: p.S }, (_, g) => p.tableOf[guestAt.indexOf(g)])

test('table scores add up to the total, up to constraints across tables', () => {
  for (const objective of [{}, { minKnownAtTable: 3, headBonus: 0.2 }]) {
    const p = makeProblem(24, objective)
    const scorer = new Scorer(p, randomAssignment(p, identity(p), new Uint8Array(p.S), 3))
    const crossTable = p.pairs.filter((c) => p.tableOf[scorer.seatOf[c.x]] !== p.tableOf[scorer.seatOf[c.y]] && scorer.violated(c)).length
    const sum = tableScores(scorer, new Float64Array(p.layout.tables)).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(sum - p.objective.constraintPenalty * crossTable - scorer.total) < 1e-9)
  }
})

test('seat-order tempering keeps everyone at their table and its combined best is real', () => {
  for (const tradeTables of [true, false]) {
    const p = makeProblem(24, { minKnownAtTable: 2 })
    const locked = new Uint8Array(p.S)
    locked[2] = 1
    const start = randomAssignment(p, identity(p), locked, 9)
    const ladder = new TemperingLadder(p, [start, start, start, start], 0.3, 3, new Moves(p, locked, 1), mulberry32(4), 80_000, 50, 0.3, 1, 'sameTable', tradeTables)
    while (!ladder.done) ladder.step(10_000)
    const best = ladder.bestAt()
    assert.deepEqual(tablesOf(p, best), tablesOf(p, start))
    assert.equal(best[2], start[2])
    for (const r of ladder.replicas) assert.deepEqual(tablesOf(p, r.guestAt), tablesOf(p, start))
    assert.ok(Math.abs(new Scorer(p, best).total - ladder.bestScore) < 1e-6, `combined best should score ${ladder.bestScore}`)
    assert.ok(ladder.bestScore >= Math.max(...ladder.replicas.map((r) => r.total)) - 1e-6)
    if (tradeTables) assert.ok(ladder.extraWork > 0, 'table trades should be charged')
  }
})

test('the table-stage ladder only works on who shares a table and tracks its best', () => {
  const p = makeProblem(24)
  const locked = new Uint8Array(p.S)
  const moves = new Moves(p, locked, 1)
  const rng = mulberry32(2)
  const starts = [0, 1, 2].map((i) => randomAssignment(p, identity(p), locked, 20 + i))
  const ladder = new TemperingLadder(p, starts, 0.1, 2, moves, rng, 30_000, 100, 0.3, 0.1, 'crossTable', true)
  while (!ladder.done) ladder.step(7_000)
  assert.ok(Math.abs(new Scorer(p, ladder.bestAt()).total - ladder.bestScore) < 1e-6)
  assert.ok(ladder.bestScore >= Math.max(...starts.map((g) => new Scorer(p, g).total)))
})

test('parallel tempering scales its schedule to the budget', () => {
  assert.equal(scaleToEvaluations('parallelTempering', defaultParams('parallelTempering'), 345_678, 50).iterations, 345_678)
})
