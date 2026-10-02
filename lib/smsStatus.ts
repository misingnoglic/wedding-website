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

const ERROR_DESCRIPTIONS: Record<number, string> = {
  21211: 'Invalid phone number',
  21408: 'Country not enabled for texting',
  21610: 'Guest opted out (replied STOP)',
  21614: 'Not a mobile number',
  30003: 'Phone unreachable or off',
  30004: 'Blocked by the recipient',
  30005: 'Unknown or inactive number',
  30006: 'Landline or unreachable carrier',
  30007: 'Filtered by the carrier',
  30008: 'Unknown delivery error',
}

export function describeSmsError(code: number | null | undefined): string {
  if (!code) return 'Not delivered'
  return ERROR_DESCRIPTIONS[code] || `Not delivered (error ${code})`
}
