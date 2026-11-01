'use client'

import { useState } from 'react'
import { ALGORITHMS } from '@/lib/seatingSolver/algorithms'
import { LabPlan } from '../types'
import { formatScore, formatSigned } from '../format'
import { Tip } from './ui'

interface PlansPanelProps {
  plans: LabPlan[]
  loadedPlanId: string | null
  currentScore: number
  scoreUnderCurrent: (plan: LabPlan) => number | null
  saving: boolean
  onSave: (name: string, overwriteId: string | null) => void
  onLoad: (plan: LabPlan) => void
  onDelete: (plan: LabPlan) => void
}

function sourceLabel(source: string) {
  const [base, edited] = source.split('+')
  const name = ALGORITHMS.find((a) => a.id === base)?.name ?? (base === 'MANUAL' ? 'Manual' : base)
  return edited ? `${name} + hand edits` : name
}

export default function PlansPanel({ plans, loadedPlanId, currentScore, scoreUnderCurrent, saving, onSave, onLoad, onDelete }: PlansPanelProps) {
  const [name, setName] = useState('')
  const loaded = plans.find((p) => p.id === loadedPlanId) ?? null

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(name, null)
          setName('')
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this seating…"
          className="flex-1 min-w-0 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Save new
        </button>
      </form>
      {loaded && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(loaded.name, loaded.id)}
          title="Replace the loaded plan with the seating on screen"
          className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs hover:border-black cursor-pointer disabled:opacity-40"
        >
          Save over “{loaded.name}”
        </button>
      )}

      {plans.length === 0 ? (
        <p className="text-xs text-zinc-400">No saved seatings yet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 -mx-1">
          {plans.map((plan) => {
            const now = scoreUnderCurrent(plan)
            return (
              <div key={plan.id} className={`px-1 py-2 ${plan.id === loadedPlanId ? 'bg-zinc-50 rounded-lg' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-black truncate">{plan.name}</div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {sourceLabel(plan.source)} · {new Date(plan.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <Tip
                    text="This plan's objective under the current weights, and how it compares with the seating on screen. “Saved at” is its score under the weights it was saved with"
                    align="right"
                    className="text-right shrink-0 cursor-help"
                  >
                    <div className="font-mono text-sm font-semibold">{now === null ? '—' : formatScore(now)}</div>
                    {now !== null && <div className={`text-[10px] font-mono ${now - currentScore >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSigned(now - currentScore)} vs screen</div>}
                  </Tip>
                </div>
                <div className="flex gap-3 mt-1 text-[11px]">
                  <button type="button" onClick={() => onLoad(plan)} className="text-zinc-600 hover:text-black cursor-pointer">
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(`Delete “${plan.name}”?`) && onDelete(plan)}
                    className="text-zinc-400 hover:text-red-600 cursor-pointer"
                  >
                    Delete
                  </button>
                  {plan.score !== null && <span className="ml-auto text-zinc-400 font-mono">saved at {formatScore(plan.score)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
