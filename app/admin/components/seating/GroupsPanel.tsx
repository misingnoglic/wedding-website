'use client'

import { useMemo, useState } from 'react'
import {
  createSeatingGroup,
  deleteSeatingGroup,
  setSeatingLink,
  setSeatingGroupMembership,
  updateSeatingGroup,
} from '../../../actions/seating'
import { endpointKey, LinkEndpoint, linkHubs, linkKey, linkProblem, linkReach, partyLabel } from '@/lib/seating'
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

  const [search, setSearch] = useState('')

  // Everything a link side can be, keyed by endpointKey ("type:id"), and the guests each one covers.
  // Parties go by their people ("Partow & Shahrokh Boudaie"), with the invitation name as detail.
  const { options, membersOf } = useMemo(() => {
    const parties = new Map<string, { invitation: string; ids: string[]; names: string[] }>()
    for (const g of poolGuests) {
      const party = parties.get(g.familyId) || { invitation: g.familyName, ids: [], names: [] }
      party.ids.push(g.id)
      party.names.push(g.name)
      parties.set(g.familyId, party)
    }
    const poolIds = new Set(poolGuests.map((g) => g.id))
    const plural = (n: number) => `${n} guest${n === 1 ? '' : 's'}`
    const members = new Map<string, string[]>()
    const list: EndpointOption[] = []
    for (const g of groups) {
      const key = endpointKey({ type: 'group', id: g.id })
      const ids = g.memberIds.filter((id) => poolIds.has(id))
      members.set(key, ids)
      list.push({ key, type: 'group', name: g.name, detail: plural(ids.length), color: g.color })
    }
    for (const [id, p] of parties) {
      const key = endpointKey({ type: 'family', id })
      members.set(key, p.ids)
      list.push({ key, type: 'family', name: partyLabel(p.names), detail: p.invitation, color: null })
    }
    for (const g of poolGuests) {
      const key = endpointKey({ type: 'guest', id: g.id })
      members.set(key, [g.id])
      list.push({ key, type: 'guest', name: g.name, detail: partyLabel(parties.get(g.familyId)!.names), color: null })
    }
    return { options: list, membersOf: members }
  }, [groups, poolGuests])
  const optionsByKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options])
  const guestNames = useMemo(() => new Map(poolGuests.map((g) => [g.id, g.name.toLowerCase()])), [poolGuests])

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

  // Links whose sides no longer exist in the pool (e.g. a party that declined) are hidden. A search
  // matches a side's name, or anyone it covers, so "Partow" finds her party's and groups' links too.
  const query = search.toLowerCase().trim()
  const matches = (key: string) => {
    const option = optionsByKey.get(key)!
    return option.name.toLowerCase().includes(query) || (membersOf.get(key) ?? []).some((id) => guestNames.get(id)?.includes(query))
  }
  const rows = links
    .map((l) => ({ ...l, keyA: endpointKey(l.a), keyB: endpointKey(l.b) }))
    .filter((l) => optionsByKey.has(l.keyA) && optionsByKey.has(l.keyB))
    .filter((l) => !query || matches(l.keyA) || matches(l.keyB))
    .map((l) => ({ ...l, reach: linkReach(membersOf.get(l.keyA)!, membersOf.get(l.keyB)!) }))
  const nameOf = (key: string) => optionsByKey.get(key)!.name
  const hubs = linkHubs(
    rows.map((r) => ({ ...r, a: r.keyA, b: r.keyB, link: r })),
    nameOf
  )
  // Leftover links read group, then party, then guest, so they face the same way as the hubs
  const typeOrder = { group: 0, family: 1, guest: 2 }
  const orient = (x: string, y: string): [string, string] => {
    const [ox, oy] = [optionsByKey.get(x)!, optionsByKey.get(y)!]
    return (typeOrder[ox.type] - typeOrder[oy.type] || ox.name.localeCompare(oy.name)) <= 0 ? [x, y] : [y, x]
  }

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

      {links.length === 0 ? (
        <p className="text-xs text-zinc-400">No links yet.</p>
      ) : (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find links by name, including through a party or group…"
            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm"
          />
          {rows.length === 0 && <p className="text-xs text-zinc-400">No links match.</p>}
          {hubs.map(({ hub, links: hubLinks }) => (
            <div key={hub ?? 'other'} className="border-t border-zinc-100 pt-2">
              <div className="flex items-center gap-2 text-sm">
                {hub ? <EndpointName option={optionsByKey.get(hub)!} /> : <span className="font-medium text-zinc-500">Other links</span>}
                <span className="text-[11px] text-zinc-400">{hubLinks.length}</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {hubLinks
                  .map(({ link }) => {
                    const [left, right] = hub ? [null, link.keyA === hub ? link.keyB : link.keyA] : orient(link.keyA, link.keyB)
                    return { link, left, right }
                  })
                  .sort((x, y) => (x.left ? nameOf(x.left) : '').localeCompare(y.left ? nameOf(y.left) : '') || nameOf(x.right).localeCompare(nameOf(y.right)))
                  .map(({ link, left, right }) => (
                    <div key={linkKey(link.a, link.b)} className={`py-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 ${hub ? 'pl-5' : ''}`}>
                      <div className="flex items-center gap-2 text-sm min-w-0 md:flex-1">
                        {left && <EndpointName option={optionsByKey.get(left)!} />}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${affinityClass(link.affinity)}`}>
                          {formatAffinity(link.affinity)}
                        </span>
                        <EndpointName option={optionsByKey.get(right)!} />
                        <span
                          className="text-[11px] text-zinc-400 font-mono shrink-0"
                          title="Guest pairs this link sets a baseline for. A rating, or a stronger group or link, overrides it for a pair"
                        >
                          ×{link.reach}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <AffinityPicker value={link.affinity} onChange={(value) => setLink(link.a, link.b, value)} />
                        <button
                          type="button"
                          onClick={() => setLink(link.a, link.b, null)}
                          className="text-xs text-zinc-400 hover:text-red-600 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
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
