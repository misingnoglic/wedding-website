/**
 * Options and normalization for guest fields, shared by the RSVP form and the admin dashboard so
 * both store values the same way. Safe to import from client components.
 */

export const TITLE_OPTIONS = ['None', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr']
export const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten Free (Celiac)', 'Kosher (Certified)', 'Kids']
// The names normalizeHotelName maps common spellings to
export const HOTEL_OPTIONS = ['The Cape', 'Sunrock Hotel', 'Pueblo Bonito Rosé', 'Grand Velas', 'Hacienda Beach Club', 'Airbnb / Villa']

const cleanString = (val: unknown): string | null => {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  return trimmed === '' ? null : trimmed
}

/** Form value for an attendance question: 'true' / 'false', anything else is unanswered */
export function parseRsvpAnswer(val: unknown): boolean | null {
  return val === 'true' ? true : val === 'false' ? false : null
}

export function normalizeTitle(val: unknown): string | null {
  const trimmed = cleanString(val)
  return !trimmed || trimmed.toLowerCase() === 'none' ? null : trimmed
}

// Titles that aren't abbreviations, so they don't get a trailing period
const UNABBREVIATED_TITLES = new Set(['miss'])

/** "Dr" -> "Dr.", "Miss" -> "Miss", none -> '' */
export function formatTitle(title: string | null | undefined): string {
  const t = normalizeTitle(title)
  if (!t) return ''
  return t.endsWith('.') || UNABBREVIATED_TITLES.has(t.toLowerCase()) ? t : `${t}.`
}

export function normalizeEmail(val: unknown): string | null {
  return cleanString(val)?.toLowerCase() ?? null
}

const AIRLINE_CODES: [RegExp, string][] = [
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

/** "american airlines #1234" -> "AA 1234", "aa1234" -> "AA 1234" */
export function normalizeFlightNumber(val: unknown): string | null {
  const trimmed = cleanString(val)
  if (!trimmed) return null

  let flight = trimmed.toUpperCase()
  flight = flight.replace(/^(?:FLIGHT|FLT|NO\.?)\s*/i, '').replace(/#/g, '').trim()

  for (const [regex, code] of AIRLINE_CODES) {
    if (regex.test(flight)) {
      flight = flight.replace(regex, code)
      break
    }
  }

  // Airline code (two letters, or a letter and a digit) + number
  const match = flight.match(/^([A-Z]{2,3}|[A-Z][0-9]|[0-9][A-Z])\s*(\d+)$/i)
  flight = match ? `${match[1].toUpperCase()} ${match[2]}` : flight.replace(/\s+/g, ' ')

  return flight === '' ? null : flight
}

export function normalizeHotelName(val: unknown): string | null {
  const trimmed = cleanString(val)
  if (!trimmed) return null

  if (/\bcape\b/i.test(trimmed)) return 'The Cape'
  if (/\bsun\s*rock\b/i.test(trimmed)) return 'Sunrock Hotel'
  if (/\bpueblo\s*bonito\b/i.test(trimmed) || /\bpb\s*ros[eé]\b/i.test(trimmed)) return 'Pueblo Bonito Rosé'
  if (/\b(?:airbnb|air\s*bnb|vrbo)\b/i.test(trimmed)) return 'Airbnb / Villa'
  if (/\bgrand\s*velas\b/i.test(trimmed)) return 'Grand Velas'
  if (/\bhacienda\b/i.test(trimmed)) return 'Hacienda Beach Club'

  return trimmed
}

const NO_DIETARY_RESTRICTIONS = new Set([
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
])

/** Maps common answers onto DIETARY_OPTIONS (and a few extra categories); non-answers become null */
export function normalizeDietaryRestrictions(val: unknown): string | null {
  const trimmed = cleanString(val)
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  if (NO_DIETARY_RESTRICTIONS.has(lower)) return null

  if (/^(?:gf|celiac|gluten[\s-]*free(?:\s*\(celiac\))?)$/i.test(lower)) return 'Gluten Free (Celiac)'
  if (/^(?:dairy[\s-]*free|lactose|lactose[\s-]*intolerant|no[\s-]*dairy)$/i.test(lower)) return 'Dairy Free'
  if (/^(?:nut[\s-]*allergy|peanut[\s-]*allergy|tree[\s-]*nuts|peanuts?|nuts?)$/i.test(lower)) return 'Nut Allergy'
  if (/^(?:veg|vegetarian)$/i.test(lower)) return 'Vegetarian'
  if (/^(?:vegan)$/i.test(lower)) return 'Vegan'
  if (/^(?:kosher(?:\s*\(certified\))?)$/i.test(lower)) return 'Kosher (Certified)'
  if (/^(?:kids?|kids?[\s-]*meal)$/i.test(lower)) return 'Kids'

  return trimmed
}

/** Splits a stored value into the option picker's state: one of DIETARY_OPTIONS, or 'Other' with text */
export function splitDietary(value: string | null): { type: string; text: string } {
  const normalized = normalizeDietaryRestrictions(value)
  if (!normalized) return { type: 'None', text: '' }
  const option = DIETARY_OPTIONS.find((opt) => opt.toLowerCase() === normalized.toLowerCase())
  return option ? { type: option, text: '' } : { type: 'Other', text: normalized }
}

/** The form value for the option picker's state (inverse of splitDietary) */
export function joinDietary(type: string, text: string): string {
  if (type === 'Other') return text
  return type === 'None' ? '' : type
}

export function normalizeSongRequests(val: unknown): string | null {
  if (typeof val !== 'string') return null
  return cleanString(val.trim().replace(/^["'`]|["'`]$/g, ''))
}

/** Dates are only kept alongside their flight number, matching the RSVP form */
export function normalizeFlightDate(date: unknown, flightNumber: string | null): string | null {
  return flightNumber ? cleanString(date) : null
}
