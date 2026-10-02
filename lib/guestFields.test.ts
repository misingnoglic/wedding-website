import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatTitle,
  joinDietary,
  normalizeDietaryRestrictions,
  normalizeEmail,
  normalizeFlightDate,
  normalizeFlightNumber,
  normalizeHotelName,
  normalizeSongRequests,
  normalizeTitle,
  parseRsvpAnswer,
  splitDietary,
} from './guestFields'

test('parseRsvpAnswer', () => {
  assert.equal(parseRsvpAnswer('true'), true)
  assert.equal(parseRsvpAnswer('false'), false)
  assert.equal(parseRsvpAnswer(''), null)
  assert.equal(parseRsvpAnswer(null), null)
})

test('normalizeTitle and formatTitle', () => {
  assert.equal(normalizeTitle(' Dr '), 'Dr')
  assert.equal(normalizeTitle('None'), null)
  assert.equal(normalizeTitle(''), null)
  assert.equal(formatTitle('Dr'), 'Dr.')
  assert.equal(formatTitle('Mrs.'), 'Mrs.')
  assert.equal(formatTitle('Miss'), 'Miss')
  assert.equal(formatTitle('None'), '')
  assert.equal(formatTitle(null), '')
})

test('normalizeEmail', () => {
  assert.equal(normalizeEmail('  Ana@Example.COM '), 'ana@example.com')
  assert.equal(normalizeEmail('  '), null)
})

test('normalizeFlightNumber', () => {
  assert.equal(normalizeFlightNumber('aa1234'), 'AA 1234')
  assert.equal(normalizeFlightNumber('American Airlines #1234'), 'AA 1234')
  assert.equal(normalizeFlightNumber('flight b6 939'), 'B6 939')
  assert.equal(normalizeFlightNumber('jetblue 939'), 'B6 939')
  assert.equal(normalizeFlightNumber('1234'), '1234')
  assert.equal(normalizeFlightNumber('ask your  sister'), 'ASK YOUR SISTER')
  assert.equal(normalizeFlightNumber(' '), null)
})

test('normalizeFlightDate keeps dates only with a flight', () => {
  assert.equal(normalizeFlightDate('2026-12-10', 'AA 1234'), '2026-12-10')
  assert.equal(normalizeFlightDate('2026-12-10', null), null)
})

test('normalizeHotelName', () => {
  assert.equal(normalizeHotelName('the cape, a thompson hotel'), 'The Cape')
  assert.equal(normalizeHotelName('sun rock'), 'Sunrock Hotel')
  assert.equal(normalizeHotelName('VRBO'), 'Airbnb / Villa')
  assert.equal(normalizeHotelName('My aunt’s house'), 'My aunt’s house')
  assert.equal(normalizeHotelName(''), null)
})

test('normalizeDietaryRestrictions maps onto the RSVP options', () => {
  assert.equal(normalizeDietaryRestrictions('Gluten Free'), 'Gluten Free (Celiac)')
  assert.equal(normalizeDietaryRestrictions('gf'), 'Gluten Free (Celiac)')
  assert.equal(normalizeDietaryRestrictions('Gluten Free (Celiac)'), 'Gluten Free (Celiac)')
  assert.equal(normalizeDietaryRestrictions('kosher'), 'Kosher (Certified)')
  assert.equal(normalizeDietaryRestrictions('Kids Meal'), 'Kids')
  assert.equal(normalizeDietaryRestrictions('n/a'), null)
  assert.equal(normalizeDietaryRestrictions('Vegetarian, Nut Allergy'), 'Vegetarian, Nut Allergy')
})

test('splitDietary and joinDietary round-trip', () => {
  assert.deepEqual(splitDietary(null), { type: 'None', text: '' })
  assert.deepEqual(splitDietary('Gluten Free'), { type: 'Gluten Free (Celiac)', text: '' })
  assert.deepEqual(splitDietary('Shellfish allergy'), { type: 'Other', text: 'Shellfish allergy' })
  assert.equal(joinDietary('None', ''), '')
  assert.equal(joinDietary('Vegan', ''), 'Vegan')
  assert.equal(joinDietary('Other', 'Shellfish allergy'), 'Shellfish allergy')
})

test('normalizeSongRequests strips wrapping quotes', () => {
  assert.equal(normalizeSongRequests('"September"'), 'September')
  assert.equal(normalizeSongRequests('  '), null)
})
