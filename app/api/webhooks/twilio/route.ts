import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { findMatchingGuestForPhone, formatPhoneNumber } from '@/lib/phone'

export const dynamic = 'force-dynamic'

/**
 * GET /api/webhooks/twilio
 * Diagnostic status check for Twilio webhook configuration.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Twilio SMS Webhook',
    endpoint: '/api/webhooks/twilio',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Validates the X-Twilio-Signature header: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function isValidTwilioSignature(request: NextRequest, params: URLSearchParams): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = request.headers.get('x-twilio-signature')
  if (!authToken || !signature) return false

  // Twilio signs the public URL it was configured with, so rebuild it from the forwarded headers
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  const publicUrl = `${proto}://${host}${url.pathname}${url.search}`

  const payload = [...params.keys()]
    .sort()
    .reduce((acc, key) => acc + key + params.get(key), publicUrl)
  const expected = createHmac('sha1', authToken).update(payload, 'utf8').digest('base64')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * POST /api/webhooks/twilio
 * Twilio incoming SMS webhook endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const text = await request.text().catch(() => '')
    const params = new URLSearchParams(text)

    if (!isValidTwilioSignature(request, params)) {
      console.warn('Rejected Twilio webhook with missing or invalid signature')
      return new Response('Forbidden', { status: 403 })
    }

    const rawPayload: Record<string, unknown> = Object.fromEntries(params.entries())
    const fromPhone = (params.get('From') || '').trim()
    const toPhone = (params.get('To') || '').trim() || null
    const body = (params.get('Body') || '').trim()
    const messageSid = (params.get('MessageSid') || params.get('SmsSid') || '').trim() || null

    if (!fromPhone && !body) {
      console.warn('Twilio webhook received with no sender or body')
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      })
    }

    // Best-effort connection to a registered guest / family
    const matchedGuest = await findMatchingGuestForPhone(fromPhone)
    const guestId = matchedGuest?.id || null
    const familyId = matchedGuest?.familyId || null

    // Persist SMS message row (idempotent upsert if messageSid exists)
    if (messageSid) {
      await db.smsMessage.upsert({
        where: { messageSid },
        create: {
          fromPhone: fromPhone || 'Unknown',
          toPhone,
          body: body || '(empty message)',
          messageSid,
          guestId,
          familyId,
          rawPayload: JSON.stringify(rawPayload),
        },
        update: {
          fromPhone: fromPhone || 'Unknown',
          toPhone,
          body: body || '(empty message)',
          guestId,
          familyId,
          rawPayload: JSON.stringify(rawPayload),
        },
      })
    } else {
      await db.smsMessage.create({
        data: {
          fromPhone: fromPhone || 'Unknown',
          toPhone,
          body: body || '(empty message)',
          guestId,
          familyId,
          rawPayload: JSON.stringify(rawPayload),
        },
      })
    }

    // Log audit event for tracking in live activity log
    const formattedSender = formatPhoneNumber(fromPhone) || fromPhone || 'Unknown'
    const actorDisplayName = matchedGuest
      ? `${matchedGuest.name} (${formattedSender})`
      : `SMS (${formattedSender})`

    await logAuditEvent({
      familyId,
      actorType: matchedGuest ? 'GUEST' : 'SYSTEM',
      actorName: actorDisplayName,
      eventType: 'SMS_RECEIVED',
      description: `SMS received from ${matchedGuest ? matchedGuest.name : formattedSender}: "${body.slice(0, 100)}${body.length > 100 ? '...' : ''}"`,
      details: {
        from: fromPhone,
        to: toPhone,
        body,
        messageSid,
        matchedGuest: matchedGuest
          ? { id: matchedGuest.id, name: matchedGuest.name, familyName: matchedGuest.family?.name }
          : null,
      },
    })

    // Revalidate admin page to show new message immediately
    try {
      revalidatePath('/admin')
    } catch {
      // Ignored in non-page context
    }

    // Respond with standard empty TwiML XML (no automated reply)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error handling Twilio webhook:', error)
    // Always return 200 OK TwiML to Twilio to prevent infinite webhook retries
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  }
}
