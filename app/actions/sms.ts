'use server'

import { logAuditEvent } from '@/lib/audit'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { sendSms } from '@/lib/sms'

export async function sendSmsAction(toPhone: string, body: string) {
  const admin = await getAuthenticatedAdmin()
  const result = await sendSms({ to: toPhone, body, sentByName: admin.name })

  if (result.success) {
    await logAuditEvent({
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'SMS_SENT',
      description: `Sent SMS to ${toPhone}: "${body.slice(0, 100)}${body.length > 100 ? '...' : ''}"`,
      details: { to: toPhone, body },
    })
  }

  return result
}
