'use client'

import { useState, useMemo } from 'react'
import { AuditEventItem, ActivityFilter } from '../../types'

interface ActivityLogTabProps {
  auditEvents: AuditEventItem[]
}

interface GroupedSession {
  key: string
  familyId: string | null
  actorName: string
  actorType: string
  firstCreatedAt: Date
  lastCreatedAt: Date
  events: AuditEventItem[]
  isRsvpSession: boolean
}

export default function ActivityLogTab({ auditEvents }: ActivityLogTabProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  // Filter events based on active category
  const filteredEvents = useMemo(() => {
    return auditEvents.filter((ev) => {
      if (activityFilter === 'all') return true
      if (activityFilter === 'visits') return ev.eventType === 'WEBSITE_VISIT'
      if (activityFilter === 'rsvps') return ev.eventType === 'RSVP_UPDATED'
      if (activityFilter === 'management') {
        return [
          'FAMILY_CREATED',
          'FAMILY_UPDATED',
          'FAMILY_DELETED',
          'GUEST_ADDED',
          'GUEST_UPDATED',
          'GUEST_DELETED',
          'ADMIN_IMPERSONATION',
        ].includes(ev.eventType)
      }
      if (activityFilter === 'auth') {
        return ['GUEST_LOGIN', 'PASSWORD_RESET'].includes(ev.eventType)
      }
      return true
    })
  }, [auditEvents, activityFilter])

  // Group consecutive events from the same family/actor within 15-minute windows
  const groupedSessions = useMemo(() => {
    const groups: GroupedSession[] = []
    const FIFTEEN_MIN_MS = 15 * 60 * 1000

    filteredEvents.forEach((ev) => {
      const evDate = new Date(ev.createdAt)
      const lastGroup = groups[groups.length - 1]

      // Check if this event can be grouped with the previous group
      if (
        lastGroup &&
        lastGroup.actorName === ev.actorName &&
        lastGroup.familyId === ev.familyId &&
        lastGroup.events[0].eventType === ev.eventType &&
        Math.abs(lastGroup.lastCreatedAt.getTime() - evDate.getTime()) < FIFTEEN_MIN_MS
      ) {
        lastGroup.events.push(ev)
        lastGroup.lastCreatedAt = evDate
      } else {
        const sessionKey = `${ev.id}_${ev.eventType}`
        groups.push({
          key: sessionKey,
          familyId: ev.familyId,
          actorName: ev.actorName,
          actorType: ev.actorType,
          firstCreatedAt: evDate,
          lastCreatedAt: evDate,
          events: [ev],
          isRsvpSession: ev.eventType === 'RSVP_UPDATED',
        })
      }
    })

    return groups
  }, [filteredEvents])

  const toggleSessionExpand = (key: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const renderBadge = (eventType: string, actorType: string) => {
    if (eventType === 'WEBSITE_VISIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
          👀 Website Visit
        </span>
      )
    }
    if (eventType === 'RSVP_UPDATED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          ✓ RSVP Updated
        </span>
      )
    }
    if (eventType.startsWith('FAMILY_') || eventType.startsWith('GUEST_')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800 border border-sky-200">
          ⚙ {eventType.replace('_', ' ')}
        </span>
      )
    }
    if (eventType === 'GUEST_LOGIN') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
          🔑 Logged In
        </span>
      )
    }
    if (eventType === 'PASSWORD_RESET') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
          🔒 Password Reset
        </span>
      )
    }
    if (eventType === 'ADMIN_IMPERSONATION') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
          👁 Admin Preview
        </span>
      )
    }
    if (eventType === 'EASTER_EGG') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
          💍 Easter Egg
        </span>
      )
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
        {eventType}
      </span>
    )
  }

  // Parse diff elements from the description
  const renderFormattedDescription = (description: string) => {
    // If description is formatted with pipe separators (coalesced changes)
    if (description.includes(' | ')) {
      const parts = description.split(' | ')
      return (
        <div className="space-y-1 mt-1">
          {parts.map((p, idx) => (
            <div key={idx} className="text-xs font-karla text-zinc-700 flex items-start gap-1.5">
              <span className="text-zinc-400">•</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )
    }

    // Standard description
    return <p className="text-sm font-karla text-zinc-800 mt-1 leading-relaxed">{description}</p>
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-xl font-sans text-black">Live Activity & Audit Log</h3>
          <p className="text-xs font-karla text-zinc-500">
            Real-time feed of website visits, RSVP modifications, party changes, and access security.
          </p>
        </div>

        {/* Activity Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs font-karla">
          <button
            type="button"
            onClick={() => setActivityFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activityFilter === 'all'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            All ({auditEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActivityFilter('rsvps')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activityFilter === 'rsvps'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            RSVPs
          </button>
          <button
            type="button"
            onClick={() => setActivityFilter('visits')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activityFilter === 'visits'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Visits
          </button>
          <button
            type="button"
            onClick={() => setActivityFilter('management')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activityFilter === 'management'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Party Changes
          </button>
          <button
            type="button"
            onClick={() => setActivityFilter('auth')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activityFilter === 'auth'
                ? 'bg-black text-white font-medium shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Logins & Passwords
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      {groupedSessions.length === 0 ? (
        <div className="py-12 text-center text-zinc-400 text-xs font-karla">
          No activity logs match the selected filter.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-200">
          {groupedSessions.map((session) => {
            const isGrouped = session.events.length > 1
            const isExpanded = expandedSessions.has(session.key)
            const mainEvent = session.events[0]

            return (
              <div
                key={session.key}
                className="relative bg-zinc-50/70 hover:bg-zinc-50 transition-colors p-4 rounded-xl border border-zinc-200/80 space-y-2"
              >
                {/* Timeline Dot Indicator */}
                <div className="absolute -left-[27px] top-5 w-3 h-3 rounded-full bg-sage border-2 border-white shadow-xs" />

                {/* Top Row: Actor, Badges, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-black text-sm font-sans">
                      {session.actorName}
                    </span>
                    {session.actorType === 'ADMIN' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans uppercase tracking-wider font-semibold bg-emerald-100 text-emerald-800">
                        Admin
                      </span>
                    )}
                    {renderBadge(mainEvent.eventType, session.actorType)}
                    {isGrouped && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-800">
                        {session.events.length} updates in session
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-karla text-zinc-400">
                    {formatRelativeTime(session.firstCreatedAt)}
                  </span>
                </div>

                {/* Event Description & Diff Breakdown */}
                {renderFormattedDescription(mainEvent.description)}

                {/* Grouped Consecutive Updates (Expandable) */}
                {isGrouped && (
                  <div className="pt-2 border-t border-zinc-200/60">
                    <button
                      type="button"
                      onClick={() => toggleSessionExpand(session.key)}
                      className="text-xs text-sage hover:underline flex items-center gap-1 cursor-pointer font-karla"
                    >
                      <span>{isExpanded ? 'Hide' : 'Show'} session details ({session.events.length} edits)</span>
                      <svg
                        className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pl-3 border-l-2 border-zinc-200 space-y-1.5 text-xs font-karla text-zinc-600">
                        {session.events.map((subEvent, subIdx) => (
                          <div key={subEvent.id} className="py-1">
                            <span className="text-zinc-400 mr-2">
                              {formatRelativeTime(subEvent.createdAt)}:
                            </span>
                            <span>{subEvent.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
