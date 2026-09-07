'use client'

import { useState, useEffect } from 'react'
import { checkPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/pushClient'

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSubscribing, setIsSubscribing] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      checkPushSubscription().then(setSubscription)
    }
  }, [])

  async function handleSubscribe() {
    setIsSubscribing(true)
    const sub = await subscribeToPush()
    if (sub) setSubscription(sub)
    setIsSubscribing(false)
  }

  async function handleUnsubscribe() {
    setIsSubscribing(true)
    const success = await unsubscribeFromPush()
    if (success) setSubscription(null)
    setIsSubscribing(false)
  }

  if (!isSupported) {
    return null
  }

  return (
    <button
      onClick={subscription ? handleUnsubscribe : handleSubscribe}
      disabled={isSubscribing}
      className={`w-full inline-flex items-center justify-center px-3 py-2.5 text-[10px] sm:text-xs font-sans tracking-wider uppercase rounded-xl transition-colors border ${
        subscription 
          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      } ${isSubscribing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title="Receive live push notifications on this device when guests RSVP"
    >
      {isSubscribing 
        ? 'Updating...' 
        : subscription 
          ? 'Disable Push Alerts' 
          : 'Enable Push Alerts'}
    </button>
  )
}
