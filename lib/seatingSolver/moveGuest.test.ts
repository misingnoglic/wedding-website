import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoLayout } from './layout'
import { moveGuest, partnerOf } from './moveGuest'
import { buildProblem, DEFAULT_OBJECTIVE, Problem } from './problem'
import { Scorer } from './scorer'

// Ten guests; g0 and g1 must sit next to each other, g2 and g3 too, and g4 must sit next to both g5 and g6
function makeProblem(): Problem {
  const guests = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, name: `Guest ${i}` }))
  const adjacent = (a: number, b: number) => ({ guestAId: `g${a}`, guestBId: `g${b}`, constraint: 'ADJACENT' })
  return buildProblem({
    guests,
    affinityMap: new Map(),
    relationships: [adjacent(0, 1), adjacent(2, 3), adjacent(4, 5), adjacent(4, 6)],
    headIds: new Set(),
    layout: autoLayout(12, 2, true),
    objective: DEFAULT_OBJECTIVE,
  })
}

// A side seat at the second table, for moving g0 there
const target = (p: Problem) => p.seats.findIndex((s) => s.table === 1 && !s.isHead)

// A seating with g0 and g1 side by side, and everyone else filling the rest in order
function seated(p: Problem): Int32Array {
  const a = p.seats.findIndex((s) => s.table === 0 && !s.isHead)
  const b = p.seats.findIndex((s, i) => p.adjacent[a * p.S + i] && !s.isHead)
  const guestAt = new Int32Array(p.S).fill(-1)
  guestAt[a] = 0
  guestAt[b] = 1
  let next = 2
  for (let s = 0; s < p.S; s++) if (guestAt[s] === -1) guestAt[s] = next++
  return guestAt
}

const apply = (guestAt: Int32Array, swaps: [number, number][]) => {
  const next = Int32Array.from(guestAt)
  for (const [x, y] of swaps) [next[x], next[y]] = [next[y], next[x]]
  return next
}

test('partnerOf finds a single must-sit-next-to partner and ignores guests with two', () => {
  const scorer = new Scorer(makeProblem(), Int32Array.from({ length: 12 }, (_, i) => i))
  assert.equal(partnerOf(scorer, 0), 1)
  assert.equal(partnerOf(scorer, 3), 2)
  assert.equal(partnerOf(scorer, 4), -1)
  assert.equal(partnerOf(scorer, 7), -1)
})

test('moving half of a couple brings the partner to a seat beside the target', () => {
  const p = makeProblem()
  const scorer = new Scorer(p, seated(p))
  const from = scorer.seatOf[0]
  const to = target(p)
  const before = scorer.total
  const move = moveGuest(scorer, from, to, () => false)
  assert.equal(move.swaps.length, 2)
  assert.equal(scorer.total, before, 'measuring leaves the seating as it was')
  const after = new Scorer(p, apply(scorer.guestAt, move.swaps))
  assert.equal(after.seatOf[0], to)
  assert.equal(p.adjacent[after.seatOf[0] * p.S + after.seatOf[1]], 1)
  assert.ok(Math.abs(after.total - before - move.delta) < 1e-9)
})

test('a plain swap for singles, trading places with the partner, and locked partner seats', () => {
  const p = makeProblem()
  const scorer = new Scorer(p, seated(p))
  const from = scorer.seatOf[0]
  const partnerSeat = scorer.seatOf[1]
  const to = target(p)
  assert.deepEqual(moveGuest(scorer, scorer.seatOf[7], to, () => false).swaps, [[scorer.seatOf[7], to]])
  assert.deepEqual(moveGuest(scorer, from, partnerSeat, () => false).swaps, [[from, partnerSeat]])
  assert.deepEqual(moveGuest(scorer, from, to, (s) => s === partnerSeat).swaps, [[from, to]])
  // Locked seats beside the target are never used for the partner
  const move = moveGuest(scorer, from, to, (s) => s !== to && p.adjacent[to * p.S + s] === 1)
  assert.deepEqual(move.swaps, [[from, to]])
})
