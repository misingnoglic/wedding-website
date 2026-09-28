'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InboxThread, ThreadMessage } from '@/lib/inbox'
import { getPhoneKey } from '@/lib/phone'
import {
  dismissThreadAction,
  getInboxThreadsAction,
  getThreadMessagesAction,
  markThreadReadAction,
  sendSmsAction,
} from '@/app/actions/sms'
import { FlatGuest } from '../../types'
import ThreadList, { ThreadFilter } from '../messages/ThreadList'
import ThreadView from '../messages/ThreadView'
import { useMediaQuery } from '../messages/utils'

interface MessagesTabProps {
  initialThreads: InboxThread[]
  allGuests: FlatGuest[]
  currentAdminName: string
  onOpenMenu: () => void
}

const REFRESH_INTERVAL_MS = 10_000

export default function MessagesTab({ initialThreads, allGuests, currentAdminName, onOpenMenu }: MessagesTabProps) {
  const [fetchedThreads, setThreads] = useState(initialThreads)
  const [messagesByKey, setMessagesByKey] = useState<Record<string, ThreadMessage[]>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<ThreadFilter>('all')
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sendingKey, setSendingKey] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // On desktop the inbox sticks to the top of the viewport; scroll there so the whole thing is visible
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      containerRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [])

  const selectedKeyRef = useRef(selectedKey)
  useEffect(() => {
    selectedKeyRef.current = selectedKey
  }, [selectedKey])

  // Guests can share a phone (e.g. a couple), so map each key to every matching guest
  const guestsByKey = useMemo(() => {
    const map = new Map<string, FlatGuest[]>()
    for (const guest of allGuests) {
      if (!guest.phoneNumber) continue
      const key = getPhoneKey(guest.phoneNumber)
      map.set(key, [...(map.get(key) || []), guest])
    }
    return map
  }, [allGuests])

  const refreshThreads = useCallback(async () => {
    setThreads(await getInboxThreadsAction())
  }, [])

  const loadMessages = useCallback(async (phoneKey: string) => {
    const messages = await getThreadMessagesAction(phoneKey)
    setMessagesByKey((prev) => ({ ...prev, [phoneKey]: messages }))
  }, [])

  // Poll for new texts and delivery updates while the page is visible, and refresh on return
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      refreshThreads()
      if (selectedKeyRef.current) loadMessages(selectedKeyRef.current)
    }
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refreshThreads, loadMessages])

  // The open conversation is read by definition; tell the server whenever it has unread messages
  const activeUnread = fetchedThreads.find((t) => t.phoneKey === selectedKey)?.unreadCount || 0
  useEffect(() => {
    if (selectedKey && activeUnread > 0) markThreadReadAction(selectedKey)
  }, [selectedKey, activeUnread])

  const threads = useMemo(
    () => fetchedThreads.map((t) => (t.phoneKey === selectedKey && t.unreadCount > 0 ? { ...t, unreadCount: 0 } : t)),
    [fetchedThreads, selectedKey]
  )
  const activeThread = threads.find((t) => t.phoneKey === selectedKey) || null

  // The mobile conversation view is a full-screen overlay; keep the page behind it from scrolling
  const isOverlayOpen = !isDesktop && selectedKey !== null
  useEffect(() => {
    if (!isOverlayOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOverlayOpen])

  const selectThread = (phoneKey: string) => {
    setSelectedKey(phoneKey)
    setSendError(null)
    loadMessages(phoneKey)
  }

  const counts = useMemo<Record<ThreadFilter, number>>(
    () => ({
      all: threads.length,
      needsReply: threads.filter((t) => t.needsReply).length,
      unread: threads.filter((t) => t.unreadCount > 0).length,
      unknown: threads.filter((t) => !guestsByKey.has(t.phoneKey)).length,
    }),
    [threads, guestsByKey]
  )

  const visibleThreads = useMemo(() => {
    const query = search.trim().toLowerCase()
    const queryDigits = query.replace(/\D/g, '')
    return threads.filter((thread) => {
      const guests = guestsByKey.get(thread.phoneKey) || []
      if (filter === 'needsReply' && !thread.needsReply) return false
      if (filter === 'unread' && thread.unreadCount === 0) return false
      if (filter === 'unknown' && guests.length > 0) return false
      if (!query) return true
      return (
        guests.some((g) => g.name.toLowerCase().includes(query) || g.familyName.toLowerCase().includes(query)) ||
        (queryDigits.length > 0 && thread.phoneKey.includes(queryDigits)) ||
        thread.lastMessage.body.toLowerCase().includes(query)
      )
    })
  }, [threads, guestsByKey, filter, search])

  const handleSend = async () => {
    if (!activeThread) return
    const phoneKey = activeThread.phoneKey
    const body = (drafts[phoneKey] || '').trim()
    if (!body) return

    setSendingKey(phoneKey)
    setSendError(null)
    // Show the message immediately; the reload below replaces it with the stored copy
    const pending: ThreadMessage = {
      id: `pending-${Date.now()}`,
      body,
      createdAt: new Date(),
      direction: 'outbound',
      status: 'sending',
      errorCode: null,
      sentByName: currentAdminName,
      broadcastId: null,
    }
    setMessagesByKey((prev) => ({ ...prev, [phoneKey]: [...(prev[phoneKey] || []), pending] }))
    setDrafts((prev) => ({ ...prev, [phoneKey]: '' }))

    const result = await sendSmsAction(activeThread.phone, body)
    if (!result.success) {
      setSendError(result.error)
      setDrafts((prev) => ({ ...prev, [phoneKey]: prev[phoneKey] || body }))
    }
    await Promise.all([loadMessages(phoneKey), refreshThreads()])
    setSendingKey(null)
  }

  const handleDismiss = async () => {
    if (!activeThread) return
    const phoneKey = activeThread.phoneKey
    setThreads((prev) => prev.map((t) => (t.phoneKey === phoneKey ? { ...t, needsReply: false, unreadCount: 0 } : t)))
    await dismissThreadAction(phoneKey)
  }

  return (
    <div
      ref={containerRef}
      className="-mx-4 sm:mx-0 bg-white sm:rounded-3xl sm:border border-zinc-200/80 sm:shadow-sm lg:grid lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:h-[calc(100dvh-3rem)] lg:sticky lg:top-6 lg:scroll-mt-6 lg:overflow-hidden"
    >
      <div className="lg:border-r lg:border-zinc-200/80 lg:min-h-0">
        <ThreadList
          threads={visibleThreads}
          guestsByKey={guestsByKey}
          selectedKey={selectedKey}
          onSelect={selectThread}
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
          onOpenMenu={onOpenMenu}
        />
      </div>

      <section
        className={
          activeThread
            ? 'fixed inset-x-0 top-0 h-[100dvh] z-[60] lg:static lg:h-auto lg:z-auto lg:min-h-0'
            : 'hidden lg:flex lg:items-center lg:justify-center lg:bg-zinc-50/70'
        }
      >
        {activeThread ? (
          <ThreadView
            thread={activeThread}
            guests={guestsByKey.get(activeThread.phoneKey) || []}
            messages={messagesByKey[activeThread.phoneKey]}
            draft={drafts[activeThread.phoneKey] || ''}
            onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [activeThread.phoneKey]: value }))}
            onSend={handleSend}
            isSending={sendingKey === activeThread.phoneKey}
            sendError={sendError}
            onBack={() => setSelectedKey(null)}
            onDismiss={handleDismiss}
          />
        ) : (
          <p className="text-sm font-karla text-zinc-400">Select a conversation</p>
        )}
      </section>
    </div>
  )
}
