import { db } from '@/lib/db'

export type AuditActorType = 'ADMIN' | 'GUEST' | 'SYSTEM'
export type AuditEventType =
  | 'WEBSITE_VISIT'
  | 'RSVP_UPDATED'
  | 'FAMILY_CREATED'
  | 'FAMILY_UPDATED'
  | 'FAMILY_DELETED'
  | 'GUEST_ADDED'
  | 'GUEST_UPDATED'
  | 'GUEST_DELETED'
  | 'PASSWORD_RESET'
  | 'ADMIN_IMPERSONATION'
  | 'GUEST_LOGIN'

export interface LogAuditParams {
  familyId?: string | null
  actorType: AuditActorType
  actorName: string
  eventType: AuditEventType
  description: string
  details?: Record<string, unknown> | string | null
}

export async function logAuditEvent({
  familyId,
  actorType,
  actorName,
  eventType,
  description,
  details,
}: LogAuditParams) {
  try {
    const detailsString = details
      ? typeof details === 'string'
        ? details
        : JSON.stringify(details)
      : null

    return await db.auditEvent.create({
      data: {
        familyId: familyId || null,
        actorType,
        actorName,
        eventType,
        description,
        details: detailsString,
      },
    })
  } catch (error) {
    console.error('Failed to write audit event:', error)
    // Non-blocking: audit event write failures should never break primary user operations
    return null
  }
}
