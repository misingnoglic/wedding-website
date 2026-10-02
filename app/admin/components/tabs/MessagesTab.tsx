'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BroadcastSummary } from '@/lib/broadcasts'
import type { InboxThread, ThreadMessage } from '@/lib/inbox'
import { getPhoneKey } from '@/lib/phone'
import { isPendingStatus } from '@/lib/smsStatus'
import {
  assignPhoneToGuestAction,
  dismissThreadAction,
  getBroadcastsAction,
  getInboxThreadsAction,
  getThreadMessagesAction,
  markThreadReadAction,
  sendSmsAction,
  syncSmsStatusesAction,
} from '@/app/actions/sms'
import { FlatGuest } from '../../types'
import ThreadList, { ListView, ThreadFilter } from '../messages/ThreadList'
import ThreadView from '../messages/ThreadView'
import GuestPanel from '../messages/GuestPanel'
import Composer from '../messages/Composer'
import { BroadcastList, BroadcastView } from '../messages/Broadcasts'
import { Icon, ICONS } from '../messages/ui'
import { useMediaQuery } from '../messages/utils'

export interface ComposeRequest {
  guestIds: string[]
  label?: string
}

export type MessagesTarget = { phone: string } | { compose: ComposeRequest }

interface MessagesTabProps {
  initialThreads: InboxThread[]
  allGuests: FlatGuest[]
  currentAdminId: string
  currentAdminName: string
  onOpenMenu: () => void
  onEditGuest: (guest: FlatGuest) => void
  initialTarget?: MessagesTarget // Open a conversation or prefilled composer on mount
}

// What the right-hand pane (or mobile overlay) is showing
type Pane =
  | { kind: 'none' }
  | { kind: 'thread'; phoneKey: string }
  | { kind: 'compose'; request?: ComposeRequest; id: number }
  | { kind: 'broadcast'; id: string }

const REFRESH_INTERVAL_MS = 10_000

export default function MessagesTab({
  initialThreads,
  allGuests,
  currentAdminId,
  currentAdminName,
  onOpenMenu,
  onEditGuest,
  initialTarget,
}: MessagesTabProps) {
  const router = useRouter()
  const [fetchedThreads, setThreads] = useState(initialThreads)
  const [broadcasts, setBroadcasts] = useState<BroadcastSummary[] | null>(null)
  const [messagesByKey, setMessagesByKey] = useState<Record<string, ThreadMessage[]>>({})
  const [pane, setPane] = useState<Pane>(() => {
    if (!initialTarget) return { kind: 'none' }
    if ('compose' in initialTarget) return { kind: 'compose', request: initialTarget.compose, id: 0 }
    return { kind: 'thread', phoneKey: getPhoneKey(initialTarget.phone) }
  })
  const [listView, setListView] = useState<ListView>('conversations')
  const [filter, setFilter] = useState<ThreadFilter>('all')
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sendingKey, setSendingKey] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  // Phone for a conversation that has no messages yet (e.g. texting a guest for the first time)
  const [newConversationPhone, setNewConversationPhone] = useState<string | null>(
    initialTarget && 'phone' in initialTarget ? initialTarget.phone : null
  )
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const selectedKey = pane.kind === 'thread' ? pane.phoneKey : null

  // On desktop the inbox sticks to the top of the viewport; scroll there so the whole thing is visible
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      containerRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [])

  const selectedKeyRef = useRef(selectedKey)
  const listViewRef = useRef(listView)
  useEffect(() => {
    selectedKeyRef.current = selectedKey
    listViewRef.current = listView
  }, [selectedKey, listView])

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

  const adminGuests = useMemo(() => allGuests.filter((g) => g.familyId === currentAdminId), [allGuests, currentAdminId])

  const refreshThreads = useCallback(async () => {
    setThreads(await getInboxThreadsAction())
  }, [])

  const refreshBroadcasts = useCallback(async () => {
    setBroadcasts(await getBroadcastsAction())
  }, [])

  const loadMessages = useCallback(async (phoneKey: string) => {
    const messages = await getThreadMessagesAction(phoneKey)
    setMessagesByKey((prev) => ({ ...prev, [phoneKey]: messages }))
  }, [])

  // Load the conversation opened from a link (e.g. a push notification)
  const initialKeyRef = useRef(selectedKey)
  useEffect(() => {
    if (initialKeyRef.current) loadMessages(initialKeyRef.current)
  }, [loadMessages])

  // Any outbound text on screen still in flight? Then ask Twilio directly, since status callbacks
  // don't arrive for texts sent from localhost
  const hasPendingStatus = useMemo(
    () =>
      fetchedThreads.some((t) => t.lastMessage.direction === 'outbound' && isPendingStatus(t.lastMessage.status)) ||
      Object.values(messagesByKey).some((msgs) => msgs.some((m) => m.direction === 'outbound' && isPendingStatus(m.status))) ||
      !!broadcasts?.some((b) => b.counts.sent > 0),
    [fetchedThreads, messagesByKey, broadcasts]
  )
  const hasPendingStatusRef = useRef(hasPendingStatus)
  useEffect(() => {
    hasPendingStatusRef.current = hasPendingStatus
  }, [hasPendingStatus])

  // Poll for new texts and delivery updates while the page is visible, and refresh on return
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      if (hasPendingStatusRef.current) await syncSmsStatusesAction().catch(() => 0)
      refreshThreads()
      if (selectedKeyRef.current) loadMessages(selectedKeyRef.current)
      if (listViewRef.current === 'broadcasts') refreshBroadcasts()
    }
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refreshThreads, loadMessages, refreshBroadcasts])

  // The open conversation is read by definition; tell the server whenever it has unread messages
  const activeUnread = fetchedThreads.find((t) => t.phoneKey === selectedKey)?.unreadCount || 0
  useEffect(() => {
    if (selectedKey && activeUnread > 0) markThreadReadAction(selectedKey)
  }, [selectedKey, activeUnread])

  const threads = useMemo(
    () => fetchedThreads.map((t) => (t.phoneKey === selectedKey && t.unreadCount > 0 ? { ...t, unreadCount: 0 } : t)),
    [fetchedThreads, selectedKey]
  )

  const activeThread = useMemo<InboxThread | null>(() => {
    const existing = threads.find((t) => t.phoneKey === selectedKey)
    if (existing) return existing
    if (!selectedKey || !newConversationPhone || getPhoneKey(newConversationPhone) !== selectedKey) return null
    return {
      phoneKey: selectedKey,
      phone: newConversationPhone,
      lastMessage: { id: '', body: '', createdAt: new Date(), direction: 'outbound', status: null },
      messageCount: 0,
      unreadCount: 0,
      needsReply: false,
    }
  }, [threads, selectedKey, newConversationPhone])

  const activeBroadcast = pane.kind === 'broadcast' ? broadcasts?.find((b) => b.id === pane.id) || null : null
  const isPaneOpen = pane.kind !== 'none' && (pane.kind !== 'thread' || activeThread !== null)

  // On mobile the pane is a full-screen overlay; keep the page behind it from scrolling
  const isOverlayOpen = !isDesktop && isPaneOpen
  useEffect(() => {
    if (!isOverlayOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOverlayOpen])

  const closePane = () => {
    setPane({ kind: 'none' })
    setIsPanelOpen(false)
  }

  const selectThread = (phoneKey: string) => {
    setPane({ kind: 'thread', phoneKey })
    setSendError(null)
    setIsPanelOpen(false)
    loadMessages(phoneKey)
  }

  // Open a guest's conversation, starting an empty one if they've never texted
  const openPhone = (phone: string) => {
    setNewConversationPhone(phone)
    setListView('conversations')
    selectThread(getPhoneKey(phone))
  }

  const openComposer = (request?: ComposeRequest) => {
    setPane({ kind: 'compose', request, id: Date.now() })
    setIsPanelOpen(false)
  }

  const openBroadcast = (id: string) => {
    setListView('broadcasts')
    setPane({ kind: 'broadcast', id })
    refreshBroadcasts()
  }

  const changeListView = (view: ListView) => {
    setListView(view)
    if (view === 'broadcasts') refreshBroadcasts()
  }

  const handleAssign = async (guest: FlatGuest) => {
    if (!activeThread) return
    const result = await assignPhoneToGuestAction(activeThread.phone, guest.id)
    if (result.success) router.refresh() // Reload guests so the new number matches this thread
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

  const renderPanel = (onClose?: () => void) =>
    activeThread && (
      <GuestPanel
        phone={activeThread.phone}
        guests={guestsByKey.get(activeThread.phoneKey) || []}
        allGuests={allGuests}
        onClose={onClose}
        onEditGuest={onEditGuest}
        onTextGuest={(guest) => guest.phoneNumber && openPhone(guest.phoneNumber)}
        onAssign={handleAssign}
      />
    )

  const renderPane = () => {
    if (pane.kind === 'compose') {
      return (
        <Composer
          key={pane.id}
          allGuests={allGuests}
          adminGuests={adminGuests}
          initialGuestIds={pane.request?.guestIds}
          initialLabel={pane.request?.label}
          onClose={closePane}
          onOpenConversation={openPhone}
          onOpenBroadcast={openBroadcast}
          onSent={() => {
            refreshThreads()
            refreshBroadcasts()
          }}
        />
      )
    }

    if (pane.kind === 'broadcast') {
      return activeBroadcast ? (
        <BroadcastView
          broadcast={activeBroadcast}
          guestsByKey={guestsByKey}
          onBack={closePane}
          onOpenConversation={openPhone}
          onChanged={() => {
            refreshBroadcasts()
            refreshThreads()
          }}
        />
      ) : null
    }

    if (activeThread) {
      return (
        <div className="flex h-full min-h-0">
          <div className="flex-1 min-w-0 h-full">
            <ThreadView
              thread={activeThread}
              guests={guestsByKey.get(activeThread.phoneKey) || []}
              messages={messagesByKey[activeThread.phoneKey]}
              draft={drafts[activeThread.phoneKey] || ''}
              onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [activeThread.phoneKey]: value }))}
              onSend={handleSend}
              isSending={sendingKey === activeThread.phoneKey}
              sendError={sendError}
              onBack={closePane}
              onDismiss={handleDismiss}
              headerActions={
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(true)}
                  aria-label="Guest details"
                  className="xl:hidden h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
                >
                  <Icon path={ICONS.info} />
                </button>
              }
            />
          </div>

          {/* Details: a column on wide screens, a slide-over otherwise */}
          <aside className="hidden xl:block w-80 shrink-0 border-l border-zinc-200/80 h-full">{renderPanel()}</aside>
          {isPanelOpen && (
            <div className="xl:hidden fixed inset-0 z-[70] flex justify-end">
              <button type="button" aria-label="Close details" onClick={() => setIsPanelOpen(false)} className="absolute inset-0 bg-black/30" />
              <div className="relative w-full max-w-sm h-full shadow-2xl animate-fade-in">{renderPanel(() => setIsPanelOpen(false))}</div>
            </div>
          )}
        </div>
      )
    }

    return null
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
          view={listView}
          onViewChange={changeListView}
          broadcastList={
            <BroadcastList broadcasts={broadcasts} selectedId={pane.kind === 'broadcast' ? pane.id : null} onSelect={openBroadcast} />
          }
          headerActions={
            <button
              type="button"
              onClick={() => openComposer()}
              className="flex items-center gap-1.5 rounded-full bg-sage px-3.5 py-2 text-xs font-karla font-semibold text-white hover:bg-black transition-colors cursor-pointer"
            >
              <Icon path={ICONS.compose} className="w-4 h-4" />
              New
            </button>
          }
        />
      </div>

      <section
        className={
          isPaneOpen
            ? 'fixed inset-x-0 top-0 h-[100dvh] z-[60] lg:static lg:h-auto lg:z-auto lg:min-h-0'
            : 'hidden lg:flex lg:items-center lg:justify-center lg:bg-zinc-50/70'
        }
      >
        {isPaneOpen ? renderPane() : <p className="text-sm font-karla text-zinc-400">Select a conversation</p>}
      </section>
    </div>
  )
}
