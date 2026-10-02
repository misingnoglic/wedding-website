import { db } from '@/lib/db'
import { getPhoneKey } from '@/lib/phone'
import { sendSms } from '@/lib/sms'
import { renderTemplate } from '@/lib/smsAudience'
import { isFailedStatus } from '@/lib/smsStatus'

export interface BroadcastSummary {
  id: string
  body: string
  audience: string
  recipientCount: number
  sentByName: string
  createdAt: Date
  counts: { sent: number; delivered: number; failed: number }
}

export interface BroadcastRecipientResult {
  phoneKey: string
  success: boolean
  error?: string
}

// Opted-out numbers will fail again, so retries skip them
const OPTED_OUT_ERROR = 21610

/**
 * Sends a broadcast to one batch of recipients. Each recipient is a set of guests sharing a phone;
 * the message is rendered from the stored template using current guest data.
 */
export async function sendBroadcastBatch(
  broadcastId: string,
  recipientGuestIds: string[][],
  sentByName: string
): Promise<BroadcastRecipientResult[]> {
  const broadcast = await db.smsBroadcast.findUniqueOrThrow({ where: { id: broadcastId } })
  const guests = await db.guest.findMany({
    where: { id: { in: recipientGuestIds.flat() } },
    include: { family: true },
  })
  const guestsById = new Map(guests.map((g) => [g.id, g]))

  return Promise.all(
    recipientGuestIds.map(async (ids): Promise<BroadcastRecipientResult> => {
      const group = ids.map((id) => guestsById.get(id)).filter((g) => g !== undefined)
      const phone = group[0]?.phoneNumber
      if (!phone) return { phoneKey: '', success: false, error: 'Guest no longer has a phone number' }

      const phoneKey = getPhoneKey(phone)
      const sameNumber = group.filter((g) => g.phoneNumber && getPhoneKey(g.phoneNumber) === phoneKey)
      const body = renderTemplate(
        broadcast.body,
        sameNumber.map((g) => ({
          ...g,
          familyName: g.family.name,
          familyPassword: g.family.password,
          isRehearsalDinnerInvited: g.family.isRehearsalDinnerInvited,
          hasLoggedIn: g.family.hasLoggedIn,
        }))
      )
      const result = await sendSms({ to: phone, body, sentByName, broadcastId })
      return result.success ? { phoneKey, success: true } : { phoneKey, success: false, error: result.error }
    })
  )
}

/**
 * Resends the exact text to recipients whose latest attempt in this broadcast failed.
 */
export async function retryBroadcastFailures(broadcastId: string, sentByName: string) {
  const messages = await db.smsMessage.findMany({
    where: { broadcastId },
    orderBy: { createdAt: 'asc' },
  })
  const latestByPhone = new Map(messages.map((m) => [m.phoneKey, m]))
  const toRetry = [...latestByPhone.values()].filter(
    (m) => isFailedStatus(m.status) && m.errorCode !== OPTED_OUT_ERROR && m.toPhone
  )

  const results = await Promise.all(
    toRetry.map((m) => sendSms({ to: m.toPhone!, body: m.body, sentByName, broadcastId }))
  )
  return { retried: results.length, failed: results.filter((r) => !r.success).length }
}

export async function getBroadcasts(): Promise<BroadcastSummary[]> {
  const [broadcasts, messages] = await Promise.all([
    db.smsBroadcast.findMany({ orderBy: { createdAt: 'desc' } }),
    db.smsMessage.findMany({
      where: { broadcastId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { broadcastId: true, phoneKey: true, status: true },
    }),
  ])

  // Count each recipient once, by their latest attempt (retries add rows)
  const latest = new Map<string, { broadcastId: string; status: string | null }>()
  for (const m of messages) latest.set(`${m.broadcastId}:${m.phoneKey}`, { broadcastId: m.broadcastId!, status: m.status })

  return broadcasts.map((b) => {
    const counts = { sent: 0, delivered: 0, failed: 0 }
    for (const m of latest.values()) {
      if (m.broadcastId !== b.id) continue
      if (m.status === 'delivered') counts.delivered++
      else if (isFailedStatus(m.status)) counts.failed++
      else counts.sent++
    }
    return { ...b, counts }
  })
}

export interface BroadcastReach {
  id: string
  body: string
  createdAt: Date
  reachedPhoneKeys: string[]
}

/**
 * Phones each broadcast reached, judged by their latest attempt. Failed sends don't count, so those
 * guests can be texted again, except opted-out numbers, which would just fail again.
 */
export async function getBroadcastReach(): Promise<BroadcastReach[]> {
  const [broadcasts, messages] = await Promise.all([
    db.smsBroadcast.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, body: true, createdAt: true } }),
    db.smsMessage.findMany({
      where: { broadcastId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { broadcastId: true, phoneKey: true, status: true, errorCode: true },
    }),
  ])

  const latest = new Map<string, (typeof messages)[number]>()
  for (const m of messages) latest.set(`${m.broadcastId}:${m.phoneKey}`, m)

  const reached = new Map<string, string[]>()
  for (const m of latest.values()) {
    if (isFailedStatus(m.status) && m.errorCode !== OPTED_OUT_ERROR) continue
    reached.set(m.broadcastId!, [...(reached.get(m.broadcastId!) ?? []), m.phoneKey])
  }

  return broadcasts.map((b) => ({ ...b, reachedPhoneKeys: reached.get(b.id) ?? [] }))
}

export async function getBroadcastMessages(broadcastId: string) {
  return db.smsMessage.findMany({
    where: { broadcastId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      phoneKey: true,
      toPhone: true,
      body: true,
      status: true,
      errorCode: true,
      createdAt: true,
    },
  })
}
