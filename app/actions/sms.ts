'use server'

import { logAuditEvent } from '@/lib/audit'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { dismissThread, getInboxThreads, getThreadMessages, markThreadRead } from '@/lib/inbox'
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

export async function getInboxThreadsAction() {
  await getAuthenticatedAdmin()
  return getInboxThreads()
}

export async function getThreadMessagesAction(phoneKey: string) {
  await getAuthenticatedAdmin()
  return getThreadMessages(phoneKey)
}

export async function markThreadReadAction(phoneKey: string) {
  await getAuthenticatedAdmin()
  await markThreadRead(phoneKey)
}

export async function dismissThreadAction(phoneKey: string) {
  await getAuthenticatedAdmin()
  await dismissThread(phoneKey)
}
