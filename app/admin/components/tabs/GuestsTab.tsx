'use client'

import { FlatGuest } from '../../types'

interface GuestsTabProps {
  guests: FlatGuest[]
  onOpenEditGuest: (guest: FlatGuest) => void
  onOpenDeleteGuest: (guest: FlatGuest) => void
}

export default function GuestsTab({
  guests,
  onOpenEditGuest,
  onOpenDeleteGuest,
}: GuestsTabProps) {
  if (guests.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-zinc-200/80">
        <p className="text-zinc-500 font-karla text-sm">No guests match your active search filters.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-karla">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-sans uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Guest</th>
              <th className="py-3.5 px-4 font-semibold">Party</th>
              <th className="py-3.5 px-4 font-semibold">Wedding (Dec 12)</th>
              <th className="py-3.5 px-4 font-semibold">Welcome (Dec 11)</th>
              <th className="py-3.5 px-4 font-semibold">Dietary</th>
              <th className="py-3.5 px-4 font-semibold">Hotel & Flights</th>
              <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {guests.map((g) => (
              <tr key={g.id} className="hover:bg-zinc-50/80 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-black text-sm">
                    {g.title && g.title !== 'None' ? `${g.title}. ` : ''}
                    {g.name}
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    {g.email && <span>{g.email}</span>}
                    {g.phoneNumber && <span className="ml-2">{g.phoneNumber}</span>}
                  </div>
                </td>
                <td className="py-3 px-4 font-medium text-zinc-700">{g.familyName}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      g.isAttendingWedding === true
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : g.isAttendingWedding === false
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {g.isAttendingWedding === true
                      ? '✓ Attending'
                      : g.isAttendingWedding === false
                      ? '✕ Declined'
                      : '? Pending'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      g.isAttendingWelcome === true
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : g.isAttendingWelcome === false
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {g.isAttendingWelcome === true
                      ? '✓ Attending'
                      : g.isAttendingWelcome === false
                      ? '✕ Declined'
                      : '? Pending'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {g.dietaryRestrictions ? (
                    <span className="text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded text-[11px] font-medium">
                      {g.dietaryRestrictions}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-zinc-600 space-y-0.5">
                  {g.hotelName && <div className="truncate max-w-[160px]">🏨 {g.hotelName}</div>}
                  {(g.arrivalFlightNumber || g.departureFlightNumber) && (
                    <div className="font-mono text-[10px] text-zinc-500">
                      ✈ {g.arrivalFlightNumber || '—'} / {g.departureFlightNumber || '—'}
                    </div>
                  )}
                  {!g.hotelName && !g.arrivalFlightNumber && !g.departureFlightNumber && (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEditGuest(g)}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors cursor-pointer"
                    >
                      Edit RSVP
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDeleteGuest(g)}
                      className="p-1 text-zinc-300 hover:text-red-600 rounded cursor-pointer"
                      title="Remove guest"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
