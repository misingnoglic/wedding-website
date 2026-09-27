'use server'

import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function sendSmsAction(toPhone: string, body: string, guestId?: string | null, familyId?: string | null) {
  const admin = await getAuthenticatedAdmin()

  try {
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials are not fully configured in environment variables.')
    }

    const basicAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

    const formData = new URLSearchParams()
    formData.append('To', toPhone)
    formData.append('From', TWILIO_PHONE_NUMBER)
    formData.append('Body', body)

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio Error:', data)
      throw new Error(`Failed to send SMS via Twilio: ${data.message || response.statusText}`)
    }

    // Save outgoing message to DB
    await db.smsMessage.create({
      data: {
        fromPhone: TWILIO_PHONE_NUMBER,
        toPhone: toPhone,
        body: body,
        messageSid: data.sid,
        guestId: guestId || null,
        familyId: familyId || null,
        rawPayload: JSON.stringify(data),
      }
    })

    await logAuditEvent({
      familyId: familyId || null,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'SMS_SENT',
      description: `Sent SMS to ${toPhone}: "${body.slice(0, 100)}${body.length > 100 ? '...' : ''}"`,
      details: {
        to: toPhone,
        body,
        messageSid: data.sid
      }
    })

    revalidatePath('/admin')
    return { success: true, messageSid: data.sid }
  } catch (error: any) {
    console.error('Error in sendSmsAction:', error)
    return { success: false, error: error.message || 'Failed to send SMS' }
  }
}
