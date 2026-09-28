'use client'

import { useMemo, useState } from 'react'
import { AudienceFilters, DEFAULT_FILTERS, describeFilters, matchesFilters, RsvpChoice } from '@/lib/smsAudience'
import { FlatGuest } from '../../types'

interface AudienceBuilderProps {
  guests: FlatGuest[]
  onAdd: (guests: FlatGuest[], label: string) => void
}

const PRESETS: { label: string; filters: Partial<AudienceFilters> }[] = [
  { label: 'Everyone', filters: {} },
  { label: 'Yes to any event', filters: { anyEventYes: true } },
  { label: 'No response yet', filters: { noResponse: true } },
  { label: 'At The Cape', filters: { hotel: 'cape' } },
  { label: 'Not at The Cape', filters: { hotel: 'notCape' } },
  { label: 'Never logged in', filters: { login: 'never' } },
  { label: 'Rehearsal dinner', filters: { rehearsalInvited: 'yes' } },
]

const RSVP_OPTIONS: { value: RsvpChoice; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'pending', label: 'Pending' },
]

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-karla text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-base lg:text-xs font-karla text-zinc-900 focus:outline-none focus:border-sage"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function AudienceBuilder({ guests, onAdd }: AudienceBuilderProps) {
  const [filters, setFilters] = useState<AudienceFilters>(DEFAULT_FILTERS)
  const set = <K extends keyof AudienceFilters>(key: K, value: AudienceFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const matching = useMemo(() => guests.filter((g) => matchesFilters(g, filters)), [guests, filters])
  const label = describeFilters(filters)

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((preset) => {
          const presetFilters = { ...DEFAULT_FILTERS, ...preset.filters, includeDeclined: filters.includeDeclined }
          const active = JSON.stringify(presetFilters) === JSON.stringify(filters)
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setFilters(presetFilters)}
              className={`rounded-full px-3 py-1.5 text-xs font-karla transition-colors cursor-pointer ${
                active ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs font-karla text-zinc-500 hover:text-black select-none">
          More filters
        </summary>
        <div className="mt-2 divide-y divide-zinc-100">
          <Select label="Wedding" value={filters.wedding} options={RSVP_OPTIONS} onChange={(v) => set('wedding', v)} />
          <Select label="Welcome party" value={filters.welcome} options={RSVP_OPTIONS} onChange={(v) => set('welcome', v)} />
          <Select label="Rehearsal dinner" value={filters.rehearsal} options={RSVP_OPTIONS} onChange={(v) => set('rehearsal', v)} />
          <Select
            label="Hotel"
            value={filters.hotel}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'cape', label: 'At The Cape' },
              { value: 'notCape', label: 'Not at The Cape' },
              { value: 'unknown', label: 'Not given' },
            ]}
            onChange={(v) => set('hotel', v)}
          />
          <Select
            label="Website login"
            value={filters.login}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'never', label: 'Never logged in' },
              { value: 'loggedIn', label: 'Has logged in' },
            ]}
            onChange={(v) => set('login', v)}
          />
          <Select
            label="Rehearsal invite"
            value={filters.rehearsalInvited}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'yes', label: 'Invited' },
              { value: 'no', label: 'Not invited' },
            ]}
            onChange={(v) => set('rehearsalInvited', v)}
          />
        </div>
      </details>

      <label className="flex items-start gap-2 text-xs font-karla text-zinc-600 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.includeDeclined}
          onChange={(e) => set('includeDeclined', e.target.checked)}
          className="mt-0.5 accent-[#9CA986]"
        />
        <span>Include guests who declined the wedding</span>
      </label>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="text-sm font-sans text-black">
            {matching.length} guest{matching.length === 1 ? '' : 's'}
          </div>
          <div className="truncate text-[11px] font-karla text-zinc-500">{label}</div>
        </div>
        <button
          type="button"
          disabled={matching.length === 0}
          onClick={() => onAdd(matching, label)}
          className="shrink-0 rounded-full bg-sage px-4 py-2 text-xs font-karla font-semibold text-white hover:bg-black disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors cursor-pointer"
        >
          Add {matching.length}
        </button>
      </div>
    </div>
  )
}
