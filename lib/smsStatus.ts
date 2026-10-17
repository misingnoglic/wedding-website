// Twilio outbound message lifecycle, lowest to highest. Terminal states share the top rank.
const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  scheduled: 0,
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  undelivered: 4,
  failed: 4,
}

/**
 * Status callbacks can arrive out of order (e.g. "sent" after "delivered"); only move forward.
 */
export function shouldUpdateStatus(current: string | null, next: string): boolean {
  if (!(next in STATUS_RANK)) return false
  if (!current || !(current in STATUS_RANK)) return true
  return STATUS_RANK[next] > STATUS_RANK[current]
}

/**
 * Outbound statuses that are still in flight (null means it predates status tracking, so ignore it).
 */
export function isPendingStatus(status: string | null | undefined): boolean {
  return !!status && status in STATUS_RANK && STATUS_RANK[status] < 4
}

export function isFailedStatus(status: string | null | undefined): boolean {
  return status === 'failed' || status === 'undelivered'
}

// Twilio error codes: https://www.twilio.com/docs/api/errors
const ERROR_DESCRIPTIONS: Record<number, string> = {
  20003: 'Twilio rejected our credentials (check the account)',
  21211: 'Invalid phone number',
  21408: 'Country not enabled for texting',
  21610: 'Guest opted out (replied STOP)',
  21612: 'Number can’t receive texts from us',
  21614: 'Not a mobile number',
  30001: 'Twilio was too busy (sending too fast)',
  30002: 'Twilio account suspended (check the balance)',
  30003: 'Phone unreachable or off',
  30004: 'Blocked by the recipient',
  30005: 'Unknown or inactive number',
  30006: 'Landline or unreachable carrier',
  30007: 'Filtered by the carrier as spam',
  30008: 'Unknown delivery error',
  30019: 'Message too long for their carrier',
  30034: 'Our number isn’t registered for texting',
  70051: 'Twilio rejected our credentials (check the account)',
}

// Problems with our Twilio account (out of funds, bad credentials) rather than with the recipient
const ACCOUNT_ERRORS = new Set([20003, 30002, 70051])

/**
 * Every remaining text will fail the same way until the account is fixed, so stop sending.
 */
export function isAccountError(code: number | null | undefined): boolean {
  return !!code && ACCOUNT_ERRORS.has(code)
}

// Retries resend the same text to the same number, so these would just fail again
const NO_RETRY_ERRORS = new Set([21211, 21408, 21610, 21612, 21614, 30004, 30005, 30006, 30007, 30019])

/**
 * Whether resending could help. Account problems (e.g. 30002) and flaky phones are worth retrying;
 * bad numbers, opt-outs, and content the carrier rejected are not.
 */
export function isRetryableError(code: number | null | undefined): boolean {
  return !code || !NO_RETRY_ERRORS.has(code)
}

/**
 * Plain-English reason a text failed. Unrecognized codes use the fallback, or show the code to look up.
 */
export function describeSmsError(code: number | null | undefined, fallback?: string): string {
  if (code && ERROR_DESCRIPTIONS[code]) return ERROR_DESCRIPTIONS[code]
  if (fallback) return fallback
  return code ? `Not delivered (error ${code})` : 'Not delivered'
}
