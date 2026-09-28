'use client'

import type { InboxThread } from '@/lib/inbox'
import { isFailedStatus } from '@/lib/smsStatus'
import { FlatGuest } from '../../types'
import { Avatar, Icon, ICONS } from './ui'
import { contactName, formatListTime } from './utils'

export type ThreadFilter = 'all' | 'needsReply' | 'unread' | 'unknown'
export type ListView = 'conversations' | 'broadcasts'

interface ThreadListProps {
  threads: InboxThread[]
  guestsByKey: Map<string, FlatGuest[]>
  selectedKey: string | null
  onSelect: (phoneKey: string) => void
  filter: ThreadFilter
  onFilterChange: (filter: ThreadFilter) => void
  counts: Record<ThreadFilter, number>
  search: string
  onSearchChange: (search: string) => void
  onOpenMenu: () => void
  headerActions?: React.ReactNode
  view: ListView
  onViewChange: (view: ListView) => void
  broadcastList: React.ReactNode
}

const FILTERS: { id: ThreadFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needsReply', label: 'Needs reply' },
  { id: 'unread', label: 'Unread' },
  { id: 'unknown', label: 'Unknown' },
]

function ConversationRow({
  thread,
  guests,
  isSelected,
  onSelect,
}: {
  thread: InboxThread
  guests: FlatGuest[]
  isSelected: boolean
  onSelect: () => void
}) {
  const name = contactName(guests, thread.phone)
  const isUnread = thread.unreadCount > 0
  const { lastMessage } = thread
  const failed = lastMessage.direction === 'outbound' && isFailedStatus(lastMessage.status)
  const subtitle = guests.length > 0 ? guests[0].familyName : 'Unknown number'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
        isSelected ? 'bg-sage/15' : 'hover:bg-zinc-50'
      }`}
    >
      <Avatar name={name} known={guests.length > 0} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`flex-1 truncate text-sm font-sans ${isUnread ? 'font-bold text-black' : 'text-zinc-900'}`}>{name}</span>
          <span className={`shrink-0 text-[11px] font-karla ${isUnread ? 'text-sage font-semibold' : 'text-zinc-400'}`}>
            {formatListTime(lastMessage.createdAt)}
          </span>
        </div>
        <div className="text-[11px] font-karla text-zinc-400 truncate">{subtitle}</div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={`flex-1 truncate text-[13px] font-karla ${isUnread ? 'text-zinc-800' : 'text-zinc-500'}`}>
            {failed && <span className="text-red-600">Failed · </span>}
            {lastMessage.direction === 'outbound' && 'You: '}
            {lastMessage.body}
          </p>
          {thread.needsReply && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-karla font-semibold text-amber-800">
              Reply
            </span>
          )}
          {isUnread && <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-sage" aria-label="Unread" />}
        </div>
      </div>
    </button>
  )
}

export default function ThreadList({
  threads,
  guestsByKey,
  selectedKey,
  onSelect,
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  onOpenMenu,
  headerActions,
  view,
  onViewChange,
  broadcastList,
}: ThreadListProps) {
  return (
    <div className="flex flex-col min-h-0 lg:h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 pt-4 pb-3 space-y-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open admin menu"
            className="lg:hidden -ml-2 h-10 w-10 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
          >
            <Icon path={ICONS.menu} />
          </button>
          <h2 className="flex-1 text-xl font-sans tracking-wide text-black">Messages</h2>
          {headerActions}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-karla">
          {(['conversations', 'broadcasts'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={`rounded-lg py-1.5 transition-colors cursor-pointer ${
                view === id ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-black'
              }`}
            >
              {id === 'conversations' ? 'Conversations' : 'Group texts'}
            </button>
          ))}
        </div>

        {view === 'conversations' && (
          <>
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Icon path={ICONS.search} className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search name, family, or number"
                className="w-full rounded-xl bg-zinc-100 pl-9 pr-3 py-2 text-base lg:text-sm font-karla placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
            </label>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
              {FILTERS.map(({ id, label }) => {
                const active = filter === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onFilterChange(id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-karla transition-colors cursor-pointer ${
                      active ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {label}
                    {id !== 'all' && counts[id] > 0 && (
                      <span className={`ml-1.5 ${active ? 'text-white/70' : 'text-zinc-400'}`}>{counts[id]}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 lg:overflow-y-auto">
        {view === 'broadcasts' ? (
          broadcastList
        ) : threads.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm font-karla text-zinc-400">
            {search || filter !== 'all' ? 'No conversations match.' : 'No texts yet.'}
          </p>
        ) : (
          <ul>
            {threads.map((thread) => (
              <li key={thread.phoneKey}>
                <ConversationRow
                  thread={thread}
                  guests={guestsByKey.get(thread.phoneKey) || []}
                  isSelected={selectedKey === thread.phoneKey}
                  onSelect={() => onSelect(thread.phoneKey)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
