'use client'

import { useState, useTransition } from 'react'
import { FlatGuest } from '../../types'
import { updateGuestPredictions, bulkUpdatePredictions } from '../../../actions/admin'

interface PredictionsTabProps {
  guests: FlatGuest[]
}

export default function PredictionsTab({ guests }: PredictionsTabProps) {
  const [onlyUnresponded, setOnlyUnresponded] = useState(false)
  const [onlyUnpredicted, setOnlyUnpredicted] = useState(false)
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Derived state
  const displayedGuests = guests.filter((g) => {
    let show = true
    if (onlyUnresponded) {
      const hasUnresponded = g.isAttendingWedding === null || g.isAttendingWelcome === null || (g.isRehearsalDinnerInvited && g.isAttendingRehearsalDinner === null)
      if (!hasUnresponded) show = false
    }
    if (onlyUnpredicted) {
      const hasUnpredicted = g.predictedIsAttendingWedding == null || g.predictedIsAttendingWelcome == null || (g.isRehearsalDinnerInvited && g.predictedIsAttendingRehearsalDinner == null)
      if (!hasUnpredicted) show = false
    }
    return show
  })

  const handlePredictionChange = (
    guestId: string,
    field: 'predictedIsAttendingWedding' | 'predictedIsAttendingWelcome' | 'predictedIsAttendingRehearsalDinner',
    val: boolean | null
  ) => {
    startTransition(async () => {
      await updateGuestPredictions(guestId, { [field]: val })
    })
  }

  const handleBulkUpdateAll = (val: boolean | null) => {
    if (selectedGuestIds.size === 0) return
    startTransition(async () => {
      await bulkUpdatePredictions(Array.from(selectedGuestIds), {
        predictedIsAttendingWedding: val,
        predictedIsAttendingWelcome: val,
        predictedIsAttendingRehearsalDinner: val
      })
      setSelectedGuestIds(new Set())
    })
  }

  const toggleSelectAll = () => {
    if (selectedGuestIds.size === displayedGuests.length && displayedGuests.length > 0) {
      setSelectedGuestIds(new Set())
    } else {
      setSelectedGuestIds(new Set(displayedGuests.map(g => g.id)))
    }
  }

  const toggleSelectGuest = (guestId: string) => {
    const newSet = new Set(selectedGuestIds)
    if (newSet.has(guestId)) {
      newSet.delete(guestId)
    } else {
      newSet.add(guestId)
    }
    setSelectedGuestIds(newSet)
  }

  const renderPredictionSelect = (
    guest: FlatGuest,
    field: 'predictedIsAttendingWedding' | 'predictedIsAttendingWelcome' | 'predictedIsAttendingRehearsalDinner',
    actualField: 'isAttendingWedding' | 'isAttendingWelcome' | 'isAttendingRehearsalDinner',
    disabled: boolean = false
  ) => {
    const predictedValue = guest[field]
    const actualValue = guest[actualField]
    const isMismatch = actualValue != null && predictedValue != null && actualValue !== predictedValue

    return (
      <div className="flex flex-col gap-1">
        <select
          disabled={disabled || isPending}
          value={predictedValue === true ? 'yes' : predictedValue === false ? 'no' : 'null'}
          onChange={(e) => {
            const val = e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null
            handlePredictionChange(guest.id, field, val)
          }}
          className={`border rounded px-2 py-1 text-xs w-24 ${isMismatch ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-zinc-200'}`}
        >
          <option value="null">None</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        {isMismatch && (
          <span className="text-[10px] text-rose-600 font-semibold leading-tight">
            ⚠️ Mismatch<br/>(Actual: {actualValue ? 'Yes' : 'No'})
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={onlyUnresponded}
              onChange={(e) => setOnlyUnresponded(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Only show guests who haven't RSVP'd
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={onlyUnpredicted}
              onChange={(e) => setOnlyUnpredicted(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Only show guests missing predictions
          </label>
        </div>

        {selectedGuestIds.size > 0 && (
          <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-lg border border-zinc-200 text-sm">
            <span className="font-semibold text-zinc-700">{selectedGuestIds.size} selected</span>
            <div className="h-4 w-px bg-zinc-300"></div>
            
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500">Bulk Predict:</span>
              <select
                className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white cursor-pointer"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const val = e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null;
                  handleBulkUpdateAll(val);
                  e.target.value = ""; // reset
                }}
                defaultValue=""
                disabled={isPending}
              >
                <option value="" disabled>Select action...</option>
                <option value="yes">Yes to all events</option>
                <option value="no">No to all events</option>
                <option value="null">Clear all predictions</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-karla">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-sans uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold w-10">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300 cursor-pointer"
                    checked={displayedGuests.length > 0 && selectedGuestIds.size === displayedGuests.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3.5 px-4 font-semibold">Guest</th>
                <th className="py-3.5 px-4 font-semibold">Party</th>
                <th className="py-3.5 px-4 font-semibold">Wedding Predict</th>
                <th className="py-3.5 px-4 font-semibold">Welcome Predict</th>
                <th className="py-3.5 px-4 font-semibold">Rehearsal Predict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {displayedGuests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No guests match current filters.
                  </td>
                </tr>
              ) : (
                displayedGuests.map((g) => (
                  <tr key={g.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 cursor-pointer"
                        checked={selectedGuestIds.has(g.id)}
                        onChange={() => toggleSelectGuest(g.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-black text-sm">
                        {g.title && g.title !== 'None' ? `${g.title}. ` : ''}
                        {g.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-700">{g.familyName}</td>
                    <td className="py-3 px-4">
                      {renderPredictionSelect(g, 'predictedIsAttendingWedding', 'isAttendingWedding')}
                    </td>
                    <td className="py-3 px-4">
                      {renderPredictionSelect(g, 'predictedIsAttendingWelcome', 'isAttendingWelcome')}
                    </td>
                    <td className="py-3 px-4">
                      {renderPredictionSelect(
                        g,
                        'predictedIsAttendingRehearsalDinner',
                        'isAttendingRehearsalDinner',
                        !g.isRehearsalDinnerInvited
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
