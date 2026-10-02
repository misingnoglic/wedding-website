import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstName, fullName, getSegmentInfo, joinNames } from './smsText'

test('plain text fits 160 characters in one segment', () => {
  assert.deepEqual(getSegmentInfo('a'.repeat(160)), { length: 160, segments: 1, isUnicode: false })
  assert.deepEqual(getSegmentInfo('a'.repeat(161)), { length: 161, segments: 2, isUnicode: false })
})

test('extended GSM characters count double', () => {
  assert.equal(getSegmentInfo('€').length, 2)
})

test('emoji and curly quotes switch to unicode segments', () => {
  const emoji = getSegmentInfo('See you in Cabo 🥂')
  assert.ok(emoji.isUnicode)
  assert.equal(emoji.segments, 1)
  assert.ok(getSegmentInfo('We can’t wait').isUnicode)
  assert.equal(getSegmentInfo('’' + 'a'.repeat(70)).segments, 2)
})

test('empty text', () => {
  assert.deepEqual(getSegmentInfo(''), { length: 0, segments: 1, isUnicode: false })
})

test('firstName', () => {
  assert.equal(firstName('Ana Maria Lopez'), 'Ana')
  assert.equal(firstName('  Ben  '), 'Ben')
})

test('fullName', () => {
  assert.equal(fullName('Ana Lopez', 'Dr'), 'Dr. Ana Lopez')
  assert.equal(fullName('Ana Lopez', 'Mrs.'), 'Mrs. Ana Lopez')
  assert.equal(fullName('Cleo Lopez', 'Miss'), 'Miss Cleo Lopez')
  assert.equal(fullName(' Ben Lopez ', null), 'Ben Lopez')
  assert.equal(fullName('Ben Lopez', 'None'), 'Ben Lopez')
})

test('joinNames', () => {
  assert.equal(joinNames([]), '')
  assert.equal(joinNames(['Ana']), 'Ana')
  assert.equal(joinNames(['Ana', 'Ben']), 'Ana & Ben')
  assert.equal(joinNames(['Ana', 'Ben', 'Cleo']), 'Ana, Ben & Cleo')
})
