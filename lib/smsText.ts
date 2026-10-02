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

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

// Titles that aren't abbreviations, so they don't get a trailing period
const UNABBREVIATED_TITLES = new Set(['miss'])

/**
 * Name with title, e.g. "Dr. Ana Lopez" or "Miss Cleo Lopez"
 */
export function fullName(name: string, title: string | null | undefined): string {
  const t = title?.trim()
  if (!t || t.toLowerCase() === 'none') return name.trim()
  const formatted = t.endsWith('.') || UNABBREVIATED_TITLES.has(t.toLowerCase()) ? t : `${t}.`
  return `${formatted} ${name.trim()}`
}

/**
 * "Ana", "Ana & Ben", "Ana, Ben & Cleo"
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
