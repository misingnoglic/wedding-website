import { NextRequest, NextResponse, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { formatPhoneNumber, getPhoneKey } from '@/lib/phone'
import { sendAdminPushNotification } from '@/lib/push'
import { findMatchingGuestForPhone, isValidTwilioSignature } from '@/lib/sms'

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
    const data = {
      fromPhone: fromPhone || 'Unknown',
      toPhone,
      body: body || '(empty message)',
      phoneKey: getPhoneKey(fromPhone || 'Unknown'),
      direction: 'inbound',
      guestId,
      familyId,
      rawPayload: JSON.stringify(rawPayload),
    }
    if (messageSid) {
      await db.smsMessage.upsert({
        where: { messageSid },
        create: { ...data, messageSid },
        update: data,
      })
    } else {
      await db.smsMessage.create({ data })
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

    after(() =>
      sendAdminPushNotification(
        `Text from ${matchedGuest ? matchedGuest.name : formattedSender}`,
        body || '(empty message)',
        '/admin'
      )
    )

    revalidatePath('/admin')

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
