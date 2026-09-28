'use client'

import { useMemo, useState } from 'react'
import { formatPhoneNumber } from '@/lib/phone'
import { FlatGuest } from '../../types'
import { Icon, ICONS } from './ui'

interface GuestSearchProps {
  guests: FlatGuest[]
  onPick: (guest: FlatGuest) => void
  placeholder?: string
  autoFocus?: boolean
  isPicked?: (guest: FlatGuest) => boolean
  maxResults?: number
  onPickFamily?: (familyGuests: FlatGuest[]) => void // Also offer whole families
}

export default function GuestSearch({
  guests,
  onPick,
  placeholder = 'Search guests or families',
  autoFocus,
  isPicked,
  maxResults = 8,
  onPickFamily,
}: GuestSearchProps) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return guests
      .filter((g) => g.name.toLowerCase().includes(q) || g.familyName.toLowerCase().includes(q))
      .slice(0, maxResults)
  }, [guests, query, maxResults])

  const familyResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !onPickFamily) return []
    const byFamily = new Map<string, FlatGuest[]>()
    for (const g of guests) {
      if (g.familyName.toLowerCase().includes(q)) byFamily.set(g.familyId, [...(byFamily.get(g.familyId) || []), g])
    }
    return [...byFamily.values()].slice(0, 3)
  }, [guests, query, onPickFamily])

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Icon path={ICONS.search} className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-zinc-100 pl-9 pr-3 py-2 text-base lg:text-sm font-karla placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sage/40"
        />
      </label>
      {(results.length > 0 || familyResults.length > 0) && (
        <ul className="mt-2 rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
          {familyResults.map((familyGuests) => (
            <li key={familyGuests[0].familyId}>
              <button
                type="button"
                onClick={() => {
                  onPickFamily?.(familyGuests)
                  setQuery('')
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 bg-zinc-50/60 hover:bg-zinc-100 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-sans text-black">{familyGuests[0].familyName}</div>
                  <div className="text-xs font-karla text-zinc-500">
                    Whole family · {familyGuests.length} guest{familyGuests.length === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {results.map((guest) => {
            const picked = isPicked?.(guest)
            return (
              <li key={guest.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(guest)
                    setQuery('')
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-sans text-black">{guest.name}</div>
                    <div className="truncate text-xs font-karla text-zinc-500">
                      {guest.familyName} ·{' '}
                      {guest.phoneNumber ? formatPhoneNumber(guest.phoneNumber) : <span className="text-amber-700">No phone</span>}
                    </div>
                  </div>
                  {picked && <Icon path={ICONS.check} className="w-4 h-4 text-sage shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
