import { useCallback, useSyncExternalStore } from 'react'
import { FlatGuest } from '../../types'
import { formatPhoneNumber } from '@/lib/phone'
import { firstName, joinNames } from '@/lib/smsText'
import { describeSmsError, isFailedStatus } from '@/lib/smsStatus'

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

function isYesterday(d: Date) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return isSameDay(d, yesterday)
}

export function formatTime(input: Date | string) {
  return new Date(input).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Conversation list timestamp: "3:04 PM", "Yesterday", "Mon", "Sep 12" */
export function formatListTime(input: Date | string) {
  const d = new Date(input)
  const now = new Date()
  if (isSameDay(d, now)) return formatTime(d)
  if (isYesterday(d)) return 'Yesterday'
  if (now.getTime() - d.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateDivider(input: Date | string) {
  const d = new Date(input)
  const now = new Date()
  if (isSameDay(d, now)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Name for a conversation: full name for one guest, first names when several share a phone */
export function contactName(guests: FlatGuest[], phone: string) {
  if (guests.length === 0) return formatPhoneNumber(phone) || phone
  if (guests.length === 1) return guests[0].name
  return joinNames(guests.map((g) => firstName(g.name)))
}

export function statusLabel(status: string | null, errorCode: number | null) {
  if (isFailedStatus(status)) return describeSmsError(errorCode)
  switch (status) {
    case 'sending': // Local optimistic state before the server responds
      return 'Sending…'
    case 'accepted':
    case 'queued': // Twilio has it; delivery updates follow
    case 'sent':
      return 'Sent'
    case 'delivered':
      return 'Delivered'
    default:
      return null
  }
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', callback)
      return () => media.removeEventListener('change', callback)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
