import { getSegmentInfo } from './smsText'

/**
 * Text-message reactions ("tapbacks"). Over SMS a reaction is just a text quoting the message it
 * reacts to, in a format phones recognize:
 *   iPhone (English):  Loved “See you in Cabo”
 *   iPhone (Spanish):  Exclamó por “See you in Cabo”
 *   Android:           🥳 to “ See you in Cabo ” (with zero-width and hair spaces mixed in)
 * The wording depends on the sender's language, so a text only counts as a reaction when its quote
 * matches an earlier message in the conversation. Unknown wordings still work; they just have no emoji.
 */

export interface ParsedReaction {
  phrase: string // The wording before the quote, e.g. "Loved" or "Exclamó por"
  emoji: string | null // Null for wordings we don't recognize yet
  quote: string
  isTruncated: boolean // Long messages get quoted as "start of the text…"
  isRemoval: boolean // "Removed a heart from “…”"
}

export interface Reaction {
  messageId: string // The reaction text itself
  emoji: string | null
  phrase: string
  direction: string // 'inbound': the guest reacted; 'outbound': we did
}

// Reactions we can send; English wording with curly quotes shows as a reaction on iPhone and Android
export const SENDABLE_REACTIONS = [
  { emoji: '❤️', verb: 'Loved' },
  { emoji: '👍', verb: 'Liked' },
  { emoji: '👎', verb: 'Disliked' },
  { emoji: '😂', verb: 'Laughed at' },
  { emoji: '‼️', verb: 'Emphasized' },
  { emoji: '❓', verb: 'Questioned' },
] as const

export type ReactionVerb = (typeof SENDABLE_REACTIONS)[number]['verb']

// Wordings seen from real phones, lowercased. Add more as they show up (other languages, etc.)
const KNOWN_PHRASES: Record<string, string> = {
  ...Object.fromEntries(SENDABLE_REACTIONS.map((r) => [r.verb.toLowerCase(), r.emoji])),
  'exclamó por': '‼️', // Spanish iPhone
}

// Zero-width characters Android sprinkles in (not U+200D, which joins multi-part emoji)
const INVISIBLE = /[​‌⁠﻿]/g
const QUOTED = /^([^\n“”"]{1,40}?)\s*[“"]([\s\S]+)[”"]$/u
// Android "🥳 to" and iOS 18 custom emoji "Reacted 🥳 to"
const EMOJI_PHRASE = /^(?:reacted\s+)?(\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍]*)\s+to$/iu
const TRUNCATION = /(?:…|\.\.\.)$/

function normalize(text: string): string {
  return text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
}

/**
 * Whether a text has the shape of a reaction. Only trust it once the quote matches a message
 * (see resolveReactions), since a guest could also write e.g. What does “cocktail attire”.
 */
export function parseReaction(body: string): ParsedReaction | null {
  const match = body.replace(INVISIBLE, '').trim().match(QUOTED)
  if (!match) return null
  const phrase = match[1].trim()
  const quote = normalize(match[2])
  if (!phrase || !quote) return null

  const isTruncated = TRUNCATION.test(quote)
  const emoji = KNOWN_PHRASES[phrase.toLowerCase()] ?? phrase.match(EMOJI_PHRASE)?.[1] ?? null
  return {
    phrase,
    emoji,
    quote: isTruncated ? quote.replace(TRUNCATION, '').trim() : quote,
    isTruncated,
    isRemoval: /^removed\b/i.test(phrase),
  }
}

function quoteMatches(reaction: ParsedReaction, body: string): boolean {
  const text = normalize(body)
  return reaction.isTruncated ? text.startsWith(reaction.quote) : text === reaction.quote
}

interface ResolvableMessage {
  id: string
  body: string
  direction: string
  status?: string | null
}

export interface ResolvedReactions {
  byTarget: Map<string, Reaction[]> // Reactions on each message, at most one per side
  reactionIds: Set<string> // Texts that are reactions, to show as badges instead of bubbles
}

/**
 * Pairs each reaction text with the message it quotes. Messages must be oldest first.
 * A newer reaction from the same side replaces the older one, like on a phone.
 */
export function resolveReactions(messages: ResolvableMessage[]): ResolvedReactions {
  const byTarget = new Map<string, Reaction[]>()
  const reactionIds = new Set<string>()

  messages.forEach((message, i) => {
    // A reaction we failed to send stays a normal (failed) bubble so it's visible
    if (message.status === 'failed' || message.status === 'undelivered') return
    const parsed = parseReaction(message.body)
    if (!parsed) return

    let target: ResolvableMessage | undefined
    for (let j = i - 1; j >= 0; j--) {
      if (!reactionIds.has(messages[j].id) && quoteMatches(parsed, messages[j].body)) {
        target = messages[j]
        break
      }
    }
    if (!target) return

    reactionIds.add(message.id)
    const others = (byTarget.get(target.id) ?? []).filter((r) => r.direction !== message.direction)
    const reaction = { messageId: message.id, emoji: parsed.emoji, phrase: parsed.phrase, direction: message.direction }
    byTarget.set(target.id, parsed.isRemoval ? others : [...others, reaction])
  })

  return { byTarget, reactionIds }
}

/**
 * Reaction text to send, quoting just enough of the message to stay one SMS.
 */
export function buildReactionText(verb: ReactionVerb, body: string): string {
  const text = normalize(body)
  const full = `${verb} “${text}”`
  if (getSegmentInfo(full).segments === 1) return full

  // Curly quotes make this a unicode SMS: 70 UTF-16 units, minus the wording, quotes, and ellipsis
  const budget = 70 - verb.length - 4
  let cut = ''
  for (const char of text) {
    if (cut.length + char.length > budget) break
    cut += char
  }
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > budget * 0.6) cut = cut.slice(0, lastSpace)
  return `${verb} “${cut.trimEnd()}…”`
}

/** Short list preview, e.g. "❤️ to “See you in Cabo”" */
export function describeReaction(reaction: Pick<ParsedReaction, 'phrase' | 'emoji' | 'quote' | 'isTruncated'>): string {
  const quote = `“${reaction.quote}${reaction.isTruncated ? '…' : ''}”`
  return reaction.emoji ? `${reaction.emoji} to ${quote}` : `${reaction.phrase} ${quote}`
}
