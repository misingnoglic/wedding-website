import { db } from './db'

/**
 * Extracts digits only from a raw phone string.
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Extracts a normalized comparable phone key.
 * For US/Canada numbers (10 or 11 digits starting with 1), this returns the core 10 digits.
 * Otherwise returns the raw digits.
 */
export function getComparablePhone(phone: string | null | undefined): string {
  const digits = extractDigits(phone)
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  if (digits.length >= 10) {
    return digits.slice(-10)
  }
  return digits
}

/**
 * Checks if two phone numbers match (best-effort).
 */
export function doPhoneNumbersMatch(phoneA: string | null | undefined, phoneB: string | null | undefined): boolean {
  if (!phoneA || !phoneB) return false
  const keyA = getComparablePhone(phoneA)
  const keyB = getComparablePhone(phoneB)
  if (!keyA || !keyB) return false
  return keyA === keyB
}

/**
 * Formats a phone number for user-friendly display.
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  const trimmed = phone.trim()
  const digits = extractDigits(trimmed)

  // 10 digits: (555) 123-4567
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // 11 digits starting with 1: +1 (555) 123-4567
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // International starting with +
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\s+/g, ' ').trim()
  }

  return trimmed
}

/**
 * Finds a matching guest in the database by phone number using best-effort digit comparison.
 */
export async function findMatchingGuestForPhone(rawPhone: string) {
  if (!rawPhone || !rawPhone.trim()) return null

  const targetKey = getComparablePhone(rawPhone)
  if (!targetKey) return null

  try {
    const guestsWithPhone = await db.guest.findMany({
      where: {
        phoneNumber: {
          not: null,
        },
      },
      include: {
        family: true,
      },
    })

    const matchedGuest = guestsWithPhone.find((g) => {
      if (!g.phoneNumber) return false
      return doPhoneNumbersMatch(g.phoneNumber, rawPhone)
    })

    return matchedGuest || null
  } catch (error) {
    console.error('Failed to match guest for phone:', error)
    return null
  }
}
