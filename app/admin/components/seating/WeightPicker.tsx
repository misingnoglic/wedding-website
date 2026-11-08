'use client'

import { formatWeight, SEATING_WEIGHTS } from '@/lib/seating'

interface WeightPickerProps {
  value: number | null // Set here; null takes `inherited`
  inherited: number // Shown faded when nothing is set here
  inheritedLabel: string // Where the faded weight comes from, for the tooltip
  onChange: (value: number | null) => void // Clicking the set weight again clears it
}

// How much a guest's (or group's) happiness counts in the Seating Lab's score
export default function WeightPicker({ value, inherited, inheritedLabel, onChange }: WeightPickerProps) {
  const shown = value ?? inherited
  return (
    <div className="inline-flex gap-1">
      {SEATING_WEIGHTS.map((w) => {
        const isSelected = w === shown
        return (
          <button
            key={w}
            type="button"
            title={
              isSelected && value === null
                ? `${formatWeight(w)} ${inheritedLabel}`
                : isSelected
                  ? 'Click again to clear'
                  : `Their happiness counts ${formatWeight(w)}`
            }
            onClick={() => onChange(w === value ? null : w)}
            className={`px-2 h-7 rounded-md border text-[11px] font-mono font-semibold transition-all cursor-pointer ${
              isSelected
                ? `bg-indigo-500 text-white border-indigo-500 ${value === null ? 'opacity-50 border-dashed' : ''}`
                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700'
            }`}
          >
            {formatWeight(w)}
          </button>
        )
      })}
    </div>
  )
}
