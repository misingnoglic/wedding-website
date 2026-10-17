'use client'

import { useEffect, useState } from 'react'
import type { BroadcastSummary } from '@/lib/broadcasts'
import type { TwilioStats } from '@/lib/sms'
import { getBroadcastMessagesAction, retryBroadcastFailuresAction } from '@/app/actions/sms'
import { formatPhoneNumber } from '@/lib/phone'
import { describeSmsError, isAccountError, isFailedStatus, isQueuedStatus, isRetryableError } from '@/lib/smsStatus'
import { formatUsd, getSegmentInfo, LOW_BALANCE_USD } from '@/lib/smsText'
import { FlatGuest } from '../../types'
import { Icon, ICONS, Spinner } from './ui'
import { contactName, formatListTime, retrySummary, statusLabel } from './utils'

type BroadcastMessage = Awaited<ReturnType<typeof getBroadcastMessagesAction>>[number]

// Roughly what our number pushes through Twilio's queue (Oct 2026: 960 SMS took ~15 minutes)
const SMS_PER_MINUTE = 60

function Counts({ counts }: { counts: BroadcastSummary['counts'] }) {
  return (
    <span className="text-[11px] font-karla text-zinc-500">
      {counts.delivered} delivered
      {counts.queued > 0 && ` · ${counts.queued} still sending`}
      {counts.sent > 0 && ` · ${counts.sent} sent`}
      {counts.failed > 0 && <span className="text-red-600"> · {counts.failed} failed</span>}
    </span>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`truncate text-sm font-sans font-semibold ${warn ? 'text-red-700' : 'text-black'}`}>{value}</div>
      <div className="truncate text-[10px] font-karla uppercase tracking-wider text-zinc-400">{label}</div>
    </div>
  )
}

/**
 * Balance and spend at a glance. Undefined while loading; null when Twilio couldn't be reached.
 */
function TwilioStatsCard({ stats }: { stats: TwilioStats | null | undefined }) {
  if (stats === undefined) return null
  if (stats === null) {
    return (
      <p className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-karla text-red-800">
        Couldn&apos;t reach Twilio. The account may be suspended or out of funds. Check the Twilio console.
      </p>
    )
  }
  const isLow = stats.balance < LOW_BALANCE_USD
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-zinc-50 p-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Balance" value={formatUsd(stats.balance)} warn={isLow} />
        <Stat label="Today" value={formatUsd(stats.todaySpend)} />
        <Stat label="This month" value={formatUsd(stats.monthSpend)} />
        <Stat label="SMS this month" value={stats.monthSegments.toLocaleString()} />
      </div>
      {isLow && (
        <p className="text-xs font-karla text-red-700">Low balance. Top up in the Twilio console before the next group text.</p>
      )}
    </div>
  )
}

export function BroadcastList({
  broadcasts,
  stats,
  selectedId,
  onSelect,
}: {
  broadcasts: BroadcastSummary[] | null
  stats: TwilioStats | null | undefined
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <TwilioStatsCard stats={stats} />
      <BroadcastItems broadcasts={broadcasts} selectedId={selectedId} onSelect={onSelect} />
    </>
  )
}

function BroadcastItems({
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
    <ul className="mt-2">
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
  const failedLatest = latest.filter((m) => isFailedStatus(m.status))
  const retryableCount = failedLatest.filter((m) => isRetryableError(m.errorCode)).length
  const unretryableCount = failedLatest.length - retryableCount
  const accountFailure = failedLatest.find((m) => isAccountError(m.errorCode))
  const queued = latest.filter((m) => isQueuedStatus(m.status))
  const queuedMinutes = Math.ceil(queued.reduce((sum, m) => sum + getSegmentInfo(m.body).segments, 0) / SMS_PER_MINUTE)

  const retry = async () => {
    setRetryState('Retrying…')
    setRetryState(retrySummary(await retryBroadcastFailuresAction(broadcast.id)))
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

        {queued.length > 0 && (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-xs font-karla text-zinc-600">
            {queued.length} {queued.length === 1 ? 'text is' : 'texts are'} still waiting in Twilio&apos;s queue, about{' '}
            {queuedMinutes} min left. Twilio sends about {SMS_PER_MINUTE} SMS a minute, so long group texts take a while. Nothing&apos;s wrong.
          </p>
        )}

        {accountFailure && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-karla text-red-900">
            <strong className="font-sans">Some texts failed because of our Twilio account: {describeSmsError(accountFailure.errorCode)}.</strong>{' '}
            Fix it in the Twilio console, then retry.
          </div>
        )}

        {failedLatest.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {retryableCount > 0 && (
              <button type="button" onClick={retry} disabled={retryState === 'Retrying…'} className="rounded-full bg-black px-4 py-2 text-xs font-karla text-white cursor-pointer disabled:opacity-50">
                Retry {retryableCount} failed
              </button>
            )}
            {retryState ? (
              <span className="text-xs font-karla text-zinc-500">{retryState}</span>
            ) : (
              unretryableCount > 0 && (
                <span className="text-xs font-karla text-zinc-500">
                  {unretryableCount} won&apos;t be retried since {unretryableCount === 1 ? 'it' : 'they'} would fail again (reasons below)
                </span>
              )
            )}
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
