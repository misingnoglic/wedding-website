'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkEndpoint } from '@/lib/seating'

export const ENDPOINT_TYPE_LABELS: Record<LinkEndpoint['type'], string> = { group: 'Group', family: 'Party', guest: 'Guest' }
const TYPES = ['group', 'family', 'guest'] as const

export type EndpointOption = {
  key: string // endpointKey
  type: LinkEndpoint['type']
  name: string
  detail: string // Secondary line: member count, member names, or the guest's party
  color: string | null
}

interface EndpointPickerProps {
  options: EndpointOption[]
  value: string
  onChange: (key: string) => void
  // Keys that can't be picked (e.g. the other side of the link)
  disabledKeys?: Set<string>
}

export default function EndpointPicker({ options, value, onChange, disabledKeys }: EndpointPickerProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<LinkEndpoint['type'] | 'all'>('all')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.key === value)

  // Filtered results, grouped by type, names that start with the query first
  const sections = useMemo(() => {
    const q = query.toLowerCase().trim()
    return TYPES.filter((t) => typeFilter === 'all' || typeFilter === t)
      .map((type) => ({
        type,
        items: options
          .filter((o) => o.type === type && !disabledKeys?.has(o.key))
          .filter((o) => !q || o.name.toLowerCase().includes(q) || o.detail.toLowerCase().includes(q))
          .sort((a, b) => {
            const aStarts = q && a.name.toLowerCase().startsWith(q) ? 0 : 1
            const bStarts = q && b.name.toLowerCase().startsWith(q) ? 0 : 1
            return aStarts - bStarts || a.name.localeCompare(b.name)
          }),
      }))
      .filter((s) => s.items.length > 0)
  }, [options, query, typeFilter, disabledKeys])
  const flat = sections.flatMap((s) => s.items)

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const pick = (option: EndpointOption) => {
    onChange(option.key)
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && flat[activeIndex]) pick(flat[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  if (selected) {
    return (
      <div className="flex-1 min-w-0 flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2 bg-white">
        <EndpointBadge option={selected} />
        <span className="text-sm font-medium text-black truncate">{selected.name}</span>
        <span className="text-[11px] text-zinc-400 truncate hidden sm:inline">{selected.detail}</span>
        <button
          type="button"
          onClick={() => {
            onChange('')
            setTimeout(() => inputRef.current?.focus())
          }}
          className="ml-auto text-zinc-400 hover:text-black cursor-pointer shrink-0"
          aria-label="Clear"
        >
          ×
        </button>
      </div>
    )
  }

  let index = -1
  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search groups, parties, guests…"
        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white"
      />
      {isOpen && (
        // preventDefault on mousedown keeps focus in the input so clicks register before blur closes the list
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-30 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="flex gap-1 p-2 border-b border-zinc-100">
            {(['all', ...TYPES] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t)
                  setActiveIndex(0)
                }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] cursor-pointer ${
                  typeFilter === t ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {t === 'all' ? 'All' : `${ENDPOINT_TYPE_LABELS[t]}s`}
              </button>
            ))}
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {sections.length === 0 && <p className="px-3 py-4 text-xs text-zinc-400 text-center">No matches.</p>}
            {sections.map((section) => (
              <div key={section.type}>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                  {ENDPOINT_TYPE_LABELS[section.type]}s
                </div>
                {section.items.map((o) => {
                  index++
                  const i = index
                  return (
                    <button
                      key={o.key}
                      type="button"
                      data-index={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => pick(o)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer ${
                        i === activeIndex ? 'bg-zinc-100' : ''
                      }`}
                    >
                      <EndpointBadge option={o} />
                      <div className="min-w-0">
                        <div className="text-sm text-black truncate">{o.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{o.detail}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function EndpointBadge({ option }: { option: Pick<EndpointOption, 'type' | 'color'> }) {
  if (option.type === 'group') {
    return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.color || '#a1a1aa' }} />
  }
  return (
    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
      {ENDPOINT_TYPE_LABELS[option.type]}
    </span>
  )
}
