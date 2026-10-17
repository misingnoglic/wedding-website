import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReactionText, describeReaction, parseReaction, resolveReactions } from './smsReactions'
import { getSegmentInfo } from './smsText'

// Real reactions received in Oct 2026
const IPHONE = 'Loved “Your RSVP is good on our end. Your mom\'s as well.”'
const IPHONE_SPANISH = 'Exclamó por “Can you react to this with an emoji other than heart?”'
const ANDROID = '​🥳​ to “ Hiii ”'

test('parseReaction reads iPhone, Spanish iPhone, and Android formats', () => {
  assert.deepEqual(parseReaction(IPHONE), {
    phrase: 'Loved',
    emoji: '❤️',
    quote: "Your RSVP is good on our end. Your mom's as well.",
    isTruncated: false,
    isRemoval: false,
  })
  assert.equal(parseReaction(IPHONE_SPANISH)?.emoji, '‼️')
  assert.equal(parseReaction(IPHONE_SPANISH)?.quote, 'Can you react to this with an emoji other than heart?')
  assert.equal(parseReaction(ANDROID)?.emoji, '🥳')
  assert.equal(parseReaction(ANDROID)?.quote, 'Hiii')
})

test('parseReaction handles truncation, removals, custom emoji, and unknown wordings', () => {
  const truncated = parseReaction('Liked “lorem ipsum dolor sit amet…”')
  assert.equal(truncated?.isTruncated, true)
  assert.equal(truncated?.quote, 'lorem ipsum dolor sit amet')
  assert.equal(parseReaction('Removed a heart from “Hi”')?.isRemoval, true)
  assert.equal(parseReaction('Reacted 🎉 to “Hi”')?.emoji, '🎉')
  const unknown = parseReaction('Le gustó “Hi”')
  assert.equal(unknown?.emoji, null)
  assert.equal(unknown?.phrase, 'Le gustó')
})

test('parseReaction ignores ordinary texts', () => {
  assert.equal(parseReaction('Got it, thanks!'), null)
  assert.equal(parseReaction('“Quoted” but nothing before it'), null)
  assert.equal(parseReaction('Line one\nWhat does “cocktail attire” mean? We were wondering'), null)
})

test('resolveReactions attaches reactions to the quoted message', () => {
  const messages = [
    { id: 'a', body: "Your RSVP is good on our end. Your mom's as well.", direction: 'outbound' },
    { id: 'b', body: 'Thanks!', direction: 'inbound' },
    { id: 'c', body: IPHONE, direction: 'inbound' },
  ]
  const { byTarget, reactionIds } = resolveReactions(messages)
  assert.deepEqual([...reactionIds], ['c'])
  assert.deepEqual(byTarget.get('a'), [{ messageId: 'c', emoji: '❤️', phrase: 'Loved', direction: 'inbound' }])
})

test('resolveReactions only trusts texts whose quote matches', () => {
  const messages = [
    { id: 'a', body: 'Dress code is on the website', direction: 'outbound' },
    { id: 'b', body: 'What does “cocktail attire”', direction: 'inbound' },
  ]
  assert.equal(resolveReactions(messages).reactionIds.size, 0)
})

test('resolveReactions matches truncated quotes and replaces or removes reactions per side', () => {
  const messages = [
    { id: 'a', body: 'lorem ipsum dolor sit amet consectetur adipiscing elit vero', direction: 'inbound' },
    { id: 'b', body: 'Loved “lorem ipsum dolor sit amet…”', direction: 'outbound' },
    { id: 'c', body: 'Liked “lorem ipsum dolor sit amet…”', direction: 'outbound' },
    { id: 'd', body: '​😂​ to “ lorem ipsum dolor sit amet consectetur adipiscing elit vero ”', direction: 'inbound' },
  ]
  const reactions = resolveReactions(messages).byTarget.get('a')
  assert.deepEqual(reactions?.map((r) => r.emoji), ['👍', '😂'])

  const removed = resolveReactions([...messages, { id: 'e', body: 'Removed a like from “lorem ipsum dolor sit amet…”', direction: 'outbound' }])
  assert.deepEqual(removed.byTarget.get('a')?.map((r) => r.emoji), ['😂'])
})

test('resolveReactions leaves failed reactions as normal bubbles', () => {
  const messages = [
    { id: 'a', body: 'Hi', direction: 'inbound' },
    { id: 'b', body: 'Loved “Hi”', direction: 'outbound', status: 'failed' },
  ]
  assert.equal(resolveReactions(messages).reactionIds.size, 0)
})

test('buildReactionText quotes short messages in full', () => {
  assert.equal(buildReactionText('Loved', 'Hi'), 'Loved “Hi”')
})

test('buildReactionText keeps long messages to one SMS', () => {
  const long = 'lorem ipsum dolor sit amet consectetur adipiscing elit vero provident pariatur cumque accusamus laborum'
  for (const verb of ['Loved', 'Questioned'] as const) {
    const text = buildReactionText(verb, long)
    assert.equal(getSegmentInfo(text).segments, 1, text)
    assert.ok(text.endsWith('…”'))
    const parsed = parseReaction(text)!
    assert.ok(long.startsWith(parsed.quote))
  }
  assert.equal(getSegmentInfo(buildReactionText('Laughed at', '🎉'.repeat(60))).segments, 1)
})

test('describeReaction', () => {
  assert.equal(describeReaction(parseReaction(ANDROID)!), '🥳 to “Hiii”')
  assert.equal(describeReaction(parseReaction('Le gustó “Hi…”')!), 'Le gustó “Hi…”')
})
