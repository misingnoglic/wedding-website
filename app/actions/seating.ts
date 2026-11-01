'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getAuthenticatedAdmin } from '@/lib/auth'
import {
  isLinkEndpoint,
  isSeatingConstraint,
  isSeatRequirement,
  isValidAffinity,
  LinkEndpoint,
  linkKey,
  linkProblem,
  normalizeLink,
  normalizePair,
} from '@/lib/seating'

// Ratings are private (negative ones especially), so these actions deliberately skip the audit log.

type ActionResult = { success: true } | { error: string }

export async function createSeatingGroup(input: { name: string; affinity: number; color?: string | null }): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  const name = input.name.trim()
  if (!name) return { error: 'Group name is required.' }
  if (!isValidAffinity(input.affinity)) return { error: 'Affinity must be between -3 and +3.' }

  try {
    await db.seatingGroup.create({ data: { name, affinity: input.affinity, color: input.color || null } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Create seating group error:', error)
    return { error: 'Failed to create group.' }
  }
}

export async function updateSeatingGroup(
  groupId: string,
  input: { name?: string; affinity?: number; color?: string | null }
): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  const name = input.name?.trim()
  if (input.name !== undefined && !name) return { error: 'Group name is required.' }
  if (input.affinity !== undefined && !isValidAffinity(input.affinity)) return { error: 'Affinity must be between -3 and +3.' }

  try {
    await db.seatingGroup.update({
      where: { id: groupId },
      data: { name, affinity: input.affinity, color: input.color },
    })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Update seating group error:', error)
    return { error: 'Failed to update group.' }
  }
}

export async function deleteSeatingGroup(groupId: string): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  try {
    await db.seatingGroup.delete({ where: { id: groupId } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Delete seating group error:', error)
    return { error: 'Failed to delete group.' }
  }
}

export async function setSeatingGroupMembership(groupId: string, guestIds: string[], isMember: boolean): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  if (guestIds.length === 0) return { success: true }

  try {
    if (isMember) {
      await db.seatingGroupMember.createMany({
        data: guestIds.map((guestId) => ({ groupId, guestId })),
        skipDuplicates: true,
      })
    } else {
      await db.seatingGroupMember.deleteMany({ where: { groupId, guestId: { in: guestIds } } })
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Set seating group membership error:', error)
    return { error: 'Failed to update group members.' }
  }
}

const sideColumns = (e: LinkEndpoint) => ({
  groupId: e.type === 'group' ? e.id : null,
  familyId: e.type === 'family' ? e.id : null,
  guestId: e.type === 'guest' ? e.id : null,
})

/**
 * Sets the baseline between two sides (each a group, party, or guest); null removes the link.
 */
export async function setSeatingLink(a: LinkEndpoint, b: LinkEndpoint, affinity: number | null): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  if (!isLinkEndpoint(a) || !isLinkEndpoint(b)) return { error: 'Unknown link side.' }
  const problem = linkProblem(a, b)
  if (problem) return { error: problem }
  if (affinity !== null && !isValidAffinity(affinity)) return { error: 'Affinity must be between -3 and +3.' }

  const key = linkKey(a, b)
  try {
    if (affinity === null) {
      await db.seatingLink.deleteMany({ where: { key } })
    } else {
      const [x, y] = normalizeLink(a, b)
      const sideA = sideColumns(x)
      const sideB = sideColumns(y)
      await db.seatingLink.upsert({
        where: { key },
        create: {
          key,
          affinity,
          aGroupId: sideA.groupId,
          aFamilyId: sideA.familyId,
          aGuestId: sideA.guestId,
          bGroupId: sideB.groupId,
          bFamilyId: sideB.familyId,
          bGuestId: sideB.guestId,
        },
        update: { affinity },
      })
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Set seating link error:', error)
    return { error: 'Failed to update link.' }
  }
}

/**
 * Upserts the pair's rating. Fields left undefined keep their current value; null clears them.
 * A row with nothing left in it is deleted so the pair falls back to its baseline.
 */
export async function setGuestRelationship(
  guestId1: string,
  guestId2: string,
  input: { affinity?: number | null; constraint?: string | null; note?: string | null }
): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  if (guestId1 === guestId2) return { error: 'A guest cannot be rated against themselves.' }
  if (input.affinity != null && !isValidAffinity(input.affinity)) return { error: 'Affinity must be between -3 and +3.' }
  if (input.constraint != null && !isSeatingConstraint(input.constraint)) return { error: 'Unknown seating constraint.' }

  const [guestAId, guestBId] = normalizePair(guestId1, guestId2)
  const note = input.note === undefined ? undefined : input.note?.trim() || null

  try {
    const existing = await db.guestRelationship.findUnique({ where: { guestAId_guestBId: { guestAId, guestBId } } })
    const next = {
      affinity: input.affinity === undefined ? existing?.affinity ?? null : input.affinity,
      constraint: input.constraint === undefined ? existing?.constraint ?? null : input.constraint,
      note: note === undefined ? existing?.note ?? null : note,
    }

    if (next.affinity === null && next.constraint === null && next.note === null) {
      if (existing) await db.guestRelationship.delete({ where: { id: existing.id } })
    } else {
      await db.guestRelationship.upsert({
        where: { guestAId_guestBId: { guestAId, guestBId } },
        create: { guestAId, guestBId, ...next },
        update: next,
      })
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Set guest relationship error:', error)
    return { error: 'Failed to save rating.' }
  }
}

export async function setExcludeFromSeating(guestId: string, excludeFromSeating: boolean): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  try {
    await db.guest.update({ where: { id: guestId }, data: { excludeFromSeating } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Set exclude from seating error:', error)
    return { error: 'Failed to update guest.' }
  }
}

export async function setSeatRequirement(guestId: string, seatRequirement: string | null): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  if (seatRequirement !== null && !isSeatRequirement(seatRequirement)) return { error: 'Unknown seat requirement.' }
  try {
    await db.guest.update({ where: { id: guestId }, data: { seatRequirement } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Set seat requirement error:', error)
    return { error: 'Failed to update guest.' }
  }
}

// ---------------------------------------------------------------------------------------------
// Seating Lab: saved plans and default settings

export type SavePlanInput = {
  id?: string // Overwrite this plan instead of creating one
  name: string
  source: string
  config: Prisma.InputJsonValue
  params: Prisma.InputJsonValue
  score: number
  assignments: { seatKey: string; guestId: string; isLocked: boolean }[]
}

export async function saveSeatingPlan(input: SavePlanInput): Promise<{ success: true; id: string } | { error: string }> {
  await getAuthenticatedAdmin()
  const name = input.name.trim()
  if (!name) return { error: 'Give the plan a name.' }
  const seatKeys = new Set(input.assignments.map((a) => a.seatKey))
  const guestIds = new Set(input.assignments.map((a) => a.guestId))
  if (seatKeys.size !== input.assignments.length || guestIds.size !== input.assignments.length) {
    return { error: 'Each seat and guest can only appear once.' }
  }

  try {
    const data = {
      name,
      source: input.source,
      config: input.config,
      params: input.params,
      score: Number.isFinite(input.score) ? input.score : null,
    }
    const id = await db.$transaction(async (tx) => {
      if (input.id) {
        await tx.seatAssignment.deleteMany({ where: { planId: input.id } })
        await tx.seatingPlan.update({ where: { id: input.id }, data })
        await tx.seatAssignment.createMany({ data: input.assignments.map((a) => ({ ...a, planId: input.id! })) })
        return input.id
      }
      const plan = await tx.seatingPlan.create({ data: { ...data, assignments: { create: input.assignments } } })
      return plan.id
    })
    revalidatePath('/admin/seating')
    return { success: true, id }
  } catch (error) {
    console.error('Save seating plan error:', error)
    return { error: 'Failed to save plan.' }
  }
}

export async function deleteSeatingPlan(planId: string): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  try {
    await db.seatingPlan.delete({ where: { id: planId } })
    revalidatePath('/admin/seating')
    return { success: true }
  } catch (error) {
    console.error('Delete seating plan error:', error)
    return { error: 'Failed to delete plan.' }
  }
}

export async function saveSeatingSettings(config: Prisma.InputJsonValue): Promise<ActionResult> {
  await getAuthenticatedAdmin()
  try {
    await db.seatingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', config }, update: { config } })
    revalidatePath('/admin/seating')
    return { success: true }
  } catch (error) {
    console.error('Save seating settings error:', error)
    return { error: 'Failed to save settings.' }
  }
}
