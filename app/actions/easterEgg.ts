'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export async function recordProposalEasterEgg(targetName?: string) {
  try {
    const cookieStore = await cookies()
    const familyId = cookieStore.get('rsvp_family_id')?.value

    let family = null
    if (familyId) {
      family = await db.family.findUnique({
        where: { id: familyId },
        select: { id: true, name: true, isAdmin: true },
      })
    }

    const actorName = family ? family.name : 'Curious Visitor (DevTools)'
    const actorType = family ? (family.isAdmin ? 'ADMIN' : 'GUEST') : 'GUEST'
    const targetDisplay = typeof targetName === 'string' && targetName.trim() ? targetName.trim() : 'none'
    const description = `${actorName} ran arya.propose(${targetDisplay}) in the developer console!`

    await logAuditEvent({
      familyId: family ? family.id : null,
      actorType,
      actorName,
      eventType: 'EASTER_EGG',
      description,
      details: {
        type: 'arya_propose',
        argument: targetDisplay,
        timestamp: new Date().toISOString(),
      },
    })

    return { logged: true }
  } catch (error) {
    console.error('Error logging easter egg audit:', error)
    return { logged: false }
  }
}

export async function recordSqlInjectionEasterEgg(sqlInput: string, fieldName?: string) {
  try {
    const cookieStore = await cookies()
    const familyId = cookieStore.get('rsvp_family_id')?.value

    let family = null
    if (familyId) {
      family = await db.family.findUnique({
        where: { id: familyId },
        select: { id: true, name: true, isAdmin: true },
      })
    }

    const actorName = family ? family.name : 'Curious Visitor (DevTools)'
    const actorType = family ? (family.isAdmin ? 'ADMIN' : 'GUEST') : 'GUEST'
    const cleanInput = sqlInput ? sqlInput.slice(0, 100).trim() : ''
    const fieldInfo = fieldName ? ` in ${fieldName}` : ''
    const description = `${actorName} triggered SQL injection check${fieldInfo}: "${cleanInput}"`

    await logAuditEvent({
      familyId: family ? family.id : null,
      actorType,
      actorName,
      eventType: 'EASTER_EGG',
      description,
      details: {
        type: 'sql_injection_attempt',
        field: fieldName || 'form_field',
        input: cleanInput,
        timestamp: new Date().toISOString(),
      },
    })

    return { logged: true }
  } catch (error) {
    console.error('Error logging SQL injection easter egg audit:', error)
    return { logged: false }
  }
}
