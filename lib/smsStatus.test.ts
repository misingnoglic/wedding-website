import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeSmsError, isFailedStatus, shouldUpdateStatus } from './smsStatus'

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

test('isFailedStatus', () => {
  assert.ok(isFailedStatus('failed'))
  assert.ok(isFailedStatus('undelivered'))
  assert.ok(!isFailedStatus('delivered'))
  assert.ok(!isFailedStatus(null))
})

test('describeSmsError', () => {
  assert.equal(describeSmsError(21610), 'Guest opted out (replied STOP)')
  assert.equal(describeSmsError(99999), 'Not delivered (error 99999)')
  assert.equal(describeSmsError(null), 'Not delivered')
})
