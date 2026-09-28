'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { getBroadcastMessages, getBroadcasts, retryBroadcastFailures, sendBroadcastBatch } from '@/lib/broadcasts'
import { dismissThread, getInboxThreads, getThreadMessages, markThreadRead } from '@/lib/inbox'
import { formatPhoneNumber, getPhoneKey } from '@/lib/phone'
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

/**
 * Links an unrecognized number to a guest: sets their phone number and re-links past messages.
 */
export async function assignPhoneToGuestAction(phone: string, guestId: string) {
  const admin = await getAuthenticatedAdmin()
  const guest = await db.guest.findUnique({ where: { id: guestId }, include: { family: true } })
  if (!guest) return { success: false as const, error: 'Guest not found.' }

  const formatted = formatPhoneNumber(phone) || phone
  const phoneKey = getPhoneKey(phone)
  await db.$transaction([
    db.guest.update({ where: { id: guestId }, data: { phoneNumber: formatted } }),
    db.smsMessage.updateMany({ where: { phoneKey }, data: { guestId, familyId: guest.familyId } }),
  ])

  await logAuditEvent({
    familyId: guest.familyId,
    actorType: 'ADMIN',
    actorName: `${admin.name} (Admin)`,
    eventType: 'GUEST_UPDATED',
    description: `Linked ${formatted} to ${guest.name} (${guest.family.name})${
      guest.phoneNumber ? `, replacing ${guest.phoneNumber}` : ''
    }.`,
  })

  revalidatePath('/admin')
  return { success: true as const }
}

export async function createBroadcastAction(body: string, audience: string, recipientCount: number) {
  const admin = await getAuthenticatedAdmin()
  const broadcast = await db.smsBroadcast.create({
    data: { body, audience, recipientCount, sentByName: admin.name },
  })
  await logAuditEvent({
    actorType: 'ADMIN',
    actorName: `${admin.name} (Admin)`,
    eventType: 'SMS_SENT',
    description: `Started a text to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'} (${audience}): "${body.slice(0, 100)}${body.length > 100 ? '...' : ''}"`,
    details: { broadcastId: broadcast.id, audience, recipientCount, body },
  })
  return broadcast.id
}

export async function sendBroadcastBatchAction(broadcastId: string, recipientGuestIds: string[][]) {
  const admin = await getAuthenticatedAdmin()
  return sendBroadcastBatch(broadcastId, recipientGuestIds, admin.name)
}

export async function retryBroadcastFailuresAction(broadcastId: string) {
  const admin = await getAuthenticatedAdmin()
  return retryBroadcastFailures(broadcastId, admin.name)
}

export async function getBroadcastsAction() {
  await getAuthenticatedAdmin()
  return getBroadcasts()
}

export async function getBroadcastMessagesAction(broadcastId: string) {
  await getAuthenticatedAdmin()
  return getBroadcastMessages(broadcastId)
}
