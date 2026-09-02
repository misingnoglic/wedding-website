import webpush from 'web-push'
import { db } from '@/lib/db'

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

export async function sendAdminPushNotification(title: string, body: string, url: string = '/admin') {
  try {
    // Get all admin subscriptions
    const adminSubscriptions = await db.pushSubscription.findMany({
      where: {
        family: {
          isAdmin: true,
        },
      },
    })

    if (adminSubscriptions.length === 0) {
      return
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
    })

    // Send notifications in parallel
    await Promise.allSettled(
      adminSubscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webpush.sendNotification(pushSubscription, payload)
        } catch (error: any) {
          // If the subscription is invalid or expired, remove it from the DB
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`Push subscription ${sub.endpoint} has expired or is no longer valid. Deleting...`)
            await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } })
          } else {
            console.error('Error sending push notification:', error)
          }
        }
      })
    )
  } catch (error) {
    console.error('Failed to send admin push notification:', error)
  }
}
