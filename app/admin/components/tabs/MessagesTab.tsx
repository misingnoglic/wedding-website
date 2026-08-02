'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { SmsMessageItem, FlatGuest } from '../../types'
import { formatPhoneNumber, doPhoneNumbersMatch, getComparablePhone } from '@/lib/phone'

interface MessagesTabProps {
  messages: SmsMessageItem[]
  allGuests: FlatGuest[]
}

type MessageFilter = 'all' | 'matched' | 'unknown'

interface ThreadMessage {
  id: string
  fromPhone: string
  toPhone?: string | null
  body: string
  createdAt: Date | string
  isOutgoing?: boolean
  messageSid?: string | null
  rawPayload?: string | null
}

interface MessageThread {
  phoneKey: string
  displayPhone: string
  rawPhone: string
  guest?: FlatGuest | null
  familyName?: string | null
  familyPassword?: string | null
  messages: ThreadMessage[]
  lastMessage: ThreadMessage
}

const QUICK_REPLIES = [
  'We can’t wait to celebrate with you in Cabo! 🥂',
  'Thanks for letting us know! Check out aryachristawedding.com/travel for hotel block info.',
  'Got your RSVP, thank you so much! 🎉',
  'Let us know if you have any dietary restrictions or travel questions!',
]

export default function MessagesTab({ messages, allGuests }: MessagesTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<MessageFilter>('all')
  const [selectedPhoneKey, setSelectedPhoneKey] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [mockOutgoingByPhone, setMockOutgoingByPhone] = useState<Record<string, ThreadMessage[]>>({})
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null)
  const [copiedWebhook, setCopiedWebhook] = useState(false)
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null)

  const chatStreamRef = useRef<HTMLDivElement>(null)

  // Webhook URL helper
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/twilio`
    : 'https://aryachristawedding.com/api/webhooks/twilio'

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2500)
  }

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone)
    setCopiedPhoneId(id)
    setTimeout(() => setCopiedPhoneId(null), 2000)
  }

  const formatRelativeTime = (dateInput: Date | string) => {
    const d = new Date(dateInput)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatMessageTime = (dateInput: Date | string) => {
    const d = new Date(dateInput)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatMessageDateGroup = (dateInput: Date | string) => {
    const d = new Date(dateInput)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  // Group all messages by sender into threads
  const threads = useMemo(() => {
    const threadMap = new Map<string, MessageThread>()

    // 1. Process DB incoming messages
    for (const msg of messages) {
      const phoneKey = getComparablePhone(msg.fromPhone) || msg.fromPhone.trim().toLowerCase()
      
      // Match guest from allGuests flat roster or relation
      const matchedGuest = allGuests.find((g) => doPhoneNumbersMatch(g.phoneNumber, msg.fromPhone)) || null
      const familyName = matchedGuest?.familyName || msg.guest?.family?.name || msg.family?.name || null
      const familyPassword = matchedGuest?.familyPassword || msg.guest?.family?.password || msg.family?.password || null

      const threadMsg: ThreadMessage = {
        id: msg.id,
        fromPhone: msg.fromPhone,
        toPhone: msg.toPhone,
        body: msg.body,
        createdAt: msg.createdAt,
        isOutgoing: false,
        messageSid: msg.messageSid,
        rawPayload: msg.rawPayload,
      }

      if (!threadMap.has(phoneKey)) {
        threadMap.set(phoneKey, {
          phoneKey,
          displayPhone: formatPhoneNumber(msg.fromPhone) || msg.fromPhone,
          rawPhone: msg.fromPhone,
          guest: matchedGuest,
          familyName,
          familyPassword,
          messages: [threadMsg],
          lastMessage: threadMsg,
        })
      } else {
        const existing = threadMap.get(phoneKey)!
        existing.messages.push(threadMsg)
        if (new Date(threadMsg.createdAt) > new Date(existing.lastMessage.createdAt)) {
          existing.lastMessage = threadMsg
        }
      }
    }

    // 2. Append mock outgoing messages to respective threads
    for (const [phoneKey, outMsgs] of Object.entries(mockOutgoingByPhone)) {
      if (threadMap.has(phoneKey)) {
        const existing = threadMap.get(phoneKey)!
        existing.messages.push(...outMsgs)
        // Sort messages chronologically
        existing.messages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        const latest = existing.messages[existing.messages.length - 1]
        if (latest) {
          existing.lastMessage = latest
        }
      } else if (outMsgs.length > 0) {
        // Mock thread created without incoming messages
        const first = outMsgs[0]
        const matchedGuest = allGuests.find((g) => doPhoneNumbersMatch(g.phoneNumber, first.toPhone)) || null
        threadMap.set(phoneKey, {
          phoneKey,
          displayPhone: formatPhoneNumber(first.toPhone) || first.toPhone || phoneKey,
          rawPhone: first.toPhone || phoneKey,
          guest: matchedGuest,
          familyName: matchedGuest?.familyName || null,
          familyPassword: matchedGuest?.familyPassword || null,
          messages: [...outMsgs].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
          lastMessage: outMsgs[outMsgs.length - 1],
        })
      }
    }

    // Convert map to array and sort threads by latest message timestamp descending
    const threadList = Array.from(threadMap.values()).map((t) => {
      // Sort internal messages chronologically
      t.messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      return t
    })

    threadList.sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    )

    return threadList
  }, [messages, allGuests, mockOutgoingByPhone])

  // Filtered threads based on search and category filter
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      // Category filter
      if (filter === 'matched' && !t.guest) return false
      if (filter === 'unknown' && t.guest) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchGuest = t.guest?.name.toLowerCase().includes(q) || false
        const matchFamily = t.familyName?.toLowerCase().includes(q) || false
        const matchPhone = t.rawPhone.toLowerCase().includes(q) || t.displayPhone.toLowerCase().includes(q)
        const matchAnyBody = t.messages.some((m) => m.body.toLowerCase().includes(q))

        if (!matchGuest && !matchFamily && !matchPhone && !matchAnyBody) {
          return false
        }
      }

      return true
    })
  }, [threads, filter, searchQuery])

  // Set default selected thread if none selected or current selection disappears
  useEffect(() => {
    if (threads.length > 0) {
      if (!selectedPhoneKey || !threads.some((t) => t.phoneKey === selectedPhoneKey)) {
        setSelectedPhoneKey(threads[0].phoneKey)
      }
    }
  }, [threads, selectedPhoneKey])

  // Selected thread object
  const activeThread = useMemo(() => {
    if (!selectedPhoneKey) return null
    return threads.find((t) => t.phoneKey === selectedPhoneKey) || null
  }, [threads, selectedPhoneKey])

  // Send mock outgoing message
  const handleSendMockMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!activeThread || !replyText.trim()) return

    const newMsg: ThreadMessage = {
      id: `mock_out_${Date.now()}`,
      fromPhone: 'Arya & Christa',
      toPhone: activeThread.rawPhone,
      body: replyText.trim(),
      createdAt: new Date().toISOString(),
      isOutgoing: true,
    }

    setMockOutgoingByPhone((prev) => ({
      ...prev,
      [activeThread.phoneKey]: [...(prev[activeThread.phoneKey] || []), newMsg],
    }))

    const recipientName = activeThread.guest?.name || activeThread.displayPhone
    setSendSuccessToast(`Simulated SMS sent to ${recipientName}`)
    setReplyText('')
    setTimeout(() => setSendSuccessToast(null), 3000)

    // Smoothly scroll only the internal chat stream box down without scrolling the page
    setTimeout(() => {
      if (chatStreamRef.current) {
        chatStreamRef.current.scrollTo({
          top: chatStreamRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, 50)
  }

  // Count stats
  const matchedThreadCount = useMemo(() => threads.filter((t) => Boolean(t.guest)).length, [threads])
  const unknownThreadCount = useMemo(() => threads.filter((t) => !t.guest).length, [threads])

  // Character and segment count
  const charCount = replyText.length
  const smsSegments = Math.ceil(charCount / 160) || 1

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-sans text-black">Twilio SMS Guest Inbox</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage/20 text-sage-dark border border-sage/30">
              {threads.length} {threads.length === 1 ? 'Conversation' : 'Conversations'} ({messages.length} SMS)
            </span>
          </div>
          <p className="text-xs font-karla text-zinc-500 mt-1">
            Grouped conversation threads by sender phone number. Match with wedding parties and test mock responses.
          </p>
        </div>

        {/* Webhook URL copy badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-sand/40 border border-sand-dark/20 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-karla">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-600 font-mono text-[11px]">/api/webhooks/twilio</span>
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="ml-1 text-xs font-sans text-sage hover:text-black font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {copiedWebhook ? '✓ Copied' : 'Copy URL'}
            </button>
          </div>
        </div>
      </div>

      {threads.length === 0 ? (
        /* Empty Database State with Configuration Instructions */
        <div className="p-8 md:p-12 text-center bg-sand/20 rounded-2xl border border-dashed border-sand-dark/40 space-y-4">
          <div className="w-12 h-12 rounded-full bg-sage/20 text-sage mx-auto flex items-center justify-center text-xl">
            💬
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-base font-sans font-semibold text-black">No text messages yet</h4>
            <p className="text-xs font-karla text-zinc-600 leading-relaxed">
              When a guest texts your Twilio phone number, a threaded conversation will appear here automatically.
            </p>
          </div>
          <div className="bg-white/80 border border-zinc-200 rounded-xl p-4 max-w-lg mx-auto text-left space-y-2">
            <div className="text-xs font-sans font-semibold text-zinc-700 uppercase tracking-wider">
              Twilio Webhook Configuration
            </div>
            <ol className="text-xs font-karla text-zinc-600 space-y-1 list-decimal list-inside">
              <li>Open your <strong>Twilio Console → Phone Numbers → Manage → Active Numbers</strong>.</li>
              <li>Click your phone number and navigate to <strong>&ldquo;A MESSAGE COMES IN&rdquo;</strong>.</li>
              <li>Set Webhook URL to: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-[11px] text-black">{webhookUrl}</code> (HTTP POST).</li>
              <li>Save changes and text your number to test!</li>
            </ol>
          </div>
        </div>
      ) : (
        /* Threaded Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[650px] sm:h-[720px] rounded-2xl border border-zinc-200/80 overflow-hidden bg-zinc-50/40">
          
          {/* Left Column: Conversation Thread Roster (4 cols on lg) */}
          <div className={`lg:col-span-4 flex flex-col border-r border-zinc-200/80 bg-white h-full ${
            activeThread ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Search and Filters */}
            <div className="p-3.5 border-b border-zinc-100 space-y-2.5 bg-white">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sender, phone, text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-karla placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-sage focus:border-sage transition-all"
                />
                <svg
                  className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1.5 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-[11px] font-karla">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center ${
                    filter === 'all'
                      ? 'bg-black text-white font-medium shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  All ({threads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('matched')}
                  className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center ${
                    filter === 'matched'
                      ? 'bg-black text-white font-medium shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  Guests ({matchedThreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unknown')}
                  className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center ${
                    filter === 'unknown'
                      ? 'bg-black text-white font-medium shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  Unknown ({unknownThreadCount})
                </button>
              </div>
            </div>

            {/* Conversation Item List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 no-scrollbar">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs font-karla">
                  No conversations match your search.
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = selectedPhoneKey === thread.phoneKey
                  const isMatched = Boolean(thread.guest)
                  const guestName = thread.guest?.name || 'Unknown Sender'
                  const initials = thread.guest
                    ? thread.guest.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : '📱'

                  return (
                    <button
                      key={thread.phoneKey}
                      type="button"
                      onClick={() => setSelectedPhoneKey(thread.phoneKey)}
                      className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer border-l-3 ${
                        isSelected
                          ? 'bg-sage/10 border-sage shadow-xs'
                          : 'hover:bg-zinc-50/80 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-sans font-semibold text-xs shrink-0 ${
                          isMatched
                            ? 'bg-sage text-white shadow-xs'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {initials}
                      </div>

                      {/* Info & Snippet */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-sans text-xs truncate ${isSelected ? 'font-bold text-black' : 'font-semibold text-zinc-900'}`}>
                            {guestName}
                          </span>
                          <span className="text-[10px] font-karla text-zinc-400 shrink-0">
                            {formatRelativeTime(thread.lastMessage.createdAt)}
                          </span>
                        </div>

                        {/* Subtitle: Phone + Party name */}
                        <div className="flex items-center gap-1.5 text-[11px] font-karla text-zinc-500 truncate">
                          <span>{thread.displayPhone}</span>
                          {thread.familyName && (
                            <>
                              <span className="text-zinc-300">•</span>
                              <span className="truncate text-stone-600 font-medium">{thread.familyName}</span>
                            </>
                          )}
                        </div>

                        {/* Last Message Preview */}
                        <p className={`text-xs font-karla truncate ${isSelected ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                          {thread.lastMessage.isOutgoing ? 'You: ' : ''}{thread.lastMessage.body}
                        </p>
                      </div>

                      {/* Message count badge */}
                      <div className="shrink-0 flex flex-col items-end justify-between self-stretch">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">
                          {thread.messages.length}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Thread & Mock Message Composer (8 cols on lg) */}
          <div className={`lg:col-span-8 flex flex-col h-full bg-stone-50/50 ${
            !activeThread ? 'hidden lg:flex items-center justify-center text-center p-8' : 'flex'
          }`}>
            {activeThread ? (
              <>
                {/* Active Thread Header */}
                <div className="px-4 py-3.5 bg-white border-b border-zinc-200/80 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPhoneKey(null)}
                      className="lg:hidden p-1.5 -ml-1 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors"
                      title="Back to conversations"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-sans font-semibold text-xs shrink-0 ${
                        activeThread.guest ? 'bg-sage text-white' : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {activeThread.guest
                        ? activeThread.guest.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : '📱'}
                    </div>

                    {/* Sender details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-sans font-semibold text-sm text-black truncate">
                          {activeThread.guest?.name || 'Unknown Sender'}
                        </h4>
                        {activeThread.guest ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Verified Guest
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Unlinked Number
                          </span>
                        )}
                        {activeThread.guest?.isAttendingWedding === true && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sage/20 text-sage-dark">
                            Attending Wedding
                          </span>
                        )}
                        {activeThread.guest?.isAttendingWedding === false && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800">
                            Declined
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-karla text-zinc-500">
                        <span className="font-mono">{activeThread.displayPhone}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(activeThread.phoneKey, activeThread.rawPhone)}
                          className="text-[11px] text-sage hover:text-black font-semibold hover:underline cursor-pointer"
                        >
                          {copiedPhoneId === activeThread.phoneKey ? '✓ Copied' : 'Copy'}
                        </button>
                        {activeThread.familyName && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="text-zinc-600">Party: <strong>{activeThread.familyName}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick info or password indicator */}
                  {activeThread.familyPassword && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-karla text-zinc-600 shrink-0">
                      <span className="text-zinc-400">Passcode:</span>
                      <strong className="font-mono text-black">{activeThread.familyPassword}</strong>
                    </div>
                  )}
                </div>

                {/* Toast alert for mock sending */}
                {sendSuccessToast && (
                  <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-karla flex items-center justify-between shadow-sm animate-fade-in">
                    <span className="flex items-center gap-1.5">
                      <span>✓</span>
                      <span>{sendSuccessToast}</span>
                    </span>
                    <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Simulated</span>
                  </div>
                )}

                {/* Messages Chat Stream */}
                <div ref={chatStreamRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
                  {/* Group messages by date */}
                  {(() => {
                    let lastDateStr = ''
                    return activeThread.messages.map((msg, idx) => {
                      const dateStr = formatMessageDateGroup(msg.createdAt)
                      const showDateHeader = dateStr !== lastDateStr
                      lastDateStr = dateStr

                      return (
                        <div key={msg.id} className="space-y-3">
                          {/* Date separator */}
                          {showDateHeader && (
                            <div className="flex items-center justify-center my-3">
                              <span className="px-3 py-1 rounded-full text-[10px] font-sans uppercase tracking-wider font-semibold bg-zinc-200/70 text-zinc-600">
                                {dateStr}
                              </span>
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div
                            className={`flex flex-col ${
                              msg.isOutgoing ? 'items-end' : 'items-start'
                            }`}
                          >
                            <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                              {/* Left Avatar for incoming */}
                              {!msg.isOutgoing && (
                                <div className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center text-[10px] font-sans font-bold shrink-0 mb-1">
                                  {activeThread.guest?.name?.[0] || '📱'}
                                </div>
                              )}

                              {/* Bubble */}
                              <div
                                className={`rounded-2xl px-4 py-2.5 shadow-2xs text-xs sm:text-sm font-karla leading-relaxed whitespace-pre-wrap ${
                                  msg.isOutgoing
                                    ? 'bg-sage text-white rounded-br-xs'
                                    : 'bg-white text-zinc-900 border border-zinc-200/80 rounded-bl-xs'
                                }`}
                              >
                                <p>{msg.body}</p>
                              </div>
                            </div>

                            {/* Timestamp & Status Subtitle */}
                            <div
                              className={`flex items-center gap-1.5 mt-1 text-[10px] font-karla text-zinc-400 ${
                                msg.isOutgoing ? 'mr-1' : 'ml-8'
                              }`}
                            >
                              <span>{formatMessageTime(msg.createdAt)}</span>
                              {msg.isOutgoing ? (
                                <>
                                  <span>•</span>
                                  <span className="text-sage font-medium">Delivered (Mock)</span>
                                </>
                              ) : (
                                msg.toPhone && (
                                  <>
                                    <span>•</span>
                                    <span>via Twilio</span>
                                  </>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>

                {/* Bottom Mock Reply Composer */}
                <div className="p-3.5 sm:p-4 bg-white border-t border-zinc-200/80 space-y-3">
                  {/* Quick suggested canned reply chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <span className="text-[11px] font-karla text-zinc-400 shrink-0">Quick replies:</span>
                    {QUICK_REPLIES.map((quick, qIdx) => (
                      <button
                        key={qIdx}
                        type="button"
                        onClick={() => setReplyText(quick)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-karla bg-zinc-100 hover:bg-sage/20 hover:text-black text-zinc-600 border border-zinc-200/70 transition-colors shrink-0 cursor-pointer"
                      >
                        {quick.length > 32 ? quick.slice(0, 32) + '...' : quick}
                      </button>
                    ))}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendMockMessage} className="space-y-2">
                    <div className="relative flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-2 focus-within:ring-1 focus-within:ring-sage focus-within:border-sage transition-all">
                      <textarea
                        rows={2}
                        placeholder={`Type a text message to ${activeThread.guest?.name || activeThread.displayPhone}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMockMessage()
                          }
                        }}
                        className="w-full bg-transparent text-xs sm:text-sm font-karla text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none px-2 py-1"
                      />

                      <div className="flex items-center gap-2 shrink-0 pb-1 pr-1">
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className={`px-4 py-2 rounded-xl text-xs font-sans uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            replyText.trim()
                              ? 'bg-sage text-white hover:bg-sage-dark shadow-xs'
                              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          }`}
                        >
                          <span>Send SMS</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Footer Info: Char count + Outbound status */}
                    <div className="flex items-center justify-between text-[11px] font-karla text-zinc-400 px-1">
                      <span className="flex items-center gap-1 text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>Mock Reply Box (Button adds message to thread preview)</span>
                      </span>
                      <span>
                        {charCount} / 160 chars ({smsSegments} {smsSegments === 1 ? 'SMS' : 'segments'})
                      </span>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-zinc-200 text-zinc-500 mx-auto flex items-center justify-center text-xl">
                  💬
                </div>
                <h4 className="text-base font-sans font-semibold text-black">Select a conversation</h4>
                <p className="text-xs font-karla text-zinc-500">
                  Choose a guest conversation thread from the left to read history and send messages.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
