import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAffinityMap,
  endpointFromColumns,
  findSeatingWarnings,
  getAffinity,
  isInSeatingPool,
  isSeatingConstraint,
  isSeatRequirement,
  isValidAffinity,
  linkKey,
  linkProblem,
  normalizePair,
  pairKey,
} from './seating'

const guests = [
  { id: 'a', familyId: 'f1' },
  { id: 'b', familyId: 'f1' },
  { id: 'c', familyId: 'f2' },
  { id: 'd', familyId: 'f3' },
]

test('normalizePair and pairKey are order independent', () => {
  assert.deepEqual(normalizePair('b', 'a'), ['a', 'b'])
  assert.deepEqual(normalizePair('a', 'b'), ['a', 'b'])
  assert.equal(pairKey('b', 'a'), pairKey('a', 'b'))
})

test('isValidAffinity', () => {
  assert.ok(isValidAffinity(-3))
  assert.ok(isValidAffinity(0))
  assert.ok(isValidAffinity(3))
  assert.ok(!isValidAffinity(4))
  assert.ok(!isValidAffinity(1.5))
  assert.ok(!isValidAffinity('2'))
  assert.ok(!isValidAffinity(null))
})

test('isSeatingConstraint', () => {
  assert.ok(isSeatingConstraint('ADJACENT'))
  assert.ok(!isSeatingConstraint('adjacent'))
  assert.ok(!isSeatingConstraint(null))
})

test('isInSeatingPool skips excluded and declined guests but keeps pending ones', () => {
  assert.ok(isInSeatingPool({ excludeFromSeating: false, isAttendingWedding: true }))
  assert.ok(isInSeatingPool({ excludeFromSeating: false, isAttendingWedding: null }))
  assert.ok(!isInSeatingPool({ excludeFromSeating: false, isAttendingWedding: false }))
  assert.ok(!isInSeatingPool({ excludeFromSeating: true, isAttendingWedding: true }))
})

test('same family gets the family baseline', () => {
  const map = buildAffinityMap(guests, [], [])
  assert.equal(getAffinity(map, 'a', 'b'), 2)
  assert.equal(map.get(pairKey('a', 'b'))?.source, 'family')
  assert.equal(getAffinity(map, 'a', 'c'), 0)
})

test('the highest baseline among shared groups wins', () => {
  const map = buildAffinityMap(
    guests,
    [
      { id: 'g1', name: 'Work', affinity: 1, memberIds: ['a', 'c', 'd'] },
      { id: 'g2', name: 'College', affinity: 3, memberIds: ['a', 'c'] },
      { id: 'g3', name: 'Feud', affinity: -2, memberIds: ['a', 'b'] },
    ],
    []
  )
  assert.equal(getAffinity(map, 'a', 'c'), 3)
  assert.equal(map.get(pairKey('a', 'c'))?.label, 'College')
  assert.equal(getAffinity(map, 'c', 'd'), 1)
  // A negative group doesn't override the positive family baseline
  assert.equal(getAffinity(map, 'a', 'b'), 2)
})

test('explicit ratings override baselines, and null affinity falls back', () => {
  const map = buildAffinityMap(
    guests,
    [{ id: 'g1', name: 'Work', affinity: 1, memberIds: ['a', 'c'] }],
    [
      { guestAId: 'a', guestBId: 'b', affinity: -3, constraint: null },
      { guestAId: 'a', guestBId: 'c', affinity: null, constraint: 'SAME_TABLE' },
    ]
  )
  assert.equal(getAffinity(map, 'b', 'a'), -3)
  assert.equal(map.get(pairKey('a', 'b'))?.source, 'explicit')
  assert.equal(getAffinity(map, 'a', 'c'), 1)
})

test('group links give every cross-group pair a baseline', () => {
  const groups = [
    { id: 'g1', name: 'College', affinity: 2, memberIds: ['a', 'c'] },
    { id: 'g2', name: 'Work', affinity: 1, memberIds: ['c', 'd'] },
  ]
  const link = (affinity: number) => ({ a: { type: 'group' as const, id: 'g1' }, b: { type: 'group' as const, id: 'g2' }, affinity })
  const map = buildAffinityMap(guests, groups, [], [link(3)])
  assert.equal(getAffinity(map, 'a', 'd'), 3)
  assert.equal(map.get(pairKey('a', 'd'))?.label, 'College ↔ Work')
  // c is in both groups: the link outranks College's +2 for a–c, but no one is linked to themselves
  assert.equal(getAffinity(map, 'a', 'c'), 3)
  assert.equal(map.get(pairKey('c', 'c')), undefined)
  // Links never beat a higher baseline or an explicit rating
  const lowLink = buildAffinityMap(guests, groups, [{ guestAId: 'a', guestBId: 'd', affinity: -1, constraint: null }], [link(1)])
  assert.equal(getAffinity(lowLink, 'a', 'c'), 2)
  assert.equal(getAffinity(lowLink, 'a', 'd'), -1)
})

test('links can join parties and single guests', () => {
  const named = guests.map((g) => ({ ...g, name: g.id.toUpperCase(), familyName: `Family ${g.familyId}` }))
  const map = buildAffinityMap(
    named,
    [{ id: 'g1', name: 'Work', affinity: 1, memberIds: ['d'] }],
    [],
    [
      { a: { type: 'guest', id: 'd' }, b: { type: 'family', id: 'f1' }, affinity: 3 },
      { a: { type: 'family', id: 'f2' }, b: { type: 'group', id: 'g1' }, affinity: -2 },
    ]
  )
  assert.equal(getAffinity(map, 'd', 'a'), 3)
  assert.equal(getAffinity(map, 'd', 'b'), 3)
  assert.equal(map.get(pairKey('a', 'd'))?.label, 'D ↔ Family f1')
  assert.equal(getAffinity(map, 'c', 'd'), -2)
  assert.equal(getAffinity(map, 'a', 'c'), 0)
})

test('link keys are order independent and reject guest pairs', () => {
  const group = { type: 'group' as const, id: 'g1' }
  const guest = { type: 'guest' as const, id: 'a' }
  assert.equal(linkKey(group, guest), linkKey(guest, group))
  assert.equal(linkKey(group, guest), 'group:g1|guest:a')
  assert.equal(linkProblem(group, guest), null)
  assert.ok(linkProblem(guest, { type: 'guest', id: 'b' }))
  assert.ok(linkProblem(group, group))
  assert.deepEqual(endpointFromColumns(null, 'f1', null), { type: 'family', id: 'f1' })
  assert.equal(endpointFromColumns(null, null, null), null)
})

test('guests outside the pool are ignored', () => {
  const map = buildAffinityMap(
    guests.slice(0, 2),
    [{ id: 'g1', name: 'Work', affinity: 3, memberIds: ['a', 'c'] }],
    [{ guestAId: 'b', guestBId: 'd', affinity: 3, constraint: null }]
  )
  assert.equal(map.size, 1)
  assert.equal(getAffinity(map, 'a', 'c'), 0)
})

test('findSeatingWarnings flags isolated and over-constrained guests', () => {
  const relationships = [
    { guestAId: 'a', guestBId: 'b', affinity: null, constraint: 'ADJACENT' },
    { guestAId: 'a', guestBId: 'c', affinity: 1, constraint: 'ADJACENT' },
    { guestAId: 'a', guestBId: 'd', affinity: null, constraint: 'ADJACENT' },
  ]
  const map = buildAffinityMap(guests, [], relationships)
  const { isolated, overConstrained } = findSeatingWarnings(['a', 'b', 'c', 'd'], map, relationships)
  assert.deepEqual([...isolated].sort(), ['c', 'd'])
  assert.deepEqual([...overConstrained], ['a'])
})

test('findSeatingWarnings flags impossible head requirements', () => {
  const adjacent = [{ guestAId: 'a', guestBId: 'b', affinity: null, constraint: 'ADJACENT' }]
  const map = buildAffinityMap(guests, [], adjacent)
  // Two must-sit-next-to guests can't both take heads
  assert.deepEqual([...findSeatingWarnings(['a', 'b', 'c', 'd'], map, adjacent, ['a', 'b']).headConflicts].sort(), ['a', 'b'])
  assert.equal(findSeatingWarnings(['a', 'b', 'c', 'd'], map, adjacent, ['a', 'c']).headConflicts.size, 0)
  // More head guests than head seats
  const pool = ['a', 'b', 'c', 'd', 'e']
  assert.equal(findSeatingWarnings(pool, map, [], ['a', 'b', 'c', 'd']).headConflicts.size, 0)
  assert.equal(findSeatingWarnings(pool, map, [], pool).headConflicts.size, 5)
  // Guests outside the pool don't count
  assert.equal(findSeatingWarnings(['a', 'b', 'c', 'd'], map, [], pool).headConflicts.size, 0)
})

test('isSeatRequirement', () => {
  assert.ok(isSeatRequirement('HEAD'))
  assert.ok(!isSeatRequirement('head'))
  assert.ok(!isSeatRequirement(null))
})
