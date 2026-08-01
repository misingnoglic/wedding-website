'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export async function recordFamilyVisit() {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return { logged: false, reason: 'unauthenticated' }
  }

  try {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, isAdmin: true },
    })

    if (!family) {
      return { logged: false, reason: 'family_not_found' }
    }

    // Only log visits if not already logged in the last 24 hours in the database as an extra safeguard
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentVisit = await db.auditEvent.findFirst({
      where: {
        familyId: family.id,
        eventType: 'WEBSITE_VISIT',
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    })

    if (recentVisit) {
      return { logged: false, reason: 'already_recorded_within_24h' }
    }

    await logAuditEvent({
      familyId: family.id,
      actorType: family.isAdmin ? 'ADMIN' : 'GUEST',
      actorName: family.name,
      eventType: 'WEBSITE_VISIT',
      description: `${family.name} visited the website.`,
    })

    return { logged: true, familyId: family.id }
  } catch (error) {
    console.error('Visit logging error:', error)
    return { logged: false, error: 'failed' }
  }
}
