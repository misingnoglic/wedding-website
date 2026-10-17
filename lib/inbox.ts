import { db } from '@/lib/db'
import { describeReaction, parseReaction, resolveReactions } from '@/lib/smsReactions'

export type SmsDirection = 'inbound' | 'outbound'

export interface InboxThread {
  phoneKey: string
  phone: string // Guest-side phone number as last seen
  lastMessage: {
    id: string
    body: string
    createdAt: Date
    direction: SmsDirection
    status: string | null
    reaction?: string | null // Preview like "❤️ to “See you there”" when the last text is a reaction
  }
  messageCount: number
  unreadCount: number
  needsReply: boolean
}

export interface ThreadMessage {
  id: string
  body: string
  createdAt: Date
  direction: SmsDirection
  status: string | null
  errorCode: number | null
  sentByName: string | null
  broadcastId: string | null
}

type ThreadRow = {
  phoneKey: string
  id: string
  body: string
  createdAt: Date
  direction: SmsDirection
  status: string | null
  fromPhone: string
  toPhone: string | null
  messageCount: number
  unreadCount: number
  dismissedAt: Date | null
}

/**
 * One row per conversation with its latest message, newest first.
 */
export async function getInboxThreads(): Promise<InboxThread[]> {
  const rows = await db.$queryRaw<ThreadRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("phoneKey") "phoneKey", id, body, "createdAt", direction, status, "fromPhone", "toPhone"
      FROM "SmsMessage"
      ORDER BY "phoneKey", "createdAt" DESC
    ),
    counts AS (
      SELECT m."phoneKey",
        COUNT(*)::int AS "messageCount",
        COUNT(*) FILTER (
          WHERE m.direction = 'inbound' AND (t."lastReadAt" IS NULL OR m."createdAt" > t."lastReadAt")
        )::int AS "unreadCount"
      FROM "SmsMessage" m
      LEFT JOIN "SmsThread" t ON t."phoneKey" = m."phoneKey"
      GROUP BY m."phoneKey"
    )
    SELECT l.*, c."messageCount", c."unreadCount", t."dismissedAt"
    FROM latest l
    JOIN counts c ON c."phoneKey" = l."phoneKey"
    LEFT JOIN "SmsThread" t ON t."phoneKey" = l."phoneKey"
    ORDER BY l."createdAt" DESC
  `

  const reactionThreads = await getReactionThreadInfo(rows)

  return rows.map((row) => ({
    phoneKey: row.phoneKey,
    phone: row.direction === 'inbound' ? row.fromPhone : row.toPhone || row.phoneKey,
    lastMessage: {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      direction: row.direction,
      status: row.status,
      reaction: reactionThreads.get(row.phoneKey)?.preview ?? null,
    },
    messageCount: row.messageCount,
    unreadCount: row.unreadCount,
    needsReply: needsReply(reactionThreads.get(row.phoneKey)?.latestText ?? row, row.dismissedAt),
  }))
}

// A guest's text needs a reply until we answer or dismiss it
function needsReply(latest: { direction: string; createdAt: Date } | null, dismissedAt: Date | null): boolean {
  return !!latest && latest.direction === 'inbound' && (!dismissedAt || latest.createdAt > dismissedAt)
}

/**
 * For threads whose latest message looks like a reaction, confirm it against the thread and find
 * the latest real text, since a ❤️ on our message doesn't need a reply.
 */
async function getReactionThreadInfo(rows: ThreadRow[]) {
  const info = new Map<string, { preview: string; latestText: { direction: string; createdAt: Date } | null }>()
  const candidates = rows.filter((row) => parseReaction(row.body))
  await Promise.all(
    candidates.map(async (row) => {
      const messages = await db.smsMessage.findMany({
        where: { phoneKey: row.phoneKey },
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, direction: true, status: true, createdAt: true },
      })
      const { reactionIds } = resolveReactions(messages)
      if (!reactionIds.has(row.id)) return
      const latestText = messages.findLast((m) => !reactionIds.has(m.id)) ?? null
      info.set(row.phoneKey, { preview: describeReaction(parseReaction(row.body)!), latestText })
    })
  )
  return info
}

export async function getThreadMessages(phoneKey: string): Promise<ThreadMessage[]> {
  const messages = await db.smsMessage.findMany({
    where: { phoneKey },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      direction: true,
      status: true,
      errorCode: true,
      sentByName: true,
      broadcastId: true,
    },
  })
  return messages.map((m) => ({ ...m, direction: m.direction as SmsDirection }))
}

export async function markThreadRead(phoneKey: string) {
  await db.smsThread.upsert({
    where: { phoneKey },
    create: { phoneKey, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  })
}

export async function dismissThread(phoneKey: string) {
  const now = new Date()
  await db.smsThread.upsert({
    where: { phoneKey },
    create: { phoneKey, lastReadAt: now, dismissedAt: now },
    update: { lastReadAt: now, dismissedAt: now },
  })
}
