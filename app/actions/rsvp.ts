'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/audit'

export async function loginFamily(prevState: unknown, formData: FormData) {
  const password = formData.get('password') as string
  const rawRedirectUrl = formData.get('redirectUrl') as string | null
  const redirectUrl = (rawRedirectUrl && rawRedirectUrl.startsWith('/')) ? rawRedirectUrl : '/rsvp'

  if (!password) {
    return { error: 'Please enter a password' }
  }

  try {
    const family = await db.family.findFirst({
      where: { 
        password: {
          equals: password.trim(),
          mode: 'insensitive'
        }
      },
    })

    if (!family) {
      // Artificial 2-second delay to slow down brute-force attacks on invalid passwords
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return { error: 'Invalid password. Please check your invitation.' }
    }

    // Set cookie, expiry in 1 year
    const cookieStore = await cookies()
    cookieStore.set('rsvp_family_id', family.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })

    await logAuditEvent({
      familyId: family.id,
      actorType: family.isAdmin ? 'ADMIN' : 'GUEST',
      actorName: family.name,
      eventType: 'GUEST_LOGIN',
      description: `${family.name} logged into their invitation.`,
    })

    revalidatePath('/rsvp')
    revalidatePath('/account')
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Something went wrong. Please try again.' }
  }
  
  redirect(redirectUrl)
}

export async function logoutFamily(redirectUrlOrFormData?: string | FormData) {
  const redirectUrl = typeof redirectUrlOrFormData === 'string' && redirectUrlOrFormData.startsWith('/')
    ? redirectUrlOrFormData
    : '/login'

  const cookieStore = await cookies()
  cookieStore.delete('rsvp_family_id')
  revalidatePath('/rsvp')
  revalidatePath('/account')
  redirect(redirectUrl)
}

export async function updateFamilyName(prevState: unknown, formData: FormData) {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return { error: 'Not authenticated. Please log in first.' }
  }

  const rawFamilyName = formData.get('familyName') as string || ''
  const familyName = rawFamilyName.trim()

  if (!familyName) {
    return { error: 'Family name cannot be empty.' }
  }

  if (familyName.length < 2) {
    return { error: 'Family name must be at least 2 characters long.' }
  }

  try {
    await db.family.update({
      where: { id: familyId },
      data: { name: familyName },
    })

    await logAuditEvent({
      familyId: familyId,
      actorType: 'GUEST',
      actorName: familyName,
      eventType: 'FAMILY_UPDATED',
      description: `Party name updated to "${familyName}".`,
    })

    revalidatePath('/account')
    revalidatePath('/rsvp')
    return { success: true, message: 'Family name updated successfully!' }
  } catch (error) {
    console.error('Update family name error:', error)
    return { error: 'Failed to update family name. Please try again.' }
  }
}

export async function resetPassword(prevState: unknown, formData: FormData) {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return { error: 'Not authenticated. Please log in first.' }
  }

  const newPassword = (formData.get('newPassword') as string || '').trim()
  const confirmPassword = (formData.get('confirmPassword') as string || '').trim()

  if (!newPassword || !confirmPassword) {
    return { error: 'Please fill in both password fields.' }
  }

  if (newPassword.length < 3) {
    return { error: 'Password must be at least 3 characters long.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match. Please re-enter them.' }
  }

  try {
    const currentFamily = await db.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, password: true, passwordUpdatedAt: true },
    })

    if (!currentFamily) {
      return { error: 'Account not found. Please log in again.' }
    }

    // 2-hour cooldown check
    if (currentFamily.passwordUpdatedAt) {
      const timeSinceLastUpdateMs = Date.now() - new Date(currentFamily.passwordUpdatedAt).getTime()
      const twoHoursMs = 2 * 60 * 60 * 1000

      if (timeSinceLastUpdateMs < twoHoursMs) {
        const remainingMs = twoHoursMs - timeSinceLastUpdateMs
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
        if (remainingMinutes > 60) {
          const hours = Math.floor(remainingMinutes / 60)
          const mins = remainingMinutes % 60
          return {
            error: `Password was recently updated. Please wait ${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` and ${mins} minute${mins > 1 ? 's' : ''}` : ''} before resetting it again.`,
          }
        } else {
          return {
            error: `Password was recently updated. Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before resetting it again.`,
          }
        }
      }
    }

    // Check if same as current password
    if (currentFamily.password.toLowerCase() === newPassword.toLowerCase()) {
      return { error: 'Please choose a different password.' }
    }

    // Check if another family already uses this password
    const existingFamily = await db.family.findFirst({
      where: {
        password: {
          equals: newPassword,
          mode: 'insensitive',
        },
        NOT: {
          id: familyId,
        },
      },
    })

    if (existingFamily) {
      return { error: 'Please choose a different password.' }
    }

    await db.family.update({
      where: { id: familyId },
      data: {
        password: newPassword,
        passwordUpdatedAt: new Date(),
      },
    })

    await logAuditEvent({
      familyId,
      actorType: 'GUEST',
      actorName: currentFamily.name,
      eventType: 'PASSWORD_RESET',
      description: `${currentFamily.name} updated their invitation password.`,
    })

    revalidatePath('/account')
    revalidatePath('/rsvp')
    return { success: true, message: 'Password updated successfully!' }
  } catch (error) {
    console.error('Reset password error:', error)
    return { error: 'Failed to reset password. Please try again.' }
  }
}

export async function updateRsvp(prevState: unknown, formData: FormData) {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return { error: 'Not authenticated' }
  }

  const formatFlightNumber = (fn: string | null) => {
    if (!fn) return null
    let val = fn.trim().toUpperCase()
    if (!val) return null

    // Strip leading words/symbols like "FLIGHT", "FLT", "#", "NO."
    val = val.replace(/^(?:FLIGHT|FLT|NO\.?)\s*/i, '')
    val = val.replace(/#/g, '')
    val = val.trim()

    // Airline mappings for common names spelled out
    const airlineMap: [RegExp, string][] = [
      [/^(?:AMERICAN\s*AIRLINES|AMERICAN)\s*/i, 'AA '],
      [/^(?:DELTA\s*AIR\s*LINES|DELTA\s*AIRLINES|DELTA)\s*/i, 'DL '],
      [/^(?:UNITED\s*AIRLINES|UNITED)\s*/i, 'UA '],
      [/^(?:SOUTHWEST\s*AIRLINES|SOUTHWEST)\s*/i, 'WN '],
      [/^(?:ALASKA\s*AIRLINES|ALASKA)\s*/i, 'AS '],
      [/^(?:JETBLUE\s*AIRWAYS|JET\s*BLUE|JETBLUE)\s*/i, 'B6 '],
      [/^(?:SPIRIT\s*AIRLINES|SPIRIT)\s*/i, 'NK '],
      [/^(?:FRONTIER\s*AIRLINES|FRONTIER)\s*/i, 'F9 '],
      [/^(?:AEROMEXICO|AERO\s*MEXICO)\s*/i, 'AM '],
      [/^(?:VOLARIS)\s*/i, 'Y4 '],
      [/^(?:VIVA\s*AEROBUS|VIVAAEROBUS|VIVA)\s*/i, 'VB '],
      [/^(?:AIR\s*CANADA)\s*/i, 'AC '],
      [/^(?:WESTJET|WEST\s*JET)\s*/i, 'WS '],
    ]

    for (const [regex, code] of airlineMap) {
      if (regex.test(val)) {
        val = val.replace(regex, code)
        break
      }
    }

    // Format standard airline code + number: e.g. "AA1234" -> "AA 1234"
    const match = val.match(/^([A-Z0-9]{2,3})\s*(\d+)$/i)
    if (match) {
      val = `${match[1].toUpperCase()} ${match[2]}`
    } else {
      val = val.replace(/\s+/g, ' ')
    }

    return val === '' ? null : val
  }

  const cleanString = (val: unknown) => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim()
    return trimmed === '' ? null : trimmed
  }

  const normalizeEmail = (val: unknown) => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim().toLowerCase()
    return trimmed === '' ? null : trimmed
  }

  const normalizePhoneNumber = (val: unknown) => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim()
    if (!trimmed) return null

    // Extract all digits
    const digits = trimmed.replace(/\D/g, '')

    // 10-digit US/Canada number e.g. 5551234567 -> (555) 123-4567
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }

    // 11-digit US/Canada number starting with 1 e.g. 15551234567 -> +1 (555) 123-4567
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    }

    // If international with leading +, clean up excess whitespace
    if (trimmed.startsWith('+')) {
      return '+' + trimmed.slice(1).replace(/\s+/g, ' ').trim()
    }

    return trimmed
  }

  const normalizeHotelName = (val: string | null) => {
    if (!val) return null
    const trimmed = val.trim()
    if (!trimmed) return null

    // The Cape
    if (/\bcape\b/i.test(trimmed)) {
      return 'The Cape'
    }
    // Sunrock Hotel
    if (/\bsun\s*rock\b/i.test(trimmed)) {
      return 'Sunrock Hotel'
    }
    // Pueblo Bonito Rosé
    if (/\bpueblo\s*bonito\b/i.test(trimmed) || /\bpb\s*ros[eé]\b/i.test(trimmed)) {
      return 'Pueblo Bonito Rosé'
    }
    // Airbnb / Villa
    if (/\b(?:airbnb|air\s*bnb|vrbo)\b/i.test(trimmed)) {
      return 'Airbnb / Villa'
    }
    // Grand Velas
    if (/\bgrand\s*velas\b/i.test(trimmed)) {
      return 'Grand Velas'
    }
    // Hacienda Beach Club
    if (/\bhacienda\b/i.test(trimmed)) {
      return 'Hacienda Beach Club'
    }

    return trimmed
  }

  const normalizeDietaryRestrictions = (val: unknown) => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim()
    if (!trimmed) return null

    const lower = trimmed.toLowerCase()

    // Nullify negative / non-answers
    const noneMatches = [
      'none',
      'n/a',
      'na',
      'no',
      'nothing',
      'nil',
      'none!',
      'no restrictions',
      'no allergies',
      'n / a',
      'none.',
      'none known',
    ]
    if (noneMatches.includes(lower)) {
      return null
    }

    // Common aliases
    if (/^(?:gf|celiac|gluten[\s-]*free)$/i.test(lower)) {
      return 'Gluten Free (Celiac)'
    }
    if (/^(?:dairy[\s-]*free|lactose|lactose[\s-]*intolerant|no[\s-]*dairy)$/i.test(lower)) {
      return 'Dairy Free'
    }
    if (/^(?:nut[\s-]*allergy|peanut[\s-]*allergy|tree[\s-]*nuts|peanuts?|nuts?)$/i.test(lower)) {
      return 'Nut Allergy'
    }
    if (/^(?:veg|vegetarian)$/i.test(lower)) {
      return 'Vegetarian'
    }
    if (/^(?:vegan)$/i.test(lower)) {
      return 'Vegan'
    }
    if (/^(?:kosher)$/i.test(lower)) {
      return 'Kosher (Certified)'
    }

    return trimmed
  }

  const normalizeSongRequests = (val: unknown) => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim().replace(/^["'`]|["'`]$/g, '').trim()
    return trimmed === '' ? null : trimmed
  }

  try {
    // Collect guest IDs from submission
    const guestIds = formData.getAll('guestId') as string[]

    // Fetch existing guests to validate ownership and compute change diffs
    const existingGuests = await db.guest.findMany({
      where: { familyId },
    })
    const existingGuestMap = new Map(existingGuests.map((g) => [g.id, g]))

    const guestChanges: string[] = []

    // Perform a transaction to update all valid guests
    await db.$transaction(async (tx) => {
      for (const guestId of guestIds) {
        const prev = existingGuestMap.get(guestId)
        if (!prev) continue // Skip if guest does not belong to this family

        // Parse boolean values
        const attendingWelcomeStr = formData.get(`isAttendingWelcome_${guestId}`) as string
        const isAttendingWelcome =
          attendingWelcomeStr === 'true' ? true : attendingWelcomeStr === 'false' ? false : null

        const attendingWeddingStr = formData.get(`isAttendingWedding_${guestId}`) as string
        const isAttendingWedding =
          attendingWeddingStr === 'true' ? true : attendingWeddingStr === 'false' ? false : null

        const arrivalFlightNumber = formatFlightNumber(formData.get(`arrivalFlightNumber_${guestId}`) as string)
        const departureFlightNumber = formatFlightNumber(
          formData.get(`departureFlightNumber_${guestId}`) as string
        )

        const rawTitle = formData.get(`title_${guestId}`) as string | null
        const title =
          !rawTitle || rawTitle.trim() === '' || rawTitle.trim().toLowerCase() === 'none'
            ? null
            : rawTitle.trim()

        const rawName = formData.get(`name_${guestId}`) as string | null
        const name = rawName && rawName.trim() ? rawName.trim() : undefined

        const email = normalizeEmail(formData.get(`email_${guestId}`))
        const phoneNumber = normalizePhoneNumber(formData.get(`phoneNumber_${guestId}`))
        const dietaryRestrictions = normalizeDietaryRestrictions(formData.get(`dietaryRestrictions_${guestId}`))
        const arrivalDate = arrivalFlightNumber ? cleanString(formData.get(`arrivalDate_${guestId}`)) : null
        const departureDate = departureFlightNumber
          ? cleanString(formData.get(`departureDate_${guestId}`))
          : null
        const rawHotelName = cleanString(formData.get(`hotelName_${guestId}`))
        const hotelName = normalizeHotelName(rawHotelName)
        const songRequests = normalizeSongRequests(formData.get(`songRequests_${guestId}`))

        // Compute field-level diffs for this guest
        const diffs: string[] = []
        const guestName = prev.name

        // 1. Wedding attendance
        if (prev.isAttendingWedding !== isAttendingWedding) {
          if (isAttendingWedding === true) diffs.push('accepted Wedding')
          else if (isAttendingWedding === false) diffs.push('declined Wedding')
          else diffs.push('set Wedding to pending')
        }

        // 2. Welcome party attendance
        if (prev.isAttendingWelcome !== isAttendingWelcome) {
          if (isAttendingWelcome === true) diffs.push('attending Welcome Party')
          else if (isAttendingWelcome === false) diffs.push('declined Welcome Party')
          else diffs.push('set Welcome Party to pending')
        }

        // 3. Dietary
        if ((prev.dietaryRestrictions || null) !== dietaryRestrictions) {
          if (dietaryRestrictions) diffs.push(`dietary: "${dietaryRestrictions}"`)
          else diffs.push('cleared dietary')
        }

        // 4. Hotel
        if ((prev.hotelName || null) !== hotelName) {
          if (hotelName) diffs.push(`hotel: "${hotelName}"`)
          else diffs.push('cleared hotel')
        }

        // 5. Flights
        if ((prev.arrivalFlightNumber || null) !== arrivalFlightNumber || (prev.arrivalDate || null) !== arrivalDate) {
          if (arrivalFlightNumber) diffs.push(`arrival: ${arrivalFlightNumber}${arrivalDate ? ` (${arrivalDate})` : ''}`)
          else if (prev.arrivalFlightNumber) diffs.push('cleared arrival flight')
        }

        if ((prev.departureFlightNumber || null) !== departureFlightNumber || (prev.departureDate || null) !== departureDate) {
          if (departureFlightNumber) diffs.push(`departure: ${departureFlightNumber}${departureDate ? ` (${departureDate})` : ''}`)
          else if (prev.departureFlightNumber) diffs.push('cleared departure flight')
        }

        // 6. Song requests
        if ((prev.songRequests || null) !== songRequests) {
          if (songRequests) diffs.push(`song: "${songRequests}"`)
          else diffs.push('cleared song request')
        }

        // 7. Contact info
        if ((prev.email || null) !== email || (prev.phoneNumber || null) !== phoneNumber) {
          diffs.push('updated contact info')
        }

        if (diffs.length > 0) {
          guestChanges.push(`${guestName} (${diffs.join(', ')})`)
        }

        // Perform the actual update
        await tx.guest.update({
          where: { id: guestId },
          data: {
            title,
            ...(name ? { name } : {}),
            email,
            phoneNumber,
            isAttendingWelcome,
            isAttendingWedding,
            dietaryRestrictions,
            arrivalFlightNumber,
            arrivalDate,
            departureFlightNumber,
            departureDate,
            hotelName,
            songRequests,
          },
        })
      }
    })

    // If no fields actually changed, skip audit logging to eliminate autosave duplicate noise!
    if (guestChanges.length > 0) {
      const family = await db.family.findUnique({
        where: { id: familyId },
        select: { name: true, isAdmin: true },
      })

      const familyDisplayName = family?.name || 'Guest'
      const description = `${familyDisplayName}: ${guestChanges.join('; ')}`

      // Coalescing: Check if there was an RSVP update from this family within the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      const recentAudit = await db.auditEvent.findFirst({
        where: {
          familyId,
          eventType: 'RSVP_UPDATED',
          createdAt: { gte: twoMinutesAgo },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (recentAudit) {
        // Coalesce into existing recent event by updating description and details
        await db.auditEvent.update({
          where: { id: recentAudit.id },
          data: {
            description: `${recentAudit.description} | ${guestChanges.join('; ')}`,
            details: JSON.stringify({
              changes: guestChanges,
              updatedAt: new Date().toISOString(),
            }),
          },
        })
      } else {
        await logAuditEvent({
          familyId,
          actorType: family?.isAdmin ? 'ADMIN' : 'GUEST',
          actorName: familyDisplayName,
          eventType: 'RSVP_UPDATED',
          description,
          details: JSON.stringify({
            changes: guestChanges,
            updatedAt: new Date().toISOString(),
          }),
        })
      }
    }

    revalidatePath('/rsvp')
    revalidatePath('/account')
    revalidatePath('/admin')
    return { success: true, message: 'RSVP updated successfully!' }
  } catch (error) {
    console.error('Update RSVP error:', error)
    return { error: 'Failed to update RSVP. Please try again.' }
  }
}

