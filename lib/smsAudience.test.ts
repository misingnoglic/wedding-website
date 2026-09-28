import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AudienceGuest,
  DEFAULT_FILTERS,
  describeFilters,
  findUnknownPlaceholders,
  groupRecipients,
  matchesFilters,
  renderTemplate,
} from './smsAudience'

function guest(overrides: Partial<AudienceGuest> = {}): AudienceGuest {
  return {
    id: 'g1',
    name: 'Ana Lopez',
    phoneNumber: '(555) 123-4567',
    familyId: 'f1',
    familyName: 'The Lopez Family',
    familyPassword: 'sunset',
    isAttendingWelcome: null,
    isAttendingRehearsalDinner: null,
    isAttendingWedding: null,
    isRehearsalDinnerInvited: false,
    hasLoggedIn: false,
    hotelName: null,
    ...overrides,
  }
}

const filters = (overrides: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...overrides })

test('declined wedding guests are excluded unless opted in', () => {
  const declined = guest({ isAttendingWedding: false })
  assert.ok(!matchesFilters(declined, DEFAULT_FILTERS))
  assert.ok(matchesFilters(declined, filters({ includeDeclined: true })))
  assert.ok(matchesFilters(guest(), DEFAULT_FILTERS))
})

test('per-event RSVP filters', () => {
  assert.ok(matchesFilters(guest({ isAttendingWedding: true }), filters({ wedding: 'yes' })))
  assert.ok(!matchesFilters(guest({ isAttendingWedding: null }), filters({ wedding: 'yes' })))
  assert.ok(matchesFilters(guest(), filters({ welcome: 'pending' })))
  assert.ok(!matchesFilters(guest({ isAttendingWelcome: true }), filters({ welcome: 'pending' })))
})

test('rehearsal filter only matches invited guests', () => {
  const uninvited = guest({ isAttendingRehearsalDinner: null })
  assert.ok(!matchesFilters(uninvited, filters({ rehearsal: 'pending' })))
  const invited = guest({ isRehearsalDinnerInvited: true })
  assert.ok(matchesFilters(invited, filters({ rehearsal: 'pending' })))
})

test('yes to any event and no response', () => {
  assert.ok(matchesFilters(guest({ isAttendingWelcome: true }), filters({ anyEventYes: true })))
  assert.ok(!matchesFilters(guest(), filters({ anyEventYes: true })))
  // Uninvited rehearsal answer doesn't count toward "any event"
  assert.ok(!matchesFilters(guest({ isAttendingRehearsalDinner: true }), filters({ anyEventYes: true })))

  assert.ok(matchesFilters(guest(), filters({ noResponse: true })))
  assert.ok(!matchesFilters(guest({ isAttendingWelcome: false }), filters({ noResponse: true })))
})

test('hotel filters distinguish The Cape, elsewhere, and not given', () => {
  const cape = guest({ hotelName: 'The Cape' })
  const other = guest({ hotelName: 'Grand Velas' })
  const unknown = guest({ hotelName: null })
  assert.deepEqual(
    [cape, other, unknown].map((g) => matchesFilters(g, filters({ hotel: 'cape' }))),
    [true, false, false]
  )
  assert.deepEqual(
    [cape, other, unknown].map((g) => matchesFilters(g, filters({ hotel: 'notCape' }))),
    [false, true, false]
  )
  assert.deepEqual(
    [cape, other, unknown].map((g) => matchesFilters(g, filters({ hotel: 'unknown' }))),
    [false, false, true]
  )
})

test('login filter', () => {
  assert.ok(matchesFilters(guest(), filters({ login: 'never' })))
  assert.ok(!matchesFilters(guest({ hasLoggedIn: true }), filters({ login: 'never' })))
})

test('groupRecipients dedupes shared phones and separates missing phones', () => {
  const ana = guest({ id: 'a', name: 'Ana Lopez', phoneNumber: '+1 555 123 4567' })
  const ben = guest({ id: 'b', name: 'Ben Lopez', phoneNumber: '(555) 123-4567' })
  const cleo = guest({ id: 'c', name: 'Cleo', phoneNumber: null })
  const { recipients, withoutPhone } = groupRecipients([ana, ben, cleo])
  assert.equal(recipients.length, 1)
  assert.deepEqual(recipients[0].guests.map((g) => g.id), ['a', 'b'])
  assert.deepEqual(withoutPhone.map((g) => g.id), ['c'])
})

test('renderTemplate fills placeholders', () => {
  const ana = guest({ name: 'Ana Lopez' })
  const ben = guest({ name: 'Ben Lopez' })
  assert.equal(
    renderTemplate('Hi {firstName}! Code for {familyName}: {code}', [ana, ben]),
    'Hi Ana & Ben! Code for The Lopez Family: sunset'
  )
  assert.equal(renderTemplate('Plain text', [ana]), 'Plain text')
})

test('findUnknownPlaceholders flags typos', () => {
  assert.deepEqual(findUnknownPlaceholders('Hi {firstName} {frstName} {code} {frstName}'), ['{frstName}'])
  assert.deepEqual(findUnknownPlaceholders('No placeholders'), [])
})

test('describeFilters', () => {
  assert.equal(describeFilters(DEFAULT_FILTERS), 'Everyone')
  assert.equal(describeFilters(filters({ anyEventYes: true, hotel: 'cape' })), 'Yes to any event · At The Cape')
  assert.equal(describeFilters(filters({ includeDeclined: true })), 'Everyone · including declined')
})
