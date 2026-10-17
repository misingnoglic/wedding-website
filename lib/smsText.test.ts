import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateSmsCost, formatUsd, findUnicodeChars, firstName, fullName, getSegmentInfo, joinNames, toGsmText } from './smsText'

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

test('findUnicodeChars lists each offending character once', () => {
  assert.deepEqual(findUnicodeChars('We can’t wait, don’t forget 🌴'), ['’', '🌴'])
  assert.deepEqual(findUnicodeChars('Plain text, {firstName}! €5'), [])
})

test('toGsmText swaps punctuation, strips accents, and drops emoji', () => {
  assert.equal(toGsmText('RSVP’d — “soon”…'), 'RSVP\'d - "soon"...')
  assert.equal(toGsmText('See you in Cabo 🌴\n\nTalk soon'), 'See you in Cabo\n\nTalk soon')
  assert.equal(toGsmText('Hi 👋🏽 María, José & Zoë'), 'Hi Maria, José & Zoe')
  assert.equal(toGsmText('Family 👨‍👩‍👧 trip'), 'Family trip')
  assert.equal(getSegmentInfo(toGsmText('Cheers 🥂 we can’t wait')).isUnicode, false)
})

test('estimateSmsCost', () => {
  assert.equal(estimateSmsCost(0), '$0.00')
  assert.equal(estimateSmsCost(960), '$12.29')
  assert.equal(formatUsd(18.6394), '$18.64')
})

test('firstName', () => {
  assert.equal(firstName('Ana Maria Lopez'), 'Ana')
  assert.equal(firstName('  Ben  '), 'Ben')
  assert.equal(firstName('Mary Clare Caggiano'), 'Mary Clare')
  assert.equal(firstName('  Mary  Clare Caggiano '), 'Mary Clare')
  assert.equal(firstName('Mary Clare Smith'), 'Mary')
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
