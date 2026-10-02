import twilio from 'twilio'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { doPhoneNumbersMatch, getComparablePhone, getPhoneKey } from '@/lib/phone'
import { isPendingStatus, shouldUpdateStatus } from '@/lib/smsStatus'

/**
 * Finds a matching guest in the database by phone number using best-effort digit comparison.
 */
export async function findMatchingGuestForPhone(rawPhone: string) {
  if (!rawPhone || !rawPhone.trim()) return null

  const targetKey = getComparablePhone(rawPhone)
  if (!targetKey) return null

  try {
    const guestsWithPhone = await db.guest.findMany({
      where: {
        phoneNumber: {
          not: null,
        },
      },
      include: {
        family: true,
      },
    })

    const matchedGuest = guestsWithPhone.find((g) => {
      if (!g.phoneNumber) return false
      return doPhoneNumbersMatch(g.phoneNumber, rawPhone)
    })

    return matchedGuest || null
  } catch (error) {
    console.error('Failed to match guest for phone:', error)
    return null
  }
}

/**
 * Public URL Twilio should POST delivery updates to, based on the current request's host.
 * Skipped on localhost since Twilio can't reach it.
 */
async function getStatusCallbackUrl(): Promise<string | undefined> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host')
  if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) return undefined
  const proto = headerList.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}/api/webhooks/twilio/status`
}

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio credentials are not fully configured in environment variables.')
  }
  return twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_ACCOUNT_SID })
}

// Twilio settles delivery well within this; older stragglers aren't worth re-checking
const STATUS_SYNC_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Pulls current delivery status from Twilio for recent outbound texts that are still in flight.
 * Status callbacks normally do this, but they're skipped when sending from localhost.
 */
export async function syncPendingStatuses(): Promise<number> {
  const candidates = await db.smsMessage.findMany({
    where: {
      direction: 'outbound',
      messageSid: { not: null },
      status: { not: null },
      createdAt: { gte: new Date(Date.now() - STATUS_SYNC_WINDOW_MS) },
    },
    select: { id: true, messageSid: true, status: true },
  })
  const pending = candidates.filter((m) => isPendingStatus(m.status))
  if (pending.length === 0) return 0

  const client = getTwilioClient()
  const updated = await Promise.all(
    pending.map(async (m) => {
      try {
        const latest = await client.messages(m.messageSid!).fetch()
        if (!shouldUpdateStatus(m.status, latest.status)) return false
        await db.smsMessage.update({
          where: { id: m.id },
          data: { status: latest.status, ...(latest.errorCode ? { errorCode: latest.errorCode } : {}) },
        })
        return true
      } catch (error) {
        console.error(`Failed to sync status for ${m.messageSid}:`, error)
        return false
      }
    })
  )
  return updated.filter(Boolean).length
}

export interface SendSmsParams {
  to: string
  body: string
  sentByName: string
  broadcastId?: string | null
}

export type SendSmsResult =
  | { success: true; messageId: string }
  | { success: false; messageId: string | null; error: string; errorCode: number | null }

/**
 * Sends one SMS and records it (including failures, so they show up in the thread).
 */
export async function sendSms({ to, body, sentByName, broadcastId }: SendSmsParams): Promise<SendSmsResult> {
  const fromPhone = process.env.TWILIO_PHONE_NUMBER || ''
  const matchedGuest = await findMatchingGuestForPhone(to)
  const base = {
    fromPhone,
    toPhone: to,
    body,
    phoneKey: getPhoneKey(to),
    direction: 'outbound',
    sentByName,
    broadcastId: broadcastId || null,
    guestId: matchedGuest?.id || null,
    familyId: matchedGuest?.familyId || null,
  }

  try {
    const message = await getTwilioClient().messages.create({
      to,
      from: fromPhone,
      body,
      statusCallback: await getStatusCallbackUrl(),
    })
    const row = await db.smsMessage.create({
      data: {
        ...base,
        messageSid: message.sid,
        status: message.status,
        rawPayload: JSON.stringify(message),
      },
    })
    return { success: true, messageId: row.id }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number }
    console.error('Error sending SMS:', error)
    const errorCode = typeof err.code === 'number' ? err.code : null
    const row = await db.smsMessage
      .create({ data: { ...base, status: 'failed', errorCode } })
      .catch(() => null)
    return {
      success: false,
      messageId: row?.id || null,
      error: err.message || 'Failed to send SMS',
      errorCode,
    }
  }
}

// Twilio signs webhooks with the account's primary Auth Token (API key secrets can't be used here)
export function isValidTwilioSignature(request: NextRequest, params: URLSearchParams): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = request.headers.get('x-twilio-signature')
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN is not set; cannot validate Twilio webhook signatures')
    return false
  }
  if (!signature) return false

  // Twilio signs the public URL it was configured with, so rebuild it from the forwarded headers
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  const publicUrl = `${proto}://${host}${url.pathname}${url.search}`

  return twilio.validateRequest(authToken, signature, publicUrl, Object.fromEntries(params))
}
