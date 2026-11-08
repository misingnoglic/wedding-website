'use client'

import { useMemo, useState } from 'react'
import {
  createSeatingGroup,
  deleteSeatingGroup,
  setSeatingLink,
  setSeatingGroupMembership,
  updateSeatingGroup,
} from '../../../actions/seating'
import { endpointKey, LinkEndpoint, linkKey, linkProblem } from '@/lib/seating'
import { FlatGuest, SeatingGroupItem, SeatingLinkItem } from '../../types'
import AffinityPicker, { affinityClass, formatAffinity } from './AffinityPicker'
import EndpointPicker, { EndpointBadge, EndpointOption } from './EndpointPicker'
import { GROUP_COLORS, RunSeatingAction } from './state'
import WeightPicker from './WeightPicker'

interface GroupsPanelProps {
  groups: SeatingGroupItem[]
  links: SeatingLinkItem[]
  poolGuests: FlatGuest[]
  allGuests: FlatGuest[]
  run: RunSeatingAction
}

export default function GroupsPanel({ groups, links, poolGuests, allGuests, run }: GroupsPanelProps) {
  const [name, setName] = useState('')
  const [affinity, setAffinity] = useState(1)
  const [color, setColor] = useState(GROUP_COLORS[groups.length % GROUP_COLORS.length])
  const guestsById = useMemo(() => new Map(allGuests.map((g) => [g.id, g])), [allGuests])
  const groupNamesByGuest = useMemo(() => {
    const names = new Map<string, string[]>()
    for (const g of groups) for (const id of g.memberIds) names.set(id, [...(names.get(id) || []), g.name])
    return names
  }, [groups])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    run(null, () => createSeatingGroup({ name, affinity, color }))
    setName('')
    setAffinity(1)
    setColor(GROUP_COLORS[(groups.length + 1) % GROUP_COLORS.length])
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreate}
        className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col lg:flex-row gap-4 lg:items-end"
      >
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">New group</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arya college friends"
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Baseline affinity</span>
          <AffinityPicker value={affinity} onChange={setAffinity} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Color</span>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Add group
        </button>
      </form>

      <p className="text-xs text-zinc-500 font-karla px-1">
        Every pair inside a group starts at its baseline, and a link gives a baseline to every pair across its two sides
        (each a group, a party, or a guest). Guests in the same party start at +2. When baselines overlap the highest wins, and a rating on the Guest Ratings view
        overrides all of them.
      </p>

      {groups.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200/80 text-center text-sm text-zinc-500">
          No groups yet. Start with the big social circles: college, work, each side&apos;s cousins.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              poolGuests={poolGuests}
              guestsById={guestsById}
              groupNamesByGuest={groupNamesByGuest}
              run={run}
            />
          ))}
        </div>
      )}

      <LinksSection groups={groups} links={links} poolGuests={poolGuests} run={run} />
    </div>
  )
}

function LinksSection({
  groups,
  links,
  poolGuests,
  run,
}: {
  groups: SeatingGroupItem[]
  links: SeatingLinkItem[]
  poolGuests: FlatGuest[]
  run: RunSeatingAction
}) {
  const [sideA, setSideA] = useState('')
  const [sideB, setSideB] = useState('')
  const [affinity, setAffinity] = useState(1)

  // Everything a link side can be, keyed by endpointKey ("type:id")
  const options = useMemo<EndpointOption[]>(() => {
    const parties = new Map<string, { name: string; members: string[] }>()
    for (const g of poolGuests) {
      const party = parties.get(g.familyId) || { name: g.familyName, members: [] }
      party.members.push(g.name)
      parties.set(g.familyId, party)
    }
    const poolIds = new Set(poolGuests.map((g) => g.id))
    const plural = (n: number) => `${n} guest${n === 1 ? '' : 's'}`
    return [
      ...groups.map((g) => ({
        key: endpointKey({ type: 'group', id: g.id }),
        type: 'group' as const,
        name: g.name,
        detail: plural(g.memberIds.filter((id) => poolIds.has(id)).length),
        color: g.color,
      })),
      ...[...parties.entries()].map(([id, p]) => ({
        key: endpointKey({ type: 'family', id }),
        type: 'family' as const,
        name: p.name,
        detail: p.members.join(', '),
        color: null,
      })),
      ...poolGuests.map((g) => ({
        key: endpointKey({ type: 'guest', id: g.id }),
        type: 'guest' as const,
        name: g.name,
        detail: g.familyName,
        color: null,
      })),
    ]
  }, [groups, poolGuests])
  const optionsByKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options])

  const parseKey = (key: string): LinkEndpoint => {
    const i = key.indexOf(':')
    return { type: key.slice(0, i) as LinkEndpoint['type'], id: key.slice(i + 1) }
  }
  const setLink = (a: LinkEndpoint, b: LinkEndpoint, value: number | null) =>
    run({ type: 'link', a, b, affinity: value }, () => setSeatingLink(a, b, value))

  const draft = sideA && sideB ? { a: parseKey(sideA), b: parseKey(sideB) } : null
  const draftProblem = draft && linkProblem(draft.a, draft.b)
  const draftExists = !!draft && links.some((l) => linkKey(l.a, l.b) === linkKey(draft.a, draft.b))

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft || draftProblem) return
    setLink(draft.a, draft.b, affinity)
    setSideA('')
    setSideB('')
    setAffinity(1)
  }

  // Links whose sides no longer exist in the pool (e.g. a party that declined) are hidden
  const rows = links
    .map((l) => ({ ...l, sideA: optionsByKey.get(endpointKey(l.a)), sideB: optionsByKey.get(endpointKey(l.b)) }))
    .filter((l) => l.sideA && l.sideB)
    .sort((x, y) => x.sideA!.name.localeCompare(y.sideA!.name) || x.sideB!.name.localeCompare(y.sideB!.name))

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-black">Links</h3>
        <p className="text-xs text-zinc-500 font-karla">
          Link two groups, parties, or guests in any combination, e.g. a guest to their relatives&apos; party, or two
          friend groups that mix well.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <EndpointPicker options={options} value={sideA} onChange={setSideA} disabledKeys={new Set([sideB])} />
            <span className="text-zinc-400">↔</span>
            <EndpointPicker options={options} value={sideB} onChange={setSideB} disabledKeys={new Set([sideA])} />
          </div>
          <AffinityPicker value={affinity} onChange={setAffinity} />
          <button
            type="submit"
            disabled={!draft || !!draftProblem}
            className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            {draftExists ? 'Update link' : 'Add link'}
          </button>
        </div>
        {draftProblem && <p className="text-xs text-amber-700">{draftProblem}</p>}
      </form>

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-400">No links yet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {rows.map((l) => (
            <div key={linkKey(l.a, l.b)} className="py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 text-sm min-w-0 md:flex-1">
                <EndpointName option={l.sideA!} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${affinityClass(l.affinity)}`}>
                  {formatAffinity(l.affinity)}
                </span>
                <EndpointName option={l.sideB!} />
              </div>
              <div className="flex items-center gap-3">
                <AffinityPicker value={l.affinity} onChange={(value) => setLink(l.a, l.b, value)} />
                <button
                  type="button"
                  onClick={() => setLink(l.a, l.b, null)}
                  className="text-xs text-zinc-400 hover:text-red-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EndpointName({ option }: { option: EndpointOption }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={option.detail}>
      <EndpointBadge option={option} />
      <span className="truncate font-medium text-black">{option.name}</span>
    </span>
  )
}

function ColorSwatches({ value, onChange }: { value: string | null; onChange: (color: string) => void }) {
  return (
    <div className="flex gap-1.5 py-1">
      {GROUP_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${value === c ? 'ring-2 ring-offset-2 ring-black scale-110' : ''}`}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  )
}

interface GroupCardProps {
  group: SeatingGroupItem
  poolGuests: FlatGuest[]
  guestsById: Map<string, FlatGuest>
  groupNamesByGuest: Map<string, string[]>
  run: RunSeatingAction
}

function GroupCard({ group, poolGuests, guestsById, groupNamesByGuest, run }: GroupCardProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [showGrouped, setShowGrouped] = useState(false)
  const [draftName, setDraftName] = useState(group.name)

  const members = group.memberIds
    .map((id) => guestsById.get(id))
    .filter((g): g is FlatGuest => !!g)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Candidates grouped by party so a whole family can be added at once. Guests already in
  // another group are hidden unless asked for, so the list shrinks as everyone gets placed.
  const { candidatesByFamily, hiddenCount } = useMemo(() => {
    const memberIds = new Set(group.memberIds)
    const query = search.toLowerCase().trim()
    const byFamily = new Map<string, FlatGuest[]>()
    let hiddenCount = 0
    for (const g of poolGuests) {
      if (memberIds.has(g.id)) continue
      if (query && !g.name.toLowerCase().includes(query) && !g.familyName.toLowerCase().includes(query)) continue
      if (!showGrouped && groupNamesByGuest.has(g.id)) {
        hiddenCount++
        continue
      }
      byFamily.set(g.familyName, [...(byFamily.get(g.familyName) || []), g])
    }
    return { candidatesByFamily: [...byFamily.entries()], hiddenCount }
  }, [poolGuests, group.memberIds, search, showGrouped, groupNamesByGuest])

  const otherGroupsLabel = (guestId: string) => groupNamesByGuest.get(guestId)?.filter((n) => n !== group.name).join(', ')

  const setMembers = (guestIds: string[], isMember: boolean) =>
    run({ type: 'membership', groupId: group.id, guestIds, isMember }, () =>
      setSeatingGroupMembership(group.id, guestIds, isMember)
    )

  const saveName = () => {
    const name = draftName.trim()
    if (!name || name === group.name) {
      setDraftName(group.name)
      return
    }
    run({ type: 'group', groupId: group.id, name }, () => updateSeatingGroup(group.id, { name }))
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color || '#a1a1aa' }} />
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="flex-1 min-w-0 font-semibold text-black bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-zinc-400 focus:outline-none py-0.5"
        />
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-100 text-zinc-500">{members.length}</span>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete the group "${group.name}" and its links? Explicit ratings are kept.`)) return
            run({ type: 'deleteGroup', groupId: group.id }, () => deleteSeatingGroup(group.id))
          }}
          className="text-xs text-zinc-400 hover:text-red-600 cursor-pointer"
        >
          Delete
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AffinityPicker
          value={group.affinity}
          onChange={(affinity) =>
            run({ type: 'group', groupId: group.id, affinity }, () => updateSeatingGroup(group.id, { affinity }))
          }
        />
        <ColorSwatches
          value={group.color}
          onChange={(color) => run({ type: 'group', groupId: group.id, color }, () => updateSeatingGroup(group.id, { color }))}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        title="How much members' happiness counts in the Seating Lab's score. A guest's own weight wins; in several weighted groups, the highest counts"
      >
        <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Weight</span>
        <WeightPicker
          value={group.seatingWeight}
          inherited={1}
          inheritedLabel="by default"
          onChange={(seatingWeight) =>
            run({ type: 'group', groupId: group.id, seatingWeight }, () => updateSeatingGroup(group.id, { seatingWeight }))
          }
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {members.length === 0 && <span className="text-xs text-zinc-400">No members yet.</span>}
        {members.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-zinc-100 text-xs text-zinc-700"
          >
            {g.name}
            <button
              type="button"
              onClick={() => setMembers([g.id], false)}
              className="w-4 h-4 rounded-full text-zinc-400 hover:bg-zinc-300 hover:text-black cursor-pointer leading-none"
              aria-label={`Remove ${g.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="px-2.5 py-0.5 rounded-full border border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-black hover:text-black cursor-pointer"
        >
          {isAdding ? 'Done' : '+ Add guests'}
        </button>
      </div>

      {isAdding && (
        <div className="border border-zinc-100 rounded-xl p-3 space-y-2 bg-zinc-50/50">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests or parties…"
            autoFocus
            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={showGrouped}
              onChange={(e) => setShowGrouped(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Show guests already in another group
            {!showGrouped && hiddenCount > 0 && <span className="text-zinc-400">({hiddenCount} hidden)</span>}
          </label>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {candidatesByFamily.length === 0 && <p className="text-xs text-zinc-400 py-2">No matching guests.</p>}
            {candidatesByFamily.map(([familyName, familyGuests]) => (
              <div key={familyName}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">{familyName}</span>
                  {familyGuests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMembers(familyGuests.map((g) => g.id), true)}
                      className="text-[11px] text-zinc-500 hover:text-black cursor-pointer"
                    >
                      Add all {familyGuests.length}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {familyGuests.map((g) => {
                    const otherGroups = otherGroupsLabel(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        title={otherGroups ? `Also in: ${otherGroups}` : undefined}
                        onClick={() => setMembers([g.id], true)}
                        className="px-2.5 py-0.5 rounded-full bg-white border border-zinc-200 text-xs text-zinc-700 hover:border-black cursor-pointer"
                      >
                        + {g.name}
                        {otherGroups && <span className="ml-1 text-zinc-400">· {otherGroups}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
