'use client'

import { AFFINITY_LABELS, AFFINITY_VALUES } from '@/lib/seating'

const FILLED: Record<number, string> = {
  [-3]: 'bg-rose-600 text-white border-rose-600',
  [-2]: 'bg-rose-400 text-white border-rose-400',
  [-1]: 'bg-rose-200 text-rose-900 border-rose-200',
  0: 'bg-zinc-300 text-zinc-800 border-zinc-300',
  1: 'bg-emerald-200 text-emerald-900 border-emerald-200',
  2: 'bg-emerald-400 text-white border-emerald-400',
  3: 'bg-emerald-600 text-white border-emerald-600',
}

export const formatAffinity = (value: number) => (value > 0 ? `+${value}` : `${value}`)

export function affinityClass(value: number) {
  return FILLED[value] || FILLED[0]
}

interface AffinityPickerProps {
  value: number
  // False when the value comes from a group/family baseline rather than an explicit rating
  isExplicit?: boolean
  onChange: (value: number) => void
  disabled?: boolean
}

export default function AffinityPicker({ value, isExplicit = true, onChange, disabled }: AffinityPickerProps) {
  return (
    <div className="inline-flex gap-1">
      {AFFINITY_VALUES.map((v) => {
        const isSelected = v === value
        return (
          <button
            key={v}
            type="button"
            title={AFFINITY_LABELS[v]}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`w-8 h-7 rounded-md border text-[11px] font-mono font-semibold transition-all cursor-pointer disabled:cursor-not-allowed ${
              isSelected
                ? `${affinityClass(v)} ${isExplicit ? '' : 'opacity-50 border-dashed'}`
                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700'
            }`}
          >
            {formatAffinity(v)}
          </button>
        )
      })}
    </div>
  )
}
