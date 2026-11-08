'use client'

import { useMemo, useState } from 'react'
import {
  CONSTRAINT_LABELS,
  EffectiveAffinity,
  effectiveWeights,
  findSeatingWarnings,
  formatWeight,
  HEAD_SEATS,
  pairKey,
  SEATING_CONSTRAINTS,
  STRONG_AFFINITY,
} from '@/lib/seating'
import { setExcludeFromSeating, setGuestRelationship, setSeatingWeight, setSeatRequirement } from '../../../actions/seating'
import { FlatGuest, GuestRelationshipItem, SeatingGroupItem } from '../../types'
import AffinityPicker, { formatAffinity } from './AffinityPicker'
import { RunSeatingAction } from './state'
import WeightPicker from './WeightPicker'

type SeatingWarnings = ReturnType<typeof findSeatingWarnings>

interface GuestRatingsProps {
  poolGuests: FlatGuest[]
  excludedGuests: FlatGuest[]
  headIds: Set<string>
  ownWeights: Map<string, number> // Set on the guest
  weights: Map<string, { weight: number; from: string | null }> // In effect, from effectiveWeights
  groups: SeatingGroupItem[]
  relationships: GuestRelationshipItem[]
  affinityMap: Map<string, EffectiveAffinity>
  warnings: SeatingWarnings
  run: RunSeatingAction
}

type ListFilter = 'all' | 'isolated' | 'overConstrained' | 'unrated'
type RowFilter = 'all' | 'connected'

export default function GuestRatings({
  poolGuests,
  excludedGuests,
  headIds,
  ownWeights,
  weights,
  groups,
  relationships,
  affinityMap,
  warnings,
  run,
}: GuestRatingsProps) {
  const blocked = new Set([...warnings.overConstrained, ...warnings.headConflicts])
  const [selectedId, setSelectedId] = useState<string | null>(poolGuests[0]?.id ?? null)
  const [listSearch, setListSearch] = useState('')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [rowSearch, setRowSearch] = useState('')
  const [rowFilter, setRowFilter] = useState<RowFilter>('all')

  const relationshipsByPair = useMemo(
    () => new Map(relationships.map((r) => [pairKey(r.guestAId, r.guestBId), r])),
    [relationships]
  )

  // Per-guest counts for the list badges
  const guestSummary = useMemo(() => {
    const summary = new Map<string, { strong: number; rated: number }>()
    for (const g of poolGuests) summary.set(g.id, { strong: 0, rated: 0 })
    for (const [key, value] of affinityMap) {
      for (const id of key.split('|')) {
        const s = summary.get(id)
        if (!s) continue
        if (value.affinity >= STRONG_AFFINITY) s.strong++
        if (value.source === 'explicit') s.rated++
      }
    }
    return summary
  }, [poolGuests, affinityMap])

  const listGuests = poolGuests.filter((g) => {
    const query = listSearch.toLowerCase().trim()
    if (query && !g.name.toLowerCase().includes(query) && !g.familyName.toLowerCase().includes(query)) return false
    if (listFilter === 'isolated') return warnings.isolated.has(g.id)
    if (listFilter === 'overConstrained') return blocked.has(g.id)
    if (listFilter === 'unrated') return guestSummary.get(g.id)?.rated === 0
    return true
  })

  const selected = poolGuests.find((g) => g.id === selectedId) || excludedGuests.find((g) => g.id === selectedId) || null
  const isSelectedExcluded = !!selected && excludedGuests.some((g) => g.id === selected.id)

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Guest list */}
      <div className="w-full lg:w-80 shrink-0 bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-3 space-y-3 lg:sticky lg:top-4">
        <input
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder="Search guests…"
          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['all', 'All'],
              ['unrated', 'Unrated'],
              ['isolated', `No strong tie (${warnings.isolated.size})`],
              ['overConstrained', `Over-constrained (${blocked.size})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setListFilter(value)}
              className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer ${
                listFilter === value ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-0.5">
          {listGuests.length === 0 && <p className="text-xs text-zinc-400 py-4 text-center">No guests match.</p>}
          {listGuests.map((g) => {
            const summary = guestSummary.get(g.id)
            const isActive = g.id === selectedId
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isActive ? 'bg-black text-white' : 'hover:bg-zinc-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.name}</div>
                  <div className={`text-[11px] truncate ${isActive ? 'text-zinc-300' : 'text-zinc-400'}`}>{g.familyName}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {headIds.has(g.id) && (
                    <span
                      title="Must sit at a head"
                      className={`text-[9px] font-semibold uppercase tracking-wider px-1 rounded ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Head
                    </span>
                  )}
                  {(weights.get(g.id)?.weight ?? 1) !== 1 && (
                    <span
                      title="How much their happiness counts"
                      className={`text-[9px] font-semibold font-mono px-1 rounded ${
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {formatWeight(weights.get(g.id)!.weight)}
                    </span>
                  )}
                  {blocked.has(g.id) && <span title="Has constraints that can't all be satisfied">⛔</span>}
                  {warnings.isolated.has(g.id) && <span title="No one rated +2 or higher">⚠️</span>}
                  <span
                    title="Strong ties (+2 or higher)"
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {summary?.strong ?? 0}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        {excludedGuests.length > 0 && (
          <div className="border-t border-zinc-100 pt-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 px-1 pb-1">Not seated</div>
            <div className="flex flex-wrap gap-1">
              {excludedGuests.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs cursor-pointer ${
                    g.id === selectedId ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected guest */}
      <div className="flex-1 min-w-0 w-full">
        {!selected ? (
          <div className="bg-white p-8 rounded-2xl border border-zinc-200/80 text-center text-sm text-zinc-500">
            Select a guest to rate their relationships.
          </div>
        ) : (
          <GuestDetail
            guest={selected}
            isExcluded={isSelectedExcluded}
            isHead={!!selected && headIds.has(selected.id)}
            ownWeight={selected ? ownWeights.get(selected.id) ?? null : null}
            poolGuests={poolGuests}
            groups={groups}
            relationshipsByPair={relationshipsByPair}
            affinityMap={affinityMap}
            warnings={warnings}
            rowSearch={rowSearch}
            setRowSearch={setRowSearch}
            rowFilter={rowFilter}
            setRowFilter={setRowFilter}
            run={run}
          />
        )}
      </div>
    </div>
  )
}

interface GuestDetailProps {
  guest: FlatGuest
  isExcluded: boolean
  isHead: boolean
  ownWeight: number | null
  poolGuests: FlatGuest[]
  groups: SeatingGroupItem[]
  relationshipsByPair: Map<string, GuestRelationshipItem>
  affinityMap: Map<string, EffectiveAffinity>
  warnings: SeatingWarnings
  rowSearch: string
  setRowSearch: (value: string) => void
  rowFilter: RowFilter
  setRowFilter: (value: RowFilter) => void
  run: RunSeatingAction
}

function GuestDetail({
  guest,
  isExcluded,
  isHead,
  ownWeight,
  poolGuests,
  groups,
  relationshipsByPair,
  affinityMap,
  warnings,
  rowSearch,
  setRowSearch,
  rowFilter,
  setRowFilter,
  run,
}: GuestDetailProps) {
  const guestGroups = groups.filter((g) => g.memberIds.includes(guest.id))
  // What their weight would be without their own: their groups', else 1
  const inherited = effectiveWeights([{ id: guest.id, seatingWeight: null }], guestGroups).get(guest.id)!

  // Same party first, then alphabetical by party; stays stable while ratings change
  const rows = poolGuests
    .filter((other) => other.id !== guest.id)
    .filter((other) => {
      const query = rowSearch.toLowerCase().trim()
      if (query && !other.name.toLowerCase().includes(query) && !other.familyName.toLowerCase().includes(query)) return false
      if (rowFilter === 'connected') {
        const key = pairKey(guest.id, other.id)
        return affinityMap.has(key) || !!relationshipsByPair.get(key)?.constraint
      }
      return true
    })
    .sort((a, b) => {
      const aSame = a.familyId === guest.familyId ? 0 : 1
      const bSame = b.familyId === guest.familyId ? 0 : 1
      return aSame - bSame || a.familyName.localeCompare(b.familyName) || a.name.localeCompare(b.name)
    })

  // A party of two sits together by default (partyPairConstraints), so say so in the empty option
  const isPartyPair = poolGuests.filter((g) => g.familyId === guest.familyId).length === 2

  const setRelationship = (otherId: string, input: { affinity?: number | null; constraint?: string | null }) =>
    run({ type: 'relationship', guestId1: guest.id, guestId2: otherId, ...input }, () =>
      setGuestRelationship(guest.id, otherId, input)
    )

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm">
      <div className="p-4 border-b border-zinc-100 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-black">{guest.name}</h3>
            <p className="text-xs text-zinc-500 font-karla">
              {guest.familyName}
              {guest.isAttendingWedding === null && ' · Wedding RSVP pending'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isExcluded && (
              <button
                type="button"
                onClick={() => {
                  const seatRequirement = isHead ? null : 'HEAD'
                  run({ type: 'seatRequirement', guestId: guest.id, seatRequirement }, () =>
                    setSeatRequirement(guest.id, seatRequirement)
                  )
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                  isHead
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-black hover:text-black'
                }`}
              >
                {isHead ? '✓ Must sit at a head' : 'Must sit at a head'}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                run({ type: 'exclude', guestId: guest.id, excludeFromSeating: !isExcluded }, () =>
                  setExcludeFromSeating(guest.id, !isExcluded)
                )
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                isExcluded
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              {isExcluded ? 'Excluded from seating · Include' : 'Exclude from seating'}
            </button>
          </div>
        </div>
        {!isExcluded && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500"
              title="How much this guest's happiness counts in the Seating Lab's score. 2× means the solver works twice as hard for them"
            >
              Weight
            </span>
            <WeightPicker
              value={ownWeight}
              inherited={inherited.weight}
              inheritedLabel={inherited.from ? `from the ${inherited.from} group` : 'by default'}
              onChange={(seatingWeight) =>
                run({ type: 'seatingWeight', guestId: guest.id, seatingWeight }, () => setSeatingWeight(guest.id, seatingWeight))
              }
            />
            {ownWeight === null && inherited.from && <span className="text-[11px] text-zinc-400">from {inherited.from}</span>}
          </div>
        )}
        {guestGroups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {guestGroups.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-xs text-zinc-700">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color || '#a1a1aa' }} />
                {g.name} <span className="font-mono text-zinc-400">{formatAffinity(g.affinity)}</span>
              </span>
            ))}
          </div>
        )}
        {warnings.isolated.has(guest.id) && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Nobody is rated +{STRONG_AFFINITY} or higher with {guest.name}, so no seat can protect them. Rate at least one
            person they&apos;d enjoy sitting with.
          </p>
        )}
        {warnings.headConflicts.has(guest.id) && (
          <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⛔ This head seat requirement can&apos;t be met: either more than {HEAD_SEATS} guests must sit at a head, or{' '}
            {guest.name} must also sit next to another head guest (heads only neighbor the corner seats).
          </p>
        )}
        {warnings.overConstrained.has(guest.id) && (
          <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⛔ More than two &ldquo;must sit next to&rdquo; constraints. A seat only has two neighbors, so this can&apos;t be
            satisfied.
          </p>
        )}
      </div>

      {isExcluded ? (
        <p className="p-8 text-center text-sm text-zinc-500">{guest.name} isn&apos;t being seated, so there&apos;s nothing to rate.</p>
      ) : (
        <>
          <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-zinc-100">
            <input
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder="Filter people…"
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm sm:w-64"
            />
            <div className="inline-flex p-1 bg-zinc-100 rounded-lg text-xs">
              {(
                [
                  ['all', 'Everyone'],
                  ['connected', 'Only connections'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRowFilter(value)}
                  className={`px-3 py-1 rounded-md cursor-pointer ${
                    rowFilter === value ? 'bg-white text-black shadow-sm font-medium' : 'text-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {rows.length === 0 && <p className="p-6 text-center text-sm text-zinc-400">No one matches.</p>}
            {rows.map((other) => {
              const key = pairKey(guest.id, other.id)
              const effective = affinityMap.get(key)
              const relationship = relationshipsByPair.get(key)
              const isExplicit = effective?.source === 'explicit'
              return (
                <div
                  key={other.id}
                  className="px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 hover:bg-zinc-50/60"
                >
                  <div className="md:w-56 min-w-0">
                    <div className="text-sm font-medium text-black truncate">{other.name}</div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {other.familyName}
                      {effective && !isExplicit && (
                        <span className="ml-1.5 text-zinc-500">
                          · {effective.label} {formatAffinity(effective.affinity)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AffinityPicker
                      value={effective?.affinity ?? 0}
                      isExplicit={isExplicit}
                      onChange={(affinity) => setRelationship(other.id, { affinity })}
                    />
                    <button
                      type="button"
                      title="Clear the rating and fall back to the group / party baseline"
                      onClick={() => setRelationship(other.id, { affinity: null })}
                      className={`text-xs text-zinc-400 hover:text-black cursor-pointer w-4 ${isExplicit ? '' : 'invisible'}`}
                    >
                      ↺
                    </button>
                  </div>
                  <select
                    value={relationship?.constraint ?? ''}
                    onChange={(e) => setRelationship(other.id, { constraint: e.target.value || null })}
                    className={`border rounded-lg px-2 py-1 text-xs md:ml-auto ${
                      relationship?.constraint ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-500'
                    }`}
                  >
                    <option value="">{isPartyPair && other.familyId === guest.familyId ? 'Default: must sit next to' : 'No constraint'}</option>
                    {SEATING_CONSTRAINTS.map((c) => (
                      <option key={c} value={c}>
                        {CONSTRAINT_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
