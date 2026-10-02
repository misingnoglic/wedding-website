import { getPhoneKey } from './phone'
import { firstName, fullName, joinNames } from './smsText'

/** The guest fields audience filtering and templates need (FlatGuest satisfies this). */
export interface AudienceGuest {
  id: string
  title: string | null
  name: string
  phoneNumber: string | null
  familyId: string
  familyName: string
  familyPassword?: string
  isAttendingWelcome: boolean | null
  isAttendingRehearsalDinner: boolean | null
  isAttendingWedding: boolean | null
  isRehearsalDinnerInvited: boolean
  hasLoggedIn: boolean
  hotelName: string | null
}

export type RsvpChoice = 'any' | 'yes' | 'no' | 'pending'
export type HotelChoice = 'any' | 'cape' | 'notCape' | 'unknown'

export interface AudienceFilters {
  wedding: RsvpChoice
  welcome: RsvpChoice
  rehearsal: RsvpChoice
  anyEventYes: boolean // Said yes to at least one event
  noResponse: boolean // Hasn't answered any event
  login: 'any' | 'never' | 'loggedIn'
  rehearsalInvited: 'any' | 'yes' | 'no'
  hotel: HotelChoice
  includeDeclined: boolean // Off by default so bulk texts skip guests who declined the wedding
}

export const DEFAULT_FILTERS: AudienceFilters = {
  wedding: 'any',
  welcome: 'any',
  rehearsal: 'any',
  anyEventYes: false,
  noResponse: false,
  login: 'any',
  rehearsalInvited: 'any',
  hotel: 'any',
  includeDeclined: false,
}

export function isAtCape(hotelName: string | null): boolean {
  return !!hotelName && /\bcape\b/i.test(hotelName)
}

function matchesRsvp(value: boolean | null, choice: RsvpChoice) {
  if (choice === 'yes') return value === true
  if (choice === 'no') return value === false
  if (choice === 'pending') return value === null
  return true
}

function eventAnswers(guest: AudienceGuest) {
  const answers = [guest.isAttendingWedding, guest.isAttendingWelcome]
  if (guest.isRehearsalDinnerInvited) answers.push(guest.isAttendingRehearsalDinner)
  return answers
}

export function matchesFilters(guest: AudienceGuest, filters: AudienceFilters): boolean {
  if (!filters.includeDeclined && guest.isAttendingWedding === false) return false
  if (!matchesRsvp(guest.isAttendingWedding, filters.wedding)) return false
  if (!matchesRsvp(guest.isAttendingWelcome, filters.welcome)) return false
  if (filters.rehearsal !== 'any') {
    if (!guest.isRehearsalDinnerInvited) return false
    if (!matchesRsvp(guest.isAttendingRehearsalDinner, filters.rehearsal)) return false
  }
  if (filters.anyEventYes && !eventAnswers(guest).some((a) => a === true)) return false
  if (filters.noResponse && !eventAnswers(guest).every((a) => a === null)) return false
  if (filters.login === 'never' && guest.hasLoggedIn) return false
  if (filters.login === 'loggedIn' && !guest.hasLoggedIn) return false
  if (filters.rehearsalInvited === 'yes' && !guest.isRehearsalDinnerInvited) return false
  if (filters.rehearsalInvited === 'no' && guest.isRehearsalDinnerInvited) return false
  if (filters.hotel === 'cape' && !isAtCape(guest.hotelName)) return false
  if (filters.hotel === 'notCape' && (!guest.hotelName || isAtCape(guest.hotelName))) return false
  if (filters.hotel === 'unknown' && guest.hotelName) return false
  return true
}

const RSVP_LABELS: Record<Exclude<RsvpChoice, 'any'>, string> = { yes: 'yes', no: 'no', pending: 'pending' }

/** Short human description of a filter set, stored with each broadcast */
export function describeFilters(filters: AudienceFilters): string {
  const parts: string[] = []
  if (filters.wedding !== 'any') parts.push(`Wedding: ${RSVP_LABELS[filters.wedding]}`)
  if (filters.welcome !== 'any') parts.push(`Welcome party: ${RSVP_LABELS[filters.welcome]}`)
  if (filters.rehearsal !== 'any') parts.push(`Rehearsal dinner: ${RSVP_LABELS[filters.rehearsal]}`)
  if (filters.anyEventYes) parts.push('Yes to any event')
  if (filters.noResponse) parts.push('No RSVP')
  if (filters.login === 'never') parts.push('Never logged in')
  if (filters.login === 'loggedIn') parts.push('Logged in')
  if (filters.rehearsalInvited === 'yes') parts.push('Rehearsal dinner invitees')
  if (filters.rehearsalInvited === 'no') parts.push('Not invited to rehearsal dinner')
  if (filters.hotel === 'cape') parts.push('At The Cape')
  if (filters.hotel === 'notCape') parts.push('Not at The Cape')
  if (filters.hotel === 'unknown') parts.push('Hotel not given')
  if (parts.length === 0) parts.push('Everyone')
  if (filters.includeDeclined) parts.push('including declined')
  return parts.join(' · ')
}

export interface Recipient<G extends AudienceGuest = AudienceGuest> {
  phoneKey: string
  phone: string
  guests: G[]
}

/**
 * One recipient per phone number, so guests who share a phone get a single text.
 * Guests without a phone are returned separately.
 */
export function groupRecipients<G extends AudienceGuest>(guests: G[]): { recipients: Recipient<G>[]; withoutPhone: G[] } {
  const byKey = new Map<string, Recipient<G>>()
  const withoutPhone: G[] = []
  for (const guest of guests) {
    if (!guest.phoneNumber?.trim()) {
      withoutPhone.push(guest)
      continue
    }
    const phoneKey = getPhoneKey(guest.phoneNumber)
    const existing = byKey.get(phoneKey)
    if (existing) existing.guests.push(guest)
    else byKey.set(phoneKey, { phoneKey, phone: guest.phoneNumber, guests: [guest] })
  }
  return { recipients: [...byKey.values()], withoutPhone }
}

export const PLACEHOLDERS = [
  { token: '{firstName}', description: 'First name (e.g. "Ana & Ben" on a shared phone)' },
  { token: '{fullName}', description: 'Title and full name (e.g. "Dr. Ana Lopez")' },
  { token: '{familyName}', description: 'Family / party name' },
  { token: '{code}', description: 'Their invite code' },
] as const

export function renderTemplate(template: string, guests: AudienceGuest[]): string {
  const primary = guests[0]
  return template
    .replaceAll('{firstName}', joinNames(guests.map((g) => firstName(g.name))))
    .replaceAll('{fullName}', joinNames(guests.map((g) => fullName(g.name, g.title))))
    .replaceAll('{familyName}', primary?.familyName || '')
    .replaceAll('{code}', primary?.familyPassword || '')
}

/** Placeholders in the text that we don't know how to fill (usually typos) */
export function findUnknownPlaceholders(template: string): string[] {
  const known = new Set<string>(PLACEHOLDERS.map((p) => p.token))
  return [...new Set(template.match(/\{[^{}\s]*\}/g) || [])].filter((token) => !known.has(token))
}
