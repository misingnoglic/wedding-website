/**
 * One-off, idempotent backfill for SmsMessage.phoneKey / direction / status and SmsThread rows.
 * Only touches messages whose phoneKey is still empty. Run with: npx tsx scripts/backfill-sms-threads.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { getComparablePhone, getPhoneKey } from '../lib/phone'

const db = new PrismaClient()

async function main() {
  const ourPhoneKey = getComparablePhone(process.env.TWILIO_PHONE_NUMBER)
  const messages = await db.smsMessage.findMany({ where: { phoneKey: '' } })
  console.log(`Backfilling ${messages.length} messages`)

  for (const msg of messages) {
    let payload: { direction?: string; status?: string } = {}
    try {
      payload = msg.rawPayload ? JSON.parse(msg.rawPayload) : {}
    } catch {}

    const isOutbound =
      payload.direction?.startsWith('outbound') ||
      (!!ourPhoneKey && getComparablePhone(msg.fromPhone) === ourPhoneKey)
    const threadPhone = isOutbound && msg.toPhone ? msg.toPhone : msg.fromPhone

    await db.smsMessage.update({
      where: { id: msg.id },
      data: {
        phoneKey: getPhoneKey(threadPhone),
        direction: isOutbound ? 'outbound' : 'inbound',
        status: isOutbound ? payload.status || null : null,
      },
    })
  }

  // Mark every existing conversation as read so history doesn't show up as unread
  const phoneKeys = await db.smsMessage.findMany({ distinct: ['phoneKey'], select: { phoneKey: true } })
  const created = await db.smsThread.createMany({
    data: phoneKeys.map(({ phoneKey }) => ({ phoneKey, lastReadAt: new Date() })),
    skipDuplicates: true,
  })
  console.log(`Created ${created.count} thread rows`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
