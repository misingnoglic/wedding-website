import { saveSubscription, deleteSubscription } from '@/app/actions/push'

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function getReadyServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser')
  }
  
  // Explicitly register the service worker to ensure it exists
  // This prevents navigator.serviceWorker.ready from hanging indefinitely 
  // if the load event missed it or it wasn't registered elsewhere.
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function checkPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }
  try {
    const registration = await getReadyServiceWorker()
    return await registration.pushManager.getSubscription()
  } catch (error) {
    console.error('Error checking push subscription:', error)
    return null
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push notifications are not supported in this browser.')
    return null
  }
  try {
    const registration = await getReadyServiceWorker()
    
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not found')
    }

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // Save to server
    const result = await saveSubscription(JSON.parse(JSON.stringify(sub)))
    if (result.error) {
      console.error('Failed to save subscription:', result.error)
      alert(`Failed to save subscription: ${result.error}`)
    }
    
    return sub
  } catch (error: any) {
    console.error('Error subscribing to push:', error)
    if (error.name === 'NotAllowedError') {
      alert('Push notification permission was denied. Please enable it in your browser settings.')
    } else {
      alert('Could not subscribe to push notifications: ' + (error.message || 'Unknown error'))
    }
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }
  try {
    const registration = await getReadyServiceWorker()
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      await deleteSubscription(subscription.endpoint)
      return true
    }
    return false
  } catch (error) {
    console.error('Error unsubscribing:', error)
    return false
  }
}
