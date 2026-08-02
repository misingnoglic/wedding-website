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
 * POST /api/webhooks/twilio
 * Twilio incoming SMS webhook endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    let fromPhone = ''
    let toPhone: string | null = null
    let body = ''
    let messageSid: string | null = null
    const rawPayload: Record<string, unknown> = {}

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // JSON Payload
      const json = await request.json().catch(() => ({}))
      Object.assign(rawPayload, json)

      fromPhone = (json.From || json.from || json.sender || json.phoneNumber || '').toString().trim()
      toPhone = (json.To || json.to || '').toString().trim() || null
      body = (json.Body || json.body || json.text || json.message || '').toString().trim()
      messageSid = (json.MessageSid || json.SmsSid || json.SmsMessageSid || json.sid || json.id || '').toString().trim() || null
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // URL encoded Payload (standard Twilio format)
      const text = await request.text().catch(() => '')
      const params = new URLSearchParams(text)
      for (const [key, val] of params.entries()) {
        rawPayload[key] = val
      }

      fromPhone = (params.get('From') || params.get('from') || params.get('sender') || '').trim()
      toPhone = (params.get('To') || params.get('to') || '').trim() || null
      body = (params.get('Body') || params.get('body') || '').trim()
      messageSid = (
        params.get('MessageSid') ||
        params.get('SmsSid') ||
        params.get('SmsMessageSid') ||
        params.get('sid') ||
        ''
      ).trim() || null
    } else {
      // Multipart or fallback formData
      try {
        const formData = await request.formData()
        for (const [key, val] of formData.entries()) {
          rawPayload[key] = typeof val === 'string' ? val : val.name
        }

        fromPhone = (formData.get('From') as string || formData.get('from') as string || '').trim()
        toPhone = (formData.get('To') as string || formData.get('to') as string || '').trim() || null
        body = (formData.get('Body') as string || formData.get('body') as string || '').trim()
        messageSid = (
          formData.get('MessageSid') as string ||
          formData.get('SmsSid') as string ||
          formData.get('SmsMessageSid') as string ||
          ''
        ).trim() || null
      } catch {
        const text = await request.text().catch(() => '')
        const params = new URLSearchParams(text)
        for (const [key, val] of params.entries()) {
          rawPayload[key] = val
        }
        fromPhone = (params.get('From') || params.get('from') || '').trim()
        toPhone = (params.get('To') || params.get('to') || '').trim() || null
        body = (params.get('Body') || params.get('body') || '').trim()
        messageSid = (params.get('MessageSid') || params.get('SmsSid') || '').trim() || null
      }
    }

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
