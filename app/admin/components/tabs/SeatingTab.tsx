'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { buildAffinityMap, findSeatingWarnings, isInSeatingPool } from '@/lib/seating'
import { FlatGuest, SeatingData } from '../../types'
import { applySeatingPatch, RunSeatingAction, SeatingState } from '../seating/state'
import GuestRatings from '../seating/GuestRatings'
import GroupsPanel from '../seating/GroupsPanel'

interface SeatingTabProps {
  guests: FlatGuest[]
  seating: SeatingData
}

type SeatingView = 'groups' | 'ratings'

export default function SeatingTab({ guests, seating }: SeatingTabProps) {
  const [view, setView] = useState<SeatingView>(seating.groups.length === 0 ? 'groups' : 'ratings')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const serverState = useMemo<SeatingState>(
    () => ({
      groups: seating.groups,
      links: seating.links,
      relationships: seating.relationships,
      excludedIds: new Set(guests.filter((g) => g.excludeFromSeating).map((g) => g.id)),
    }),
    [seating, guests]
  )
  const [state, addPatch] = useOptimistic(serverState, applySeatingPatch)

  // Apply the edit locally right away, then persist it; revalidation replaces the optimistic copy
  const run: RunSeatingAction = (patch, action) => {
    setError(null)
    startTransition(async () => {
      if (patch) addPatch(patch)
      const result = await action()
      if ('error' in result) setError(result.error)
    })
  }

  const poolGuests = useMemo(
    () =>
      guests
        .filter((g) => isInSeatingPool({ ...g, excludeFromSeating: state.excludedIds.has(g.id) }))
        .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.name.localeCompare(b.name)),
    [guests, state.excludedIds]
  )
  const excludedGuests = useMemo(
    () => guests.filter((g) => state.excludedIds.has(g.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [guests, state.excludedIds]
  )

  const affinityMap = useMemo(
    () => buildAffinityMap(poolGuests, state.groups, state.relationships, state.links),
    [poolGuests, state.groups, state.relationships, state.links]
  )
  const warnings = useMemo(
    () => findSeatingWarnings(poolGuests.map((g) => g.id), affinityMap, state.relationships),
    [poolGuests, affinityMap, state.relationships]
  )

  const poolIds = new Set(poolGuests.map((g) => g.id))
  const poolRelationships = state.relationships.filter((r) => poolIds.has(r.guestAId) && poolIds.has(r.guestBId))
  const stats = [
    { label: 'In seating pool', value: poolGuests.length },
    { label: 'Excluded', value: excludedGuests.length },
    { label: 'Groups', value: state.groups.length },
    { label: 'Links', value: state.links.length },
    { label: 'Explicit ratings', value: poolRelationships.filter((r) => r.affinity !== null).length },
    { label: 'Hard constraints', value: poolRelationships.filter((r) => r.constraint !== null).length },
    { label: 'No strong tie', value: warnings.isolated.size, warn: warnings.isolated.size > 0 },
    { label: 'Over-constrained', value: warnings.overConstrained.size, warn: warnings.overConstrained.size > 0 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`px-3 py-1.5 rounded-xl border text-xs font-karla ${
                s.warn ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-zinc-50 border-zinc-100 text-zinc-600'
              }`}
            >
              <span className="font-mono font-semibold text-sm mr-1.5">{s.value}</span>
              {s.label}
            </div>
          ))}
        </div>
        <div className="inline-flex p-1 bg-zinc-100 rounded-xl shrink-0">
          {(['groups', 'ratings'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-sans transition-all cursor-pointer ${
                view === v ? 'bg-white text-black shadow-sm font-medium' : 'text-zinc-500 hover:text-black'
              }`}
            >
              {v === 'groups' ? 'Groups & Links' : 'Guest Ratings'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {view === 'groups' ? (
        <GroupsPanel groups={state.groups} links={state.links} poolGuests={poolGuests} allGuests={guests} run={run} />
      ) : (
        <GuestRatings
          poolGuests={poolGuests}
          excludedGuests={excludedGuests}
          groups={state.groups}
          relationships={state.relationships}
          affinityMap={affinityMap}
          warnings={warnings}
          run={run}
        />
      )}
    </div>
  )
}
