'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createBroadcastAction,
  retryBroadcastFailuresAction,
  sendBroadcastBatchAction,
  sendSmsAction,
} from '@/app/actions/sms'
import { formatPhoneNumber } from '@/lib/phone'
import { findUnknownPlaceholders, groupRecipients, PLACEHOLDERS, Recipient, renderTemplate } from '@/lib/smsAudience'
import { getSegmentInfo } from '@/lib/smsText'
import { FlatGuest } from '../../types'
import AudienceBuilder from './AudienceBuilder'
import GuestSearch from './GuestSearch'
import { Icon, ICONS, Spinner } from './ui'
import { contactName } from './utils'

interface ComposerProps {
  allGuests: FlatGuest[]
  adminGuests: FlatGuest[] // Test messages go to one of these
  initialGuestIds?: string[]
  initialLabel?: string
  onClose: () => void
  onOpenConversation: (phone: string) => void
  onOpenBroadcast: (broadcastId: string) => void
  onSent: () => void
}

type Stage = 'edit' | 'review' | 'sending' | 'done'
type RecipientResult = { success: boolean; error?: string }

const BATCH_SIZE = 5
const CHIP_LIMIT = 12

export default function Composer({
  allGuests,
  adminGuests,
  initialGuestIds = [],
  initialLabel,
  onClose,
  onOpenConversation,
  onOpenBroadcast,
  onSent,
}: ComposerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialGuestIds)
  const [labels, setLabels] = useState<string[]>(initialLabel ? [initialLabel] : [])
  const [showBuilder, setShowBuilder] = useState(false)
  const [showAllChips, setShowAllChips] = useState(false)
  const [body, setBody] = useState('')
  const [previewIndex, setPreviewIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('edit')
  const [results, setResults] = useState<Record<string, RecipientResult>>({})
  const [broadcastId, setBroadcastId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testTargetId, setTestTargetId] = useState(adminGuests[0]?.id || '')
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [retryState, setRetryState] = useState<'idle' | 'retrying' | string>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedGuests = useMemo(() => {
    const byId = new Map(allGuests.map((g) => [g.id, g]))
    return selectedIds.map((id) => byId.get(id)).filter((g) => g !== undefined)
  }, [allGuests, selectedIds])
  const { recipients, withoutPhone } = useMemo(() => groupRecipients(selectedGuests), [selectedGuests])

  const previewRecipient = recipients[Math.min(previewIndex, recipients.length - 1)]
  const preview = previewRecipient ? renderTemplate(body, previewRecipient.guests) : body
  const segments = getSegmentInfo(preview)
  const unknownPlaceholders = findUnknownPlaceholders(body)
  const isBulk = recipients.length > 1
  const sentCount = Object.keys(results).length
  const failed = recipients.filter((r) => results[r.phoneKey] && !results[r.phoneKey].success)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 96), 240)}px`
  }, [body, stage])

  const addGuests = (guests: FlatGuest[], label?: string) => {
    setSelectedIds((prev) => [...prev, ...guests.map((g) => g.id).filter((id) => !prev.includes(id))])
    if (label) setLabels((prev) => (prev.includes(label) ? prev : [...prev, label]))
  }

  const removeRecipient = (recipient: Recipient<FlatGuest>) => {
    const ids = new Set(recipient.guests.map((g) => g.id))
    setSelectedIds((prev) => prev.filter((id) => !ids.has(id)))
  }

  const clearAll = () => {
    setSelectedIds([])
    setLabels([])
    setPreviewIndex(0)
  }

  const insertPlaceholder = (token: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const audienceLabel = () => {
    const pickedIndividually = labels.length === 0
    return pickedIndividually ? `${selectedGuests.length} selected guest${selectedGuests.length === 1 ? '' : 's'}` : labels.join(' + ')
  }

  const sendTest = async () => {
    const target = adminGuests.find((g) => g.id === testTargetId)
    if (!target?.phoneNumber || !previewRecipient) return
    setTestState('sending')
    const result = await sendSmsAction(target.phoneNumber, renderTemplate(body, previewRecipient.guests))
    setTestState(result.success ? 'sent' : 'failed')
    onSent()
  }

  const sendSingle = async () => {
    const recipient = recipients[0]
    setStage('sending')
    setError(null)
    const result = await sendSmsAction(recipient.phone, renderTemplate(body, recipient.guests))
    onSent()
    if (result.success) {
      onOpenConversation(recipient.phone)
    } else {
      setError(result.error)
      setStage('edit')
    }
  }

  const sendBulk = async () => {
    setStage('sending')
    setError(null)
    setResults({})
    try {
      const id = await createBroadcastAction(body, audienceLabel(), recipients.length)
      setBroadcastId(id)
      // Small batches keep each server call short and let progress update as we go
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE)
        const batchResults = await sendBroadcastBatchAction(
          id,
          batch.map((r) => r.guests.map((g) => g.id))
        )
        setResults((prev) => {
          const next = { ...prev }
          batch.forEach((r, j) => (next[r.phoneKey] = { success: batchResults[j].success, error: batchResults[j].error }))
          return next
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sending stopped unexpectedly')
    }
    setStage('done')
    onSent()
  }

  const retryFailed = async () => {
    if (!broadcastId) return
    setRetryState('retrying')
    const { retried, failed: stillFailed } = await retryBroadcastFailuresAction(broadcastId)
    setRetryState(stillFailed === 0 ? `Resent ${retried}.` : `Resent ${retried}; ${stillFailed} still failed.`)
    onSent()
  }

  const title = stage === 'review' ? 'Review' : stage === 'sending' ? 'Sending' : stage === 'done' ? 'Sent' : 'New message'

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <header className="flex items-center gap-2 px-2 lg:px-4 py-2.5 border-b border-zinc-200/80 pt-[max(0.625rem,env(safe-area-inset-top))]">
        {stage === 'review' ? (
          <button type="button" onClick={() => setStage('edit')} aria-label="Back to editing" className="h-10 w-10 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100">
            <Icon path={ICONS.back} />
          </button>
        ) : (
          <button type="button" onClick={onClose} disabled={stage === 'sending'} aria-label="Close" className="h-10 w-10 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
            <Icon path={ICONS.close} />
          </button>
        )}
        <h3 className="flex-1 text-sm font-sans font-semibold text-black">{title}</h3>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {stage === 'edit' && (
          <div className="px-4 lg:px-6 py-5 space-y-6">
            {/* Recipients */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h4 className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">To</h4>
                {selectedGuests.length > 0 && (
                  <button type="button" onClick={clearAll} className="text-xs font-karla text-zinc-500 hover:text-black cursor-pointer">
                    Clear all
                  </button>
                )}
              </div>

              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(showAllChips ? recipients : recipients.slice(0, CHIP_LIMIT)).map((r) => (
                    <span key={r.phoneKey} className="inline-flex items-center gap-1 rounded-full bg-sage/15 pl-3 pr-1 py-1 text-xs font-karla text-zinc-800">
                      {contactName(r.guests, r.phone)}
                      <button type="button" onClick={() => removeRecipient(r)} aria-label={`Remove ${contactName(r.guests, r.phone)}`} className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-black/10 cursor-pointer">
                        <Icon path={ICONS.close} className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {!showAllChips && recipients.length > CHIP_LIMIT && (
                    <button type="button" onClick={() => setShowAllChips(true)} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-karla text-zinc-600 hover:bg-zinc-200 cursor-pointer">
                      +{recipients.length - CHIP_LIMIT} more
                    </button>
                  )}
                </div>
              )}

              {selectedGuests.length > 0 && (
                <p className="text-xs font-karla text-zinc-500">
                  {selectedGuests.length} guest{selectedGuests.length === 1 ? '' : 's'} · {recipients.length} text
                  {recipients.length === 1 ? '' : 's'}
                  {selectedGuests.length - withoutPhone.length > recipients.length && ' (shared phones get one text)'}
                </p>
              )}

              {withoutPhone.length > 0 && (
                <details className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-karla text-amber-900">
                    {withoutPhone.length} selected guest{withoutPhone.length === 1 ? ' has' : 's have'} no phone number and will be skipped
                  </summary>
                  <p className="mt-1 text-xs font-karla text-amber-800">{withoutPhone.map((g) => g.name).join(', ')}</p>
                </details>
              )}

              <GuestSearch
                guests={allGuests}
                placeholder="Add a guest or family"
                autoFocus={initialGuestIds.length === 0}
                isPicked={(g) => selectedIds.includes(g.id)}
                onPick={(g) => addGuests([g])}
                onPickFamily={(guests) => addGuests(guests)}
              />

              <button
                type="button"
                onClick={() => setShowBuilder((v) => !v)}
                className="text-xs font-karla font-semibold text-sage hover:text-black cursor-pointer"
              >
                {showBuilder ? 'Hide groups' : '+ Add a group (RSVP, hotel, login…)'}
              </button>
              {showBuilder && (
                <AudienceBuilder
                  guests={allGuests}
                  onAdd={(guests, label) => {
                    addGuests(guests, label)
                    setShowBuilder(false)
                  }}
                />
              )}
            </section>

            {/* Message */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">Message</h4>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi {firstName}! …"
                className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base leading-snug font-karla text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-sage focus:bg-white"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-karla text-zinc-400">Insert:</span>
                {PLACEHOLDERS.map((p) => (
                  <button key={p.token} type="button" title={p.description} onClick={() => insertPlaceholder(p.token)} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-mono text-zinc-600 hover:border-sage hover:text-black cursor-pointer">
                    {p.token}
                  </button>
                ))}
              </div>
              {unknownPlaceholders.length > 0 && (
                <p className="text-xs font-karla text-amber-700">
                  {unknownPlaceholders.join(', ')} won&apos;t be filled in. Check the spelling.
                </p>
              )}
              {body && (
                <p className="text-[11px] font-karla text-zinc-400">
                  {segments.segments} SMS per text{isBulk && ` · about ${segments.segments * recipients.length} total`}
                  {segments.isUnicode && ' · emoji or special characters use 70 characters per SMS'}
                </p>
              )}
            </section>

            {/* Preview */}
            {body && previewRecipient && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
                    Preview for {contactName(previewRecipient.guests, previewRecipient.phone)}
                  </h4>
                  {isBulk && (
                    <div className="flex items-center gap-1 text-[11px] font-karla text-zinc-500">
                      <button type="button" aria-label="Previous recipient" onClick={() => setPreviewIndex((i) => (i - 1 + recipients.length) % recipients.length)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-zinc-100">
                        <Icon path={ICONS.back} className="w-3.5 h-3.5" />
                      </button>
                      {Math.min(previewIndex, recipients.length - 1) + 1} / {recipients.length}
                      <button type="button" aria-label="Next recipient" onClick={() => setPreviewIndex((i) => (i + 1) % recipients.length)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-zinc-100">
                        <Icon path={ICONS.back} className="w-3.5 h-3.5 rotate-180" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-sage px-3.5 py-2 text-[15px] leading-snug font-karla text-white whitespace-pre-wrap break-words">
                    {preview}
                  </div>
                </div>
                {adminGuests.some((g) => g.phoneNumber) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs font-karla text-zinc-600">
                    <span>Send a test to</span>
                    <select value={testTargetId} onChange={(e) => setTestTargetId(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-base lg:text-xs">
                      {adminGuests.filter((g) => g.phoneNumber).map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={sendTest} disabled={testState === 'sending'} className="rounded-full border border-zinc-200 px-3 py-1 hover:border-sage hover:text-black cursor-pointer disabled:opacity-50">
                      {testState === 'sending' ? 'Sending…' : 'Send test'}
                    </button>
                    {testState === 'sent' && <span className="text-sage">Test sent</span>}
                    {testState === 'failed' && <span className="text-red-600">Test failed</span>}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {stage !== 'edit' && (
          <div className="px-4 lg:px-6 py-5 space-y-4">
            {stage === 'review' && (
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm font-karla text-zinc-700">
                <strong className="font-sans text-black">{recipients.length} people</strong> will each get their own text. Replies
                go to their individual conversations.
                <div className="mt-1 text-xs text-zinc-500">{audienceLabel()}</div>
              </div>
            )}

            {(stage === 'sending' || stage === 'done') && isBulk && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-karla text-zinc-600">
                  <span>
                    {stage === 'done' ? 'Finished' : 'Sending'} · {sentCount} / {recipients.length}
                  </span>
                  {failed.length > 0 && <span className="text-red-600">{failed.length} failed</span>}
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full bg-sage transition-all" style={{ width: `${(sentCount / Math.max(recipients.length, 1)) * 100}%` }} />
                </div>
              </div>
            )}

            {stage === 'sending' && !isBulk && (
              <div className="flex items-center gap-2 text-sm font-karla text-zinc-500">
                <Spinner /> Sending…
              </div>
            )}

            {error && <p className="text-sm font-karla text-red-600">{error}</p>}

            {stage === 'done' && (
              <div className="flex flex-wrap gap-2">
                {failed.length > 0 && broadcastId && (
                  <button type="button" onClick={retryFailed} disabled={retryState === 'retrying'} className="rounded-full bg-black px-4 py-2 text-xs font-karla text-white cursor-pointer disabled:opacity-50">
                    {retryState === 'retrying' ? 'Retrying…' : `Retry ${failed.length} failed`}
                  </button>
                )}
                {broadcastId && (
                  <button type="button" onClick={() => onOpenBroadcast(broadcastId)} className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-karla text-zinc-700 hover:border-sage cursor-pointer">
                    View delivery status
                  </button>
                )}
                {retryState !== 'idle' && retryState !== 'retrying' && <span className="self-center text-xs font-karla text-zinc-500">{retryState}</span>}
              </div>
            )}

            {isBulk && (
              <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                {recipients.map((r) => {
                  const result = results[r.phoneKey]
                  const declined = r.guests.some((g) => g.isAttendingWedding === false)
                  return (
                    <li key={r.phoneKey} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-sans text-black">{contactName(r.guests, r.phone)}</span>
                            {declined && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-karla text-red-700">Declined</span>}
                          </div>
                          <div className="text-[11px] font-karla text-zinc-500">
                            {r.guests[0].familyName} · {formatPhoneNumber(r.phone) || r.phone}
                          </div>
                        </div>
                        {stage === 'review' && (
                          <button type="button" onClick={() => removeRecipient(r)} className="shrink-0 text-xs font-karla text-zinc-400 hover:text-red-600 cursor-pointer">
                            Remove
                          </button>
                        )}
                        {stage !== 'review' &&
                          (result ? (
                            result.success ? (
                              <Icon path={ICONS.check} className="w-4 h-4 text-sage shrink-0" />
                            ) : (
                              <span className="shrink-0 text-[11px] font-karla text-red-600">Failed</span>
                            )
                          ) : (
                            <Spinner className="w-3.5 h-3.5 text-zinc-300" />
                          ))}
                      </div>
                      {stage === 'review' && (
                        <details className="mt-1">
                          <summary className="cursor-pointer truncate text-xs font-karla text-zinc-500">
                            {renderTemplate(body, r.guests)}
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap text-xs font-karla text-zinc-700">{renderTemplate(body, r.guests)}</p>
                        </details>
                      )}
                      {result && !result.success && result.error && (
                        <p className="mt-1 text-[11px] font-karla text-red-600">{result.error}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      {(stage === 'edit' || stage === 'review') && (
        <div className="border-t border-zinc-200/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {stage === 'edit' && error && <p className="mb-2 text-xs font-karla text-red-600">{error}</p>}
          <button
            type="button"
            disabled={recipients.length === 0 || !body.trim()}
            onClick={() => (stage === 'review' ? sendBulk() : isBulk ? setStage('review') : sendSingle())}
            className="w-full rounded-full bg-sage py-3 text-sm font-sans font-semibold text-white hover:bg-black disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors cursor-pointer"
          >
            {recipients.length === 0
              ? 'Add recipients'
              : !body.trim()
                ? 'Write a message'
                : stage === 'review'
                  ? `Send ${recipients.length} texts`
                  : isBulk
                    ? `Review ${recipients.length} texts`
                    : `Send to ${contactName(recipients[0].guests, recipients[0].phone)}`}
          </button>
        </div>
      )}
      {stage === 'done' && (
        <div className="border-t border-zinc-200/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-black py-3 text-sm font-sans font-semibold text-white cursor-pointer">
            Done
          </button>
        </div>
      )}
    </div>
  )
}
