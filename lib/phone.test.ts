import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doPhoneNumbersMatch, getComparablePhone } from './phone'

test('getComparablePhone normalizes US numbers to 10 digits', () => {
  assert.equal(getComparablePhone('+1 (555) 123-4567'), '5551234567')
  assert.equal(getComparablePhone('555.123.4567'), '5551234567')
  assert.equal(getComparablePhone('15551234567'), '5551234567')
})

test('getComparablePhone handles empty input', () => {
  assert.equal(getComparablePhone(null), '')
  assert.equal(getComparablePhone(''), '')
})

test('doPhoneNumbersMatch compares across formats', () => {
  assert.ok(doPhoneNumbersMatch('+15551234567', '(555) 123-4567'))
  assert.ok(!doPhoneNumbersMatch('+15551234567', '(555) 123-4568'))
  assert.ok(!doPhoneNumbersMatch(null, '5551234567'))
})
