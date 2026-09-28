'use client'

import { useEffect, useState } from 'react'
import type { BroadcastSummary } from '@/lib/broadcasts'
import { getBroadcastMessagesAction, retryBroadcastFailuresAction } from '@/app/actions/sms'
import { formatPhoneNumber } from '@/lib/phone'
import { isFailedStatus } from '@/lib/smsStatus'
import { FlatGuest } from '../../types'
import { Icon, ICONS, Spinner } from './ui'
import { contactName, formatListTime, statusLabel } from './utils'

type BroadcastMessage = Awaited<ReturnType<typeof getBroadcastMessagesAction>>[number]

function Counts({ counts }: { counts: BroadcastSummary['counts'] }) {
  return (
    <span className="text-[11px] font-karla text-zinc-500">
      {counts.delivered} delivered
      {counts.sent > 0 && ` · ${counts.sent} sent`}
      {counts.failed > 0 && <span className="text-red-600"> · {counts.failed} failed</span>}
    </span>
  )
}

export function BroadcastList({
  broadcasts,
  selectedId,
  onSelect,
}: {
  broadcasts: BroadcastSummary[] | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (!broadcasts) {
    return (
      <div className="py-16 flex justify-center text-zinc-400">
        <Spinner className="w-5 h-5" />
      </div>
    )
  }
  if (broadcasts.length === 0) {
    return <p className="px-6 py-16 text-center text-sm font-karla text-zinc-400">No group texts yet.</p>
  }
  return (
    <ul>
      {broadcasts.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => onSelect(b.id)}
            className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${selectedId === b.id ? 'bg-sage/15' : 'hover:bg-zinc-50'}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="flex-1 truncate text-sm font-sans text-black">{b.body}</span>
              <span className="shrink-0 text-[11px] font-karla text-zinc-400">{formatListTime(b.createdAt)}</span>
            </div>
            <div className="truncate text-[11px] font-karla text-zinc-400">
              {b.recipientCount} recipients · {b.audience}
            </div>
            <Counts counts={b.counts} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function BroadcastView({
  broadcast,
  guestsByKey,
  onBack,
  onOpenConversation,
  onChanged,
}: {
  broadcast: BroadcastSummary
  guestsByKey: Map<string, FlatGuest[]>
  onBack: () => void
  onOpenConversation: (phone: string) => void
  onChanged: () => void
}) {
  const [messages, setMessages] = useState<BroadcastMessage[] | null>(null)
  const [retryState, setRetryState] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getBroadcastMessagesAction(broadcast.id).then((result) => {
      if (!cancelled) setMessages(result)
    })
    return () => {
      cancelled = true
    }
  }, [broadcast.id, broadcast.counts])

  // Latest attempt per recipient (retries add rows)
  const latest = messages ? [...new Map(messages.map((m) => [m.phoneKey, m])).values()] : []
  const failedCount = latest.filter((m) => isFailedStatus(m.status)).length

  const retry = async () => {
    setRetryState('Retrying…')
    const { retried, failed } = await retryBroadcastFailuresAction(broadcast.id)
    setRetryState(retried === 0 ? 'Nothing to retry (opted-out numbers are skipped).' : `Resent ${retried}${failed ? `; ${failed} still failed` : ''}.`)
    onChanged()
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <header className="flex items-center gap-2 px-2 lg:px-4 py-2.5 border-b border-zinc-200/80 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} aria-label="Back" className="lg:hidden h-10 w-10 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100">
          <Icon path={ICONS.back} />
        </button>
        <div className="flex-1 min-w-0 lg:pl-2">
          <h3 className="truncate text-sm font-sans font-semibold text-black">Group text</h3>
          <p className="truncate text-xs font-karla text-zinc-500">
            {broadcast.sentByName} · {new Date(broadcast.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 py-5 space-y-5">
        <div className="rounded-2xl bg-zinc-50 p-4 space-y-2">
          <p className="whitespace-pre-wrap text-sm font-karla text-zinc-900">{broadcast.body}</p>
          <p className="text-xs font-karla text-zinc-500">{broadcast.audience}</p>
          <Counts counts={broadcast.counts} />
        </div>

        {failedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={retry} disabled={retryState === 'Retrying…'} className="rounded-full bg-black px-4 py-2 text-xs font-karla text-white cursor-pointer disabled:opacity-50">
              Retry failed
            </button>
            {retryState && <span className="text-xs font-karla text-zinc-500">{retryState}</span>}
          </div>
        )}

        {!messages ? (
          <div className="py-10 flex justify-center text-zinc-400">
            <Spinner className="w-5 h-5" />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {latest.map((m) => {
              const guests = guestsByKey.get(m.phoneKey) || []
              const phone = m.toPhone || m.phoneKey
              const failed = isFailedStatus(m.status)
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => onOpenConversation(phone)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-sans text-black">{contactName(guests, phone)}</div>
                      <div className="text-[11px] font-karla text-zinc-500">{formatPhoneNumber(phone) || phone}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-karla ${failed ? 'text-red-600' : 'text-zinc-500'}`}>
                      {statusLabel(m.status, m.errorCode) || 'Sent'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
