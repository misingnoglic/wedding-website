'use server'

import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import twilio from 'twilio'

export async function sendSmsAction(toPhone: string, body: string, guestId?: string | null, familyId?: string | null) {
  const admin = await getAuthenticatedAdmin()

  try {
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials are not fully configured in environment variables.')
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    const data = await client.messages.create({
      to: toPhone,
      from: TWILIO_PHONE_NUMBER,
      body,
    })

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
