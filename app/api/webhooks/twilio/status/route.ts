import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { isValidTwilioSignature } from '@/lib/sms'
import { shouldUpdateStatus } from '@/lib/smsStatus'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/twilio/status
 * Delivery status callbacks for outbound messages (set as statusCallback when sending).
 */
export async function POST(request: NextRequest) {
  const params = new URLSearchParams(await request.text().catch(() => ''))

  if (!isValidTwilioSignature(request, params)) {
    console.warn('Rejected Twilio status callback with missing or invalid signature')
    return new Response('Forbidden', { status: 403 })
  }

  const messageSid = params.get('MessageSid')
  const status = params.get('MessageStatus')
  const errorCode = Number(params.get('ErrorCode')) || null

  if (messageSid && status) {
    try {
      const message = await db.smsMessage.findUnique({
        where: { messageSid },
        select: { status: true },
      })
      if (message && shouldUpdateStatus(message.status, status)) {
        await db.smsMessage.update({
          where: { messageSid },
          data: { status, ...(errorCode ? { errorCode } : {}) },
        })
      }
    } catch (error) {
      console.error('Error handling Twilio status callback:', error)
    }
  }

  return new Response(null, { status: 204 })
}
