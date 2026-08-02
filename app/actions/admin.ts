'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

// 1. Create a New Family
export async function createFamilyAdmin(prevState: unknown, formData: FormData) {
  const admin = await getAuthenticatedAdmin()

  const rawName = formData.get('name') as string || ''
  const name = rawName.trim()
  const rawPassword = formData.get('password') as string || ''
  const password = rawPassword.trim()
  const isAdmin = formData.get('isAdmin') === 'true' || formData.get('isAdmin') === 'on'

  if (!name || name.length < 2) {
    return { error: 'Family name must be at least 2 characters long.' }
  }

  if (!password || password.length < 2) {
    return { error: 'Invitation code / password must be at least 2 characters long.' }
  }

  try {
    // Check if password already exists (case-insensitive)
    const existing = await db.family.findFirst({
      where: {
        password: {
          equals: password,
          mode: 'insensitive',
        },
      },
    })

    if (existing) {
      return { error: `The invitation code "${password}" is already in use by "${existing.name}". Please choose another.` }
    }

    // Parse initial guests
    const rawGuestsJson = formData.get('guestsJson') as string | null
    let guestsToCreate: Array<{ title: string | null; name: string; email?: string | null; phoneNumber?: string | null }> = []

    if (rawGuestsJson) {
      try {
        const parsed = JSON.parse(rawGuestsJson)
        if (Array.isArray(parsed)) {
          guestsToCreate = parsed
            .map((g: { title?: string; name?: string; email?: string; phoneNumber?: string }) => ({
              title: g.title && g.title.trim() !== 'None' ? g.title.trim() : null,
              name: (g.name || '').trim(),
              email: g.email && g.email.trim() ? g.email.trim() : null,
              phoneNumber: g.phoneNumber && g.phoneNumber.trim() ? g.phoneNumber.trim() : null,
            }))
            .filter((g) => g.name.length > 0)
        }
      } catch {
        // Fallback to single guest or empty
      }
    }

    // Default to at least one guest if none parsed
    if (guestsToCreate.length === 0) {
      guestsToCreate = [{ title: null, name }]
    }

    const createdFamily = await db.family.create({
      data: {
        name,
        password,
        isAdmin,
        guests: {
          create: guestsToCreate,
        },
      },
      include: {
        guests: true,
      },
    })

    await logAuditEvent({
      familyId: createdFamily.id,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'FAMILY_CREATED',
      description: `Created new family party "${name}" with code "${password}" (${createdFamily.guests.length} initial guests).`,
      details: { guests: createdFamily.guests.map((g) => g.name) },
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Successfully created "${name}" with ${createdFamily.guests.length} guest(s)!` }
  } catch (error) {
    console.error('Create family error:', error)
    return { error: 'Failed to create family. Please try again.' }
  }
}

// 2. Update Family Details
export async function updateFamilyAdmin(prevState: unknown, formData: FormData) {
  const admin = await getAuthenticatedAdmin()

  const familyId = formData.get('familyId') as string
  const rawName = formData.get('name') as string || ''
  const name = rawName.trim()
  const rawPassword = formData.get('password') as string || ''
  const password = rawPassword.trim()
  const isAdmin = formData.get('isAdmin') === 'true' || formData.get('isAdmin') === 'on'

  if (!familyId) {
    return { error: 'Missing family ID.' }
  }

  if (!name || name.length < 2) {
    return { error: 'Family name must be at least 2 characters long.' }
  }

  if (!password || password.length < 2) {
    return { error: 'Password must be at least 2 characters long.' }
  }

  try {
    // Check if password exists on another family
    const existing = await db.family.findFirst({
      where: {
        password: {
          equals: password,
          mode: 'insensitive',
        },
        NOT: {
          id: familyId,
        },
      },
    })

    if (existing) {
      return { error: `The invitation code "${password}" is already in use by "${existing.name}".` }
    }

    const updated = await db.family.update({
      where: { id: familyId },
      data: {
        name,
        password,
        isAdmin,
      },
    })

    await logAuditEvent({
      familyId: updated.id,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'FAMILY_UPDATED',
      description: `Updated family party "${name}" (Code: ${password}, Admin: ${isAdmin ? 'Yes' : 'No'}).`,
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Successfully updated "${name}"!` }
  } catch (error) {
    console.error('Update family error:', error)
    return { error: 'Failed to update family details. Please try again.' }
  }
}

// 3. Delete Family
export async function deleteFamilyAdmin(formDataOrId: FormData | string) {
  const admin = await getAuthenticatedAdmin()
  const familyId = typeof formDataOrId === 'string' ? formDataOrId : (formDataOrId.get('familyId') as string)

  if (!familyId) {
    return { error: 'Missing family ID.' }
  }

  try {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })

    if (!family) {
      return { error: 'Family not found.' }
    }

    await db.family.delete({
      where: { id: familyId },
    })

    await logAuditEvent({
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'FAMILY_DELETED',
      description: `Deleted family party "${family.name}" and all its guest records.`,
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Successfully deleted "${family.name}".` }
  } catch (error) {
    console.error('Delete family error:', error)
    return { error: 'Failed to delete family.' }
  }
}

// 4. Add Guest to Family
export async function addGuestAdmin(prevState: unknown, formData: FormData) {
  const admin = await getAuthenticatedAdmin()

  const familyId = formData.get('familyId') as string
  const rawTitle = formData.get('title') as string | null
  const title = (!rawTitle || rawTitle.trim() === '' || rawTitle.trim() === 'None') ? null : rawTitle.trim()
  const rawName = formData.get('name') as string || ''
  const name = rawName.trim()
  const email = (formData.get('email') as string || '').trim() || null
  const phoneNumber = (formData.get('phoneNumber') as string || '').trim() || null

  if (!familyId) {
    return { error: 'Missing family ID.' }
  }

  if (!name || name.length < 1) {
    return { error: 'Guest name cannot be empty.' }
  }

  try {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })

    if (!family) {
      return { error: 'Family not found.' }
    }

    const createdGuest = await db.guest.create({
      data: {
        familyId,
        title,
        name,
        email,
        phoneNumber,
      },
    })

    await logAuditEvent({
      familyId,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'GUEST_ADDED',
      description: `Added guest "${title ? `${title}. ` : ''}${name}" to family party "${family.name}".`,
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Added "${createdGuest.name}" to ${family.name}!` }
  } catch (error) {
    console.error('Add guest error:', error)
    return { error: 'Failed to add guest.' }
  }
}

// 5. Update Guest Details & RSVP directly by Admin
export async function updateGuestAdmin(prevState: unknown, formData: FormData) {
  const admin = await getAuthenticatedAdmin()

  const guestId = formData.get('guestId') as string
  if (!guestId) {
    return { error: 'Missing guest ID.' }
  }

  const rawTitle = formData.get('title') as string | null
  const title = (!rawTitle || rawTitle.trim() === '' || rawTitle.trim() === 'None') ? null : rawTitle.trim()
  const rawName = formData.get('name') as string || ''
  const name = rawName.trim()

  if (!name) {
    return { error: 'Guest name cannot be empty.' }
  }

  const formatFlightNumber = (fn: string | null) => {
    if (!fn) return null
    return fn.trim().toUpperCase().replace(/\s+/g, ' ')
  }

  const attendingWeddingStr = formData.get('isAttendingWedding') as string
  const isAttendingWedding = attendingWeddingStr === 'true' ? true : attendingWeddingStr === 'false' ? false : null

  const attendingWelcomeStr = formData.get('isAttendingWelcome') as string
  const isAttendingWelcome = attendingWelcomeStr === 'true' ? true : attendingWelcomeStr === 'false' ? false : null

  const arrivalFlightNumber = formatFlightNumber(formData.get('arrivalFlightNumber') as string)
  const arrivalDate = arrivalFlightNumber ? ((formData.get('arrivalDate') as string || '').trim() || null) : null

  const departureFlightNumber = formatFlightNumber(formData.get('departureFlightNumber') as string)
  const departureDate = departureFlightNumber ? ((formData.get('departureDate') as string || '').trim() || null) : null

  const dietaryRestrictions = (formData.get('dietaryRestrictions') as string || '').trim() || null
  const rawHotelName = (formData.get('hotelName') as string || '').trim() || null
  const hotelName = rawHotelName && /\bcape\b/i.test(rawHotelName) ? 'The Cape' : rawHotelName
  const songRequests = (formData.get('songRequests') as string || '').trim() || null
  const email = (formData.get('email') as string || '').trim() || null
  const phoneNumber = (formData.get('phoneNumber') as string || '').trim() || null

  try {
    const existing = await db.guest.findUnique({
      where: { id: guestId },
      include: { family: true },
    })

    if (!existing) {
      return { error: 'Guest not found.' }
    }

    const updated = await db.guest.update({
      where: { id: guestId },
      data: {
        title,
        name,
        email,
        phoneNumber,
        isAttendingWedding,
        isAttendingWelcome,
        dietaryRestrictions,
        arrivalFlightNumber,
        arrivalDate,
        departureFlightNumber,
        departureDate,
        hotelName,
        songRequests,
      },
    })

    const weddingStatusText = isAttendingWedding === true ? 'Attending' : isAttendingWedding === false ? 'Declined' : 'Pending'
    const welcomeStatusText = isAttendingWelcome === true ? 'Attending' : isAttendingWelcome === false ? 'Declined' : 'Pending'

    await logAuditEvent({
      familyId: existing.familyId,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'RSVP_UPDATED',
      description: `Admin updated RSVP for "${updated.name}" (${existing.family.name}): Wedding: ${weddingStatusText}, Welcome: ${welcomeStatusText}.`,
      details: JSON.stringify({
        isAttendingWedding,
        isAttendingWelcome,
        dietaryRestrictions,
        hotelName,
        arrivalFlightNumber,
        departureFlightNumber,
      }),
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Successfully updated "${updated.name}"!` }
  } catch (error) {
    console.error('Update guest error:', error)
    return { error: 'Failed to update guest.' }
  }
}

// 6. Delete Guest
export async function deleteGuestAdmin(formDataOrId: FormData | string) {
  const admin = await getAuthenticatedAdmin()
  const guestId = typeof formDataOrId === 'string' ? formDataOrId : (formDataOrId.get('guestId') as string)

  if (!guestId) {
    return { error: 'Missing guest ID.' }
  }

  try {
    const existing = await db.guest.findUnique({
      where: { id: guestId },
      include: { family: true },
    })

    if (!existing) {
      return { error: 'Guest not found.' }
    }

    await db.guest.delete({
      where: { id: guestId },
    })

    await logAuditEvent({
      familyId: existing.familyId,
      actorType: 'ADMIN',
      actorName: `${admin.name} (Admin)`,
      eventType: 'GUEST_DELETED',
      description: `Removed guest "${existing.name}" from family party "${existing.family.name}".`,
    })

    revalidatePath('/admin')
    revalidatePath('/rsvp')
    revalidatePath('/account')

    return { success: true, message: `Removed "${existing.name}".` }
  } catch (error) {
    console.error('Delete guest error:', error)
    return { error: 'Failed to delete guest.' }
  }
}

// 7. Impersonate / Act as Family
export async function impersonateFamilyAdmin(formDataOrFamilyId: FormData | string) {
  const admin = await getAuthenticatedAdmin()
  const familyId =
    typeof formDataOrFamilyId === 'string'
      ? formDataOrFamilyId
      : (formDataOrFamilyId.get('familyId') as string)

  if (!familyId) {
    return { error: 'Missing family ID.' }
  }

  const targetFamily = await db.family.findUnique({
    where: { id: familyId },
  })

  if (!targetFamily) {
    return { error: 'Target family not found.' }
  }

  // Set session cookie to target family
  const cookieStore = await cookies()
  cookieStore.set('rsvp_family_id', targetFamily.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  await logAuditEvent({
    familyId: targetFamily.id,
    actorType: 'ADMIN',
    actorName: `${admin.name} (Admin)`,
    eventType: 'ADMIN_IMPERSONATION',
    description: `Admin logged in as "${targetFamily.name}" to view/manage their RSVP.`,
  })

  revalidatePath('/rsvp')
  revalidatePath('/account')
  redirect('/rsvp')
}
