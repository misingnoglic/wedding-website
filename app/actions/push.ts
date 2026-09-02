'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export async function saveSubscription(subscription: any) {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return { error: 'Not authenticated' }
  }

  try {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { id: true },
    })

    if (!family) {
      return { error: 'Family not found' }
    }

    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        familyId: familyId,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        familyId: familyId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return { error: 'Failed to save subscription' }
  }
}

export async function deleteSubscription(endpoint: string) {
  try {
    await db.pushSubscription.delete({
      where: { endpoint },
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting push subscription:', error)
    return { error: 'Failed to delete subscription' }
  }
}
