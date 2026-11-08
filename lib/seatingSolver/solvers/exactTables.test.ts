import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectiveAffinity, pairKey } from '../../seating'
import { autoLayout } from '../layout'
import { buildProblem, DEFAULT_OBJECTIVE, Problem, tableLevelProblem } from '../problem'
import { mulberry32 } from '../random'
import { Scorer } from '../scorer'
import { loadHighs, seatSplit, solveTableSplit } from './exactTables'

function makeProblem(guestCount: number, relationships: { guestAId: string; guestBId: string; constraint: string }[], headIds: string[], seed = 3): Problem {
  const rng = mulberry32(seed)
  const guests = Array.from({ length: guestCount }, (_, i) => ({ id: `g${String(i).padStart(2, '0')}`, name: `Guest ${i}` }))
  const affinityMap = new Map<string, EffectiveAffinity>()
  for (let i = 0; i < guestCount; i++) {
    for (let j = i + 1; j < guestCount; j++) {
      const r = rng()
      if (r < 0.35) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: Math.ceil(rng() * 3), source: 'explicit', label: '' })
      else if (r < 0.45) affinityMap.set(pairKey(guests[i].id, guests[j].id), { affinity: -Math.ceil(rng() * 3), source: 'explicit', label: '' })
    }
  }
  return buildProblem({
    guests,
    affinityMap,
    relationships,
    headIds: new Set(headIds),
    layout: autoLayout(guestCount + 2, 2, true), // A couple of empty seats
    objective: { ...DEFAULT_OBJECTIVE, headBonus: 0 }, // The table-level score has no head bonus to compare against
  })
}

const identity = (p: Problem) => Int32Array.from({ length: p.S }, (_, i) => i)
const tableOfGuest = (p: Problem, guestAt: Int32Array) => {
  const table = new Int32Array(p.n)
  for (let s = 0; s < p.S; s++) if (guestAt[s] < p.n) table[guestAt[s]] = p.tableOf[s]
  return table
}

test('the integer program honors table rules, capacity, heads and locks', async () => {
  const highs = await loadHighs()
  const p = makeProblem(
    18,
    [
      { guestAId: 'g00', guestBId: 'g01', constraint: 'ADJACENT' },
      { guestAId: 'g02', guestBId: 'g03', constraint: 'SAME_TABLE' },
      { guestAId: 'g04', guestBId: 'g05', constraint: 'DIFFERENT_TABLE' },
      { guestAId: 'g00', guestBId: 'g04', constraint: 'SAME_TABLE' },
    ],
    ['g06', 'g07', 'g08']
  )
  const locked = new Uint8Array(p.S)
  const start = identity(p)
  // Lock guest 9 at the second table
  const lockSeat = p.seats.findIndex((s) => s.table === 1 && !s.isHead)
  ;[start[lockSeat], start[9]] = [start[9], start[lockSeat]]
  locked[lockSeat] = 1
  for (const model of ['flat', 'nearby'] as const) {
    const split = solveTableSplit(highs, p, start, locked, { model, pairWeight: 1, timeLimit: 20, seed: 1 })
    assert.equal(split.status, 'Optimal')
    const t = split.table
    assert.equal(t[0], t[1], `${model}: must-sit-next-to pair shares a table`)
    assert.equal(t[2], t[3], `${model}: same-table pair`)
    assert.equal(t[0], t[4], `${model}: same-table pair`)
    assert.notEqual(t[4], t[5], `${model}: different-table pair`)
    assert.equal(t[9], 1, `${model}: locked guest keeps their table`)
    const perTable = p.seats.length / 2
    for (const table of [0, 1]) {
      assert.ok(t.filter((v) => v === table).length <= perTable, `${model}: table ${table} fits`)
      const heads = [6, 7, 8].filter((g) => t[g] === table).length
      assert.ok(heads <= 2, `${model}: at most two head guests at table ${table}`)
    }
    // Seating the split keeps everyone at their table, head guests at heads, and the lock
    const seated = seatSplit(p, start, locked, t, mulberry32(4))
    assert.deepEqual(tableOfGuest(p, seated), t)
    assert.equal(seated[lockSeat], 9)
    const scorer = new Scorer(p, seated)
    assert.ok(scorer.violations().every((v) => v.kind !== 'HEAD' && v.kind !== 'SAME_TABLE' && v.kind !== 'DIFFERENT_TABLE'))
  }
})

test('the flat program finds the best table-level split', async () => {
  const highs = await loadHighs()
  const p = makeProblem(10, [{ guestAId: 'g00', guestBId: 'g01', constraint: 'ADJACENT' }], ['g02'], 9)
  const locked = new Uint8Array(p.S)
  const start = identity(p)
  const tp = tableLevelProblem(p)
  const perTable = p.S / 2
  // Every split that fits, scored at the table level
  let best = -Infinity
  for (let mask = 0; mask < 1 << p.n; mask++) {
    const table = Int32Array.from({ length: p.n }, (_, g) => (mask >> g) & 1)
    const ones = table.reduce((s, v) => s + v, 0)
    if (ones > perTable || p.n - ones > perTable) continue
    best = Math.max(best, new Scorer(tp, seatSplit(p, start, locked, table, mulberry32(1))).total)
  }
  const split = solveTableSplit(highs, p, start, locked, { model: 'flat', pairWeight: 1, timeLimit: 20, seed: 1 })
  assert.ok(Math.abs(split.objective - best) < 1e-6, `${split.objective} vs ${best}`)
  const found = new Scorer(tp, seatSplit(p, start, locked, split.table, mulberry32(2))).total
  assert.ok(Math.abs(found - best) < 1e-6)
})
