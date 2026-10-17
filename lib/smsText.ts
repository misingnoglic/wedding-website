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

// Some carriers reject longer messages (Twilio error 30019)
export const MAX_RECOMMENDED_SEGMENTS = 10

function isGsmChar(char: string): boolean {
  return GSM_BASIC.includes(char) || GSM_EXTENDED.includes(char)
}

/**
 * The distinct characters that force a message into unicode, e.g. ["’", "🌴"]
 */
export function findUnicodeChars(text: string): string[] {
  return [...new Set([...text].filter((char) => !isGsmChar(char)))]
}

const GSM_REPLACEMENTS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': '-', '―': '-', '‐': '-', '‑': '-', '•': '-',
  '…': '...',
  ' ': ' ', ' ': ' ', ' ': ' ',
}

/**
 * Swaps curly quotes, dashes, and accents for plain equivalents and drops emoji, so the
 * message uses the GSM alphabet and fits 153 characters per segment instead of 67.
 */
export function toGsmText(text: string): string {
  const converted = [...text]
    .map((char) => {
      if (isGsmChar(char)) return char
      if (char in GSM_REPLACEMENTS) return GSM_REPLACEMENTS[char]
      const unaccented = char.normalize('NFD').replace(/[̀-ͯ]/g, '') // á → a
      return [...unaccented].every(isGsmChar) ? unaccented : ''
    })
    .join('')
  // Tidy up the gaps a removed emoji leaves behind
  return converted.replace(/ {2,}/g, ' ').replace(/ +$/gm, '').trim()
}

// Twilio's US price per outbound segment ($0.0083) plus carrier pass-through fees (~$0.0045), per Oct 2026 usage
const COST_PER_SEGMENT_USD = 0.0128

// Below this, top up before a big group text drains it and texts start failing
export const LOW_BALANCE_USD = 5

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function smsCost(segments: number): number {
  return segments * COST_PER_SEGMENT_USD
}

/**
 * Rough Twilio cost of sending this many segments, e.g. "$12.29"
 */
export function estimateSmsCost(segments: number): string {
  return formatUsd(smsCost(segments))
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
