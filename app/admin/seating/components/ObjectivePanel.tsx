'use client'

import { autoLayout, DEFAULT_PROXIMITY, LayoutConfig, ProximityWeights, seatCount } from '@/lib/seatingSolver/layout'
import { DEFAULT_OBJECTIVE, Fairness, ObjectiveConfig } from '@/lib/seatingSolver/problem'
import { Collapsible, Label, NumberField, Segmented, Slider, Tip } from './ui'

type Preset = { id: string; label: string; description: string; apply: (o: ObjectiveConfig) => ObjectiveConfig }

const PRESETS: Preset[] = [
  {
    id: 'neighbors',
    label: 'Neighbors matter',
    description: 'The default: who you sit beside and across from counts most.',
    apply: (o) => ({ ...o, proximity: DEFAULT_PROXIMITY, headBonus: 0, minKnownAtTable: 0 }),
  },
  {
    id: 'honor',
    label: 'Heads of honor',
    description: 'Heads reach further down the table and favor well-loved guests, so heads stop being a parking spot.',
    apply: (o) => ({ ...o, proximity: { ...DEFAULT_PROXIMITY, headCorner: 1, headSecondRow: 0.4 }, headBonus: 0.15 }),
  },
  {
    id: 'table',
    label: 'Table-level',
    description: 'Bellows & Peterson (2012): everyone at a table counts equally, and everyone should know at least one person there.',
    apply: (o) => ({
      ...o,
      proximity: { side: 1, across: 1, diagonal: 1, headCorner: 1, headSecondRow: 1, sameTable: 1 },
      headBonus: 0,
      minKnownAtTable: 1,
    }),
  },
  {
    id: 'elbows',
    label: 'Elbows only',
    description: 'Only immediate neighbors count. Conversations rarely reach past the next seat.',
    apply: (o) => ({ ...o, proximity: { side: 1, across: 0.5, diagonal: 0, headCorner: 1, headSecondRow: 0, sameTable: 0 } }),
  },
]

const WEIGHTS: { key: keyof ProximityWeights; label: string; help: string }[] = [
  { key: 'side', label: 'Side by side', help: 'How much the guests to your left and right count toward your happiness' },
  { key: 'across', label: 'Directly across', help: 'How much the guest facing you counts' },
  { key: 'diagonal', label: 'Diagonal', help: 'How much the guests across and one seat over count' },
  { key: 'headCorner', label: 'Head ↔ corner', help: 'How much a head seat and the two corner seats beside it count for each other' },
  { key: 'headSecondRow', label: 'Head ↔ second row', help: 'How much a head seat and the next seats in from the corners count for each other. Raise it so heads aren’t cut off from the table' },
  { key: 'sameTable', label: 'Same table', help: 'How much everyone else at your table counts, however far away. Guests at the other table never count' },
]

interface ObjectivePanelProps {
  objective: ObjectiveConfig
  onObjectiveChange: (objective: ObjectiveConfig) => void
  layout: LayoutConfig
  onLayoutChange: (layout: LayoutConfig) => void
  guestCount: number
  onSaveDefaults: () => void
  savingDefaults: boolean
}

export default function ObjectivePanel({
  objective,
  onObjectiveChange,
  layout,
  onLayoutChange,
  guestCount,
  onSaveDefaults,
  savingDefaults,
}: ObjectivePanelProps) {
  const set = (patch: Partial<ObjectiveConfig>) => onObjectiveChange({ ...objective, ...patch })
  const setWeight = (key: keyof ProximityWeights, value: number) => set({ proximity: { ...objective.proximity, [key]: value } })
  const seats = seatCount(layout)
  const activePreset = PRESETS.find((p) => JSON.stringify(p.apply(objective)) === JSON.stringify(objective))

  return (
    <>
      <Collapsible
        title="Proximity weights"
        help="A guest's happiness is the sum, over everyone they have a rating with, of rating × the weight for where that person sits relative to them. These sliders set those weights."
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p, i) => (
            <Tip key={p.id} text={p.description} className="flex" align={i % 2 === 0 ? 'left' : 'right'}>
              <button
                type="button"
                onClick={() => onObjectiveChange(p.apply(objective))}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs border cursor-pointer text-left ${
                  activePreset?.id === p.id ? 'bg-black text-white border-black' : 'bg-white text-zinc-600 border-zinc-200 hover:border-black'
                }`}
              >
                {p.label}
              </button>
            </Tip>
          ))}
        </div>
        {WEIGHTS.map((w) => (
          <Slider
            key={w.key}
            label={w.label}
            help={w.help}
            value={objective.proximity[w.key]}
            min={0}
            max={1.5}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => setWeight(w.key, v)}
          />
        ))}
      </Collapsible>

      <Collapsible title="Fairness & modifiers" help="How individual happiness adds up to the objective the algorithms maximize, plus extra rewards and penalties.">
        <Label
          className="text-xs text-zinc-600"
          text="Fairness"
          help="Total just adds up everyone's happiness, so one guest can be sacrificed for the group. Floor and Diminishing protect the least happy guests."
        />
        <Segmented<Fairness>
          value={objective.fairness}
          onChange={(fairness) => set({ fairness })}
          options={[
            { value: 'sum', label: 'Total', title: 'Maximize total happiness, whoever it goes to' },
            { value: 'floor', label: 'Floor', title: 'Total happiness, minus a penalty for every point a guest falls below the minimum' },
            { value: 'concave', label: 'Diminishing', title: 'Each extra point matters less for already-happy guests, so lifting an unhappy guest is worth more' },
          ]}
        />
        {objective.fairness === 'floor' && (
          <>
            <Slider label="Minimum happiness" help="Everyone should reach at least this happiness. Also sets the “Below” count in the header" value={objective.minHappiness} min={0} max={8} step={0.5} onChange={(v) => set({ minHappiness: v })} format={(v) => v.toFixed(1)} />
            <Slider label="Penalty per point below" help="Cost of each point a guest falls under the minimum, on top of the point itself" value={objective.floorPenalty} min={0} max={20} step={0.5} onChange={(v) => set({ floorPenalty: v })} format={(v) => v.toFixed(1)} />
          </>
        )}
        <Slider
          label="Head bonus"
          help="Reward for seating well-loved guests at a head: this × the sum of all their positive ratings. Keeps heads from becoming a parking spot for guests with few ties"
          value={objective.headBonus}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(v) => set({ headBonus: v })}
          format={(v) => v.toFixed(2)}
        />
        <Slider
          label="Know at least N at their table"
          help="Bellows & Peterson's b: penalize guests who know fewer than N people (rated +1 or better) at their table. 0 turns it off"
          value={objective.minKnownAtTable}
          min={0}
          max={6}
          step={1}
          onChange={(v) => set({ minKnownAtTable: v })}
        />
        {objective.minKnownAtTable > 0 && (
          <Slider label="Penalty per missing person" help="Cost for each acquaintance a guest is short of N" value={objective.minKnownPenalty} min={0} max={20} step={0.5} onChange={(v) => set({ minKnownPenalty: v })} format={(v) => v.toFixed(1)} />
        )}
        <Slider
          label="Hard constraint penalty"
          help="Cost of each broken must-sit-next-to, not-next-to, same/different table, or must-sit-at-a-head rule. Keep it high so algorithms treat rules as hard"
          value={objective.constraintPenalty}
          min={0}
          max={200}
          step={5}
          onChange={(v) => set({ constraintPenalty: v })}
        />
        <label className="flex items-center justify-between gap-3 text-xs">
          <Label
            text="Parties of two sit together"
            help="Treat the two guests of a party with exactly two seated guests (usually a couple) as must-sit-next-to. An explicit constraint on the pair, set in Guest Ratings, overrides this"
          />
          <input
            type="checkbox"
            checked={objective.partyPairsAdjacent}
            onChange={(e) => set({ partyPairsAdjacent: e.target.checked })}
            className="accent-black"
          />
        </label>
        <button
          type="button"
          title="Put every fairness, modifier and proximity setting back to the defaults"
          onClick={() => onObjectiveChange({ ...DEFAULT_OBJECTIVE })}
          className="text-xs text-zinc-400 hover:text-black cursor-pointer"
        >
          Reset to defaults
        </button>
      </Collapsible>

      <Collapsible title="Tables" help="The shape of the room. Changing it stops any run; guests keep their seats where those still exist." defaultOpen={false}>
        <NumberField label="Tables" help="Long tables. Guests at different tables never affect each other" value={layout.tables} min={1} max={8} step={1} onChange={(tables) => onLayoutChange({ ...layout, tables })} />
        <NumberField label="Seats per side" help="Seats along each long side of every table, not counting heads" value={layout.seatsPerSide} min={1} max={40} step={1} onChange={(seatsPerSide) => onLayoutChange({ ...layout, seatsPerSide })} />
        <label className="flex items-center justify-between text-xs text-zinc-600">
          <Label text="Head seats at both ends" help="One seat at each end of every table. Guests who must sit at a head need these" />
          <input type="checkbox" checked={layout.heads} onChange={(e) => onLayoutChange({ ...layout, heads: e.target.checked })} className="accent-black" />
        </label>
        <div className={`text-xs ${seats < guestCount ? 'text-red-700' : 'text-zinc-500'}`}>
          {seats} seats for {guestCount} guests{seats < guestCount ? ' — not enough seats' : ''}
        </div>
        <button
          type="button"
          title="Use the fewest seats per side that still fit everyone"
          onClick={() => onLayoutChange(autoLayout(guestCount, layout.tables, layout.heads))}
          className="text-xs text-zinc-500 hover:text-black cursor-pointer"
        >
          Fit seats to guests
        </button>
      </Collapsible>

      <button
        type="button"
        onClick={onSaveDefaults}
        disabled={savingDefaults}
        title="Store these weights, modifiers and tables so the Lab opens with them next time"
        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-600 hover:border-black hover:text-black cursor-pointer disabled:opacity-50"
      >
        {savingDefaults ? 'Saving…' : 'Save weights & tables as defaults'}
      </button>
    </>
  )
}
