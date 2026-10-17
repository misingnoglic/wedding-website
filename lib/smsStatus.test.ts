import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeSmsError, isFailedStatus, isPendingStatus, isRetryableError, shouldUpdateStatus } from './smsStatus'

test('shouldUpdateStatus only moves forward', () => {
  assert.ok(shouldUpdateStatus(null, 'queued'))
  assert.ok(shouldUpdateStatus('queued', 'sent'))
  assert.ok(shouldUpdateStatus('sent', 'delivered'))
  assert.ok(!shouldUpdateStatus('delivered', 'sent'))
  assert.ok(!shouldUpdateStatus('failed', 'delivered'))
  assert.ok(!shouldUpdateStatus('sent', 'sent'))
})

test('shouldUpdateStatus ignores unknown statuses', () => {
  assert.ok(!shouldUpdateStatus('sent', 'bogus'))
  assert.ok(shouldUpdateStatus('bogus', 'sent'))
})

test('isPendingStatus', () => {
  assert.ok(isPendingStatus('queued'))
  assert.ok(isPendingStatus('accepted'))
  assert.ok(isPendingStatus('sent'))
  assert.ok(!isPendingStatus('delivered'))
  assert.ok(!isPendingStatus('undelivered'))
  assert.ok(!isPendingStatus('failed'))
  assert.ok(!isPendingStatus(null))
})

test('isFailedStatus', () => {
  assert.ok(isFailedStatus('failed'))
  assert.ok(isFailedStatus('undelivered'))
  assert.ok(!isFailedStatus('delivered'))
  assert.ok(!isFailedStatus(null))
})

test('isRetryableError', () => {
  assert.ok(isRetryableError(null))
  assert.ok(isRetryableError(30002)) // Account suspended: fine once it's topped up
  assert.ok(isRetryableError(30003))
  assert.ok(!isRetryableError(21610))
  assert.ok(!isRetryableError(30006))
  assert.ok(!isRetryableError(30019))
})

test('describeSmsError', () => {
  assert.equal(describeSmsError(21610), 'Guest opted out (replied STOP)')
  assert.equal(describeSmsError(99999), 'Not delivered (error 99999)')
  assert.equal(describeSmsError(null), 'Not delivered')
  assert.equal(describeSmsError(30019), 'Message too long for their carrier')
})

test('describeSmsError prefers the known description over the fallback', () => {
  assert.equal(describeSmsError(30002, 'Account suspended'), 'Twilio account suspended (check the balance)')
  assert.equal(describeSmsError(99999, 'Something odd'), 'Something odd')
  assert.equal(describeSmsError(null, 'Network error'), 'Network error')
})
