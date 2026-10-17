'use client'

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { InboxThread, ThreadMessage } from '@/lib/inbox'
import { formatPhoneNumber } from '@/lib/phone'
import { Reaction, ReactionVerb, resolveReactions, SENDABLE_REACTIONS } from '@/lib/smsReactions'
import { isFailedStatus } from '@/lib/smsStatus'
import { FlatGuest } from '../../types'
import ReplyBox from './ReplyBox'
import { Avatar, Icon, ICONS, Spinner } from './ui'
import { contactName, formatDateDivider, formatTime, statusLabel } from './utils'

interface ThreadViewProps {
  thread: InboxThread
  guests: FlatGuest[]
  messages: ThreadMessage[] | undefined
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  sendError: string | null
  onBack: () => void
  onDismiss: () => void
  onReact: (messageId: string, verb: ReactionVerb) => void
  reactingId: string | null // Message we're sending a reaction to
  headerActions?: React.ReactNode
}

const GROUP_GAP_MS = 5 * 60 * 1000

function ReactionBadges({ reactions, guestName, alignRight }: { reactions: Reaction[]; guestName: string; alignRight: boolean }) {
  return (
    <div className={`absolute -top-3 flex gap-0.5 ${alignRight ? '-right-2' : '-left-2'}`}>
      {reactions.map((r) => (
        <span
          key={r.messageId}
          title={`${r.direction === 'outbound' ? 'You' : guestName}: ${r.phrase}`}
          className={`rounded-full border bg-white px-1.5 py-0.5 text-xs leading-none shadow-sm ${
            r.direction === 'outbound' ? 'border-sage' : 'border-zinc-200'
          } ${r.emoji ? '' : 'font-karla text-[10px] text-zinc-600'}`}
        >
          {r.emoji ?? r.phrase}
        </span>
      ))}
    </div>
  )
}

export default function ThreadView({
  thread,
  guests,
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending,
  sendError,
  onBack,
  onDismiss,
  onReact,
  reactingId,
  headerActions,
}: ThreadViewProps) {
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const name = contactName(guests, thread.phone)
  const phone = formatPhoneNumber(thread.phone) || thread.phone
  const subtitle = guests.length > 0 ? `${guests[0].familyName} · ${phone}` : phone
  const lastMessageId = messages?.[messages.length - 1]?.id
  const guestName = guests.length === 1 ? guests[0].name.split(' ')[0] : name

  // Reaction texts show as badges on the message they quote rather than as their own bubbles
  const { byTarget, reactionIds } = useMemo(() => resolveReactions(messages ?? []), [messages])
  const visible = useMemo(() => (messages ?? []).filter((m) => !reactionIds.has(m.id)), [messages, reactionIds])

  // Jump to the newest message when opening a thread or when a new one arrives
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.phoneKey, lastMessageId])

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-2 lg:px-4 py-2.5 border-b border-zinc-200/80 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="lg:hidden h-10 w-10 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
        >
          <Icon path={ICONS.back} />
        </button>
        <Avatar name={name} known={guests.length > 0} size="sm" />
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-sans font-semibold text-black">{name}</h3>
          <p className="truncate text-xs font-karla text-zinc-500">{subtitle}</p>
        </div>
        {thread.needsReply && (
          <button
            type="button"
            onClick={onDismiss}
            title="Mark as handled without replying"
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-karla text-zinc-600 hover:border-sage hover:text-black transition-colors cursor-pointer"
          >
            <Icon path={ICONS.check} className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        )}
        {headerActions}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-zinc-50/70 px-3 lg:px-6 py-4">
        {!messages ? (
          <div className="h-full flex items-center justify-center text-zinc-400">
            <Spinner className="w-6 h-6" />
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-karla text-zinc-400">
            No messages yet
          </div>
        ) : (
          visible.map((msg, i) => {
            const prev = visible[i - 1]
            const next = visible[i + 1]
            const showDivider = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString()
            const endsGroup =
              !next ||
              next.direction !== msg.direction ||
              new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > GROUP_GAP_MS
            const outbound = msg.direction === 'outbound'
            const failed = outbound && isFailedStatus(msg.status)
            const status = outbound ? statusLabel(msg.status, msg.errorCode) : null
            const reactions = byTarget.get(msg.id) ?? []
            // One reaction per message from us, and only on guests' texts that were saved
            const canReact = !outbound && !msg.id.startsWith('pending-') && !reactions.some((r) => r.direction === 'outbound')
            const meta = [
              outbound && msg.sentByName,
              formatTime(msg.createdAt),
              msg.broadcastId && 'Broadcast',
              status,
            ].filter(Boolean)

            return (
              <Fragment key={msg.id}>
                {showDivider && (
                  <div className="my-4 text-center text-[11px] font-karla uppercase tracking-wider text-zinc-400">
                    {formatDateDivider(msg.createdAt)}
                  </div>
                )}
                <div
                  className={`group flex items-center gap-1.5 ${outbound ? 'justify-end' : 'justify-start'} ${endsGroup ? 'mb-3' : 'mb-0.5'} ${
                    reactions.length > 0 ? 'mt-4' : ''
                  }`}
                >
                  <div className={`max-w-[80%] lg:max-w-[65%] flex flex-col ${outbound ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`relative rounded-2xl px-3.5 py-2 text-[15px] leading-snug font-karla whitespace-pre-wrap break-words ${
                        failed
                          ? 'bg-red-50 text-red-900 border border-red-200'
                          : outbound
                            ? 'bg-sage text-white'
                            : 'bg-white text-zinc-900 border border-zinc-200/80'
                      } ${endsGroup ? (outbound ? 'rounded-br-md' : 'rounded-bl-md') : ''}`}
                    >
                      {msg.body}
                      {reactions.length > 0 && <ReactionBadges reactions={reactions} guestName={guestName} alignRight={!outbound} />}
                    </div>
                    {(endsGroup || failed) && (
                      <div className={`mt-1 px-1 text-[11px] font-karla ${failed ? 'text-red-600' : 'text-zinc-400'}`}>
                        {meta.join(' · ')}
                      </div>
                    )}
                  </div>
                  {canReact && (
                    <div className="relative shrink-0 self-start mt-1.5">
                      {reactingId === msg.id ? (
                        <Spinner className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                          aria-label="React"
                          className={`h-7 w-7 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 transition-opacity cursor-pointer ${
                            pickerFor === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-60'
                          }`}
                        >
                          <Icon path={ICONS.react} className="w-4 h-4" />
                        </button>
                      )}
                      {pickerFor === msg.id && (
                        <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-zinc-200 bg-white p-1 shadow-lg">
                          {SENDABLE_REACTIONS.map((r) => (
                            <button
                              key={r.verb}
                              type="button"
                              title={`${r.verb} (sends a 1-SMS text, about $0.01)`}
                              onClick={() => {
                                setPickerFor(null)
                                onReact(msg.id, r.verb)
                              }}
                              className="h-8 w-8 flex items-center justify-center rounded-full text-lg hover:bg-zinc-100 cursor-pointer"
                            >
                              {r.emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Fragment>
            )
          })
        )}
      </div>

      {sendError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-xs font-karla text-red-700 border-t border-red-100">
          <Icon path={ICONS.alert} className="w-4 h-4 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      <ReplyBox
        value={draft}
        onChange={onDraftChange}
        onSubmit={onSend}
        isSending={isSending}
        placeholder={`Text ${guestName}`}
      />
    </div>
  )
}
