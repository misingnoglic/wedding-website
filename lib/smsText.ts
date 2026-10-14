import { formatTitle } from './guestFields'

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXTENDED = '^{}\\[~]|€' // Each costs two characters

export interface SegmentInfo {
  length: number
  segments: number
  isUnicode: boolean // Emoji, curly quotes, etc. force UCS-2, which fits far fewer characters
}

/**
 * Counts how many SMS segments a message will be billed as.
 */
export function getSegmentInfo(text: string): SegmentInfo {
  let gsmLength = 0
  let isUnicode = false
  for (const char of text) {
    if (GSM_BASIC.includes(char)) gsmLength += 1
    else if (GSM_EXTENDED.includes(char)) gsmLength += 2
    else {
      isUnicode = true
      break
    }
  }

  if (isUnicode) {
    const length = text.length // UTF-16 code units
    return { length, segments: length <= 70 ? 1 : Math.ceil(length / 67), isUnicode }
  }
  return { length: gsmLength, segments: gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153), isUnicode }
}

// Twilio's US price per outbound segment ($0.0083) plus carrier pass-through fees (~$0.0045), per Oct 2026 usage
const COST_PER_SEGMENT_USD = 0.0128

/**
 * Rough Twilio cost of sending this many segments, e.g. "$12.29"
 */
export function estimateSmsCost(segments: number): string {
  return `$${(segments * COST_PER_SEGMENT_USD).toFixed(2)}`
}

/** Guests whose first name is more than one word, keyed by their full stored name */
const FIRST_NAME_OVERRIDES: Record<string, string> = {
  'Mary Clare Caggiano': 'Mary Clare',
}

export function firstName(fullName: string): string {
  const trimmed = fullName.trim()
  const override = FIRST_NAME_OVERRIDES[trimmed.replace(/\s+/g, ' ')]
  if (override) return override
  return trimmed.split(/\s+/)[0] || fullName
}

/**
 * Name with title, e.g. "Dr. Ana Lopez" or "Miss Cleo Lopez"
 */
export function fullName(name: string, title: string | null | undefined): string {
  return [formatTitle(title), name.trim()].filter(Boolean).join(' ')
}

/**
 * "Ana", "Ana & Ben", "Ana, Ben & Cleo"
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
