'use client'

import { useState, useMemo } from 'react'
import { SmsMessageItem, FlatGuest } from '../../types'
import { formatPhoneNumber, doPhoneNumbersMatch } from '@/lib/phone'

interface MessagesTabProps {
  messages: SmsMessageItem[]
  allGuests: FlatGuest[]
}

type MessageFilter = 'all' | 'matched' | 'unknown'

export default function MessagesTab({ messages, allGuests }: MessagesTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<MessageFilter>('all')
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

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
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Enrich messages with dynamic best-effort guest match if not pre-linked in DB
  const enrichedMessages = useMemo(() => {
    return messages.map((msg) => {
      let resolvedGuest = msg.guest
      let resolvedFamilyName = msg.guest?.family?.name || msg.family?.name || null

      if (!resolvedGuest) {
        const found = allGuests.find((g) => doPhoneNumbersMatch(g.phoneNumber, msg.fromPhone))
        if (found) {
          resolvedGuest = {
            id: found.id,
            name: found.name,
            phoneNumber: found.phoneNumber,
            family: {
              id: found.familyId,
              name: found.familyName,
              password: found.familyPassword,
            },
          }
          resolvedFamilyName = found.familyName
        }
      }

      return {
        ...msg,
        resolvedGuest,
        resolvedFamilyName,
        isMatched: Boolean(resolvedGuest),
      }
    })
  }, [messages, allGuests])

  const matchedCount = useMemo(
    () => enrichedMessages.filter((m) => m.isMatched).length,
    [enrichedMessages]
  )
  const unknownCount = useMemo(
    () => enrichedMessages.filter((m) => !m.isMatched).length,
    [enrichedMessages]
  )

  // Filter and search
  const filteredMessages = useMemo(() => {
    return enrichedMessages.filter((m) => {
      // 1. Category Filter
      if (filter === 'matched' && !m.isMatched) return false
      if (filter === 'unknown' && m.isMatched) return false

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchBody = m.body.toLowerCase().includes(q)
        const matchFrom = m.fromPhone.toLowerCase().includes(q)
        const matchFormatted = formatPhoneNumber(m.fromPhone).toLowerCase().includes(q)
        const matchGuest = m.resolvedGuest?.name.toLowerCase().includes(q) || false
        const matchFamily = m.resolvedFamilyName?.toLowerCase().includes(q) || false

        if (!matchBody && !matchFrom && !matchFormatted && !matchGuest && !matchFamily) {
          return false
        }
      }

      return true
    })
  }, [enrichedMessages, filter, searchQuery])

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-sans text-black">Twilio SMS Inbox</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage/20 text-sage-dark border border-sage/30">
              {messages.length} Total
            </span>
          </div>
          <p className="text-xs font-karla text-zinc-500 mt-1">
            Real-time incoming text messages from guests routed through your Twilio webhook.
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by sender, party, phone, or message text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-karla placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-sage focus:border-sage transition-all"
          />
          <svg
            className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs font-karla overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            All ({enrichedMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('matched')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'matched'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Matched Guests ({matchedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unknown')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'unknown'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Unknown Senders ({unknownCount})
          </button>
        </div>
      </div>

      {/* Messages List / Stream */}
      {filteredMessages.length === 0 ? (
        messages.length === 0 ? (
          /* Empty Database State with Configuration Instructions */
          <div className="p-8 md:p-12 text-center bg-sand/20 rounded-2xl border border-dashed border-sand-dark/40 space-y-4">
            <div className="w-12 h-12 rounded-full bg-sage/20 text-sage mx-auto flex items-center justify-center text-xl">
              💬
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-base font-sans font-semibold text-black">No text messages yet</h4>
              <p className="text-xs font-karla text-zinc-600 leading-relaxed">
                When someone texts your Twilio phone number, messages will appear here instantly and match
                with registered wedding guests.
              </p>
            </div>
            <div className="bg-white/80 border border-zinc-200 rounded-xl p-4 max-w-lg mx-auto text-left space-y-2">
              <div className="text-xs font-sans font-semibold text-zinc-700 uppercase tracking-wider">
                Twilio Console Setup
              </div>
              <ol className="text-xs font-karla text-zinc-600 space-y-1 list-decimal list-inside">
                <li>Go to your <strong>Twilio Console → Phone Numbers → Manage → Active Numbers</strong>.</li>
                <li>Click your number and scroll down to <strong>&ldquo;A MESSAGE COMES IN&rdquo;</strong>.</li>
                <li>Set Webhook URL to: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-[11px] text-black">{webhookUrl}</code> (HTTP POST).</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
        ) : (
          /* Empty Filter State */
          <div className="py-12 text-center text-zinc-400 text-xs font-karla">
            No text messages match your current search or filter.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => {
            const formattedPhone = formatPhoneNumber(msg.fromPhone) || msg.fromPhone
            const isCopied = copiedPhoneId === msg.id

            return (
              <div
                key={msg.id}
                className={`p-5 rounded-2xl border transition-all ${
                  msg.isMatched
                    ? 'bg-emerald-50/20 hover:bg-emerald-50/35 border-emerald-200/60'
                    : 'bg-zinc-50/70 hover:bg-zinc-50 border-zinc-200/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Sender Details */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-sans font-semibold text-sm shrink-0 ${
                        msg.isMatched
                          ? 'bg-sage text-white shadow-xs'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {msg.resolvedGuest
                        ? msg.resolvedGuest.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : '📱'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {msg.resolvedGuest ? (
                          <>
                            <span className="font-sans font-semibold text-black text-sm">
                              {msg.resolvedGuest.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ Verified Guest
                            </span>
                            {msg.resolvedFamilyName && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sand text-stone-800">
                                Party: {msg.resolvedFamilyName}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-sans font-semibold text-zinc-700 text-sm">
                              Unknown Sender
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Unlinked Number
                            </span>
                          </>
                        )}
                      </div>

                      {/* Phone number and copy button */}
                      <div className="flex items-center gap-2 text-xs font-karla text-zinc-500">
                        <span className="font-mono">{formattedPhone}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(msg.id, msg.fromPhone)}
                          className="text-[11px] text-sage hover:text-black font-semibold hover:underline cursor-pointer transition-colors"
                        >
                          {isCopied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs font-karla text-zinc-400 shrink-0 sm:text-right">
                    <span title={new Date(msg.createdAt).toLocaleString()}>
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Message Body Content */}
                <div className="mt-3 sm:ml-13">
                  <div className="bg-white rounded-xl p-3.5 border border-zinc-200/70 shadow-xs text-sm font-karla text-zinc-900 leading-relaxed whitespace-pre-wrap">
                    {msg.body}
                  </div>

                  {/* Footer details */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-karla text-zinc-400">
                    {msg.toPhone && (
                      <span>To: <strong className="font-mono text-zinc-500">{formatPhoneNumber(msg.toPhone)}</strong></span>
                    )}
                    {msg.messageSid && (
                      <span>SID: <strong className="font-mono text-zinc-500">{msg.messageSid.slice(0, 10)}...</strong></span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
