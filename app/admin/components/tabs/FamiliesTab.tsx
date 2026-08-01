'use client'

import { useState } from 'react'
import { impersonateFamilyAdmin } from '@/app/actions/admin'
import { FamilyWithGuests, FlatGuest } from '../../types'

interface FamiliesTabProps {
  families: FamilyWithGuests[]
  expandedFamilies: Set<string>
  toggleFamilyExpanded: (id: string) => void
  onOpenEditFamily: (family: FamilyWithGuests) => void
  onOpenDeleteFamily: (family: FamilyWithGuests) => void
  onOpenAddGuest: (family: FamilyWithGuests) => void
  onOpenEditGuest: (guest: FlatGuest) => void
  onOpenDeleteGuest: (guest: FlatGuest) => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function FamiliesTab({
  families,
  expandedFamilies,
  toggleFamilyExpanded,
  onOpenEditFamily,
  onOpenDeleteFamily,
  onOpenAddGuest,
  onOpenEditGuest,
  onOpenDeleteGuest,
  isPending,
  startTransition,
  setActionFeedback,
}: FamiliesTabProps) {
  const [copiedFamilyId, setCopiedFamilyId] = useState<string | null>(null)

  const copySmsInvite = (family: FamilyWithGuests) => {
    const text = `Hi ${family.name}! You're invited to celebrate Arya & Christa's wedding in Cabo! Please RSVP on our website: https://aryachristawedding.com/rsvp — Your Access Code: ${family.password}`
    navigator.clipboard.writeText(text)
    setCopiedFamilyId(family.id)
    setTimeout(() => setCopiedFamilyId(null), 2500)
  }

  if (families.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-zinc-200/80">
        <p className="text-zinc-500 font-karla text-sm">No families or guests match your active filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {families.map((family) => {
        const isExpanded = expandedFamilies.has(family.id)
        const attendingCount = family.guests.filter((g) => g.isAttendingWedding === true).length
        const declinedCount = family.guests.filter((g) => g.isAttendingWedding === false).length
        const pendingCount = family.guests.filter((g) => g.isAttendingWedding === null).length
        const hasDiets = family.guests.some((g) => g.dietaryRestrictions && g.dietaryRestrictions.trim().length > 0)
        const hasTravel = family.guests.some(
          (g) => g.arrivalFlightNumber || g.departureFlightNumber || g.hotelName
        )

        return (
          <div
            key={family.id}
            className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm transition-all duration-200 hover:border-zinc-300 overflow-hidden"
          >
            {/* Header Accordion Bar */}
            <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div
                className="flex items-start md:items-center gap-3 cursor-pointer flex-1 select-none"
                onClick={() => toggleFamilyExpanded(family.id)}
              >
                <button
                  type="button"
                  className="mt-1 md:mt-0 text-zinc-400 hover:text-black transition-transform duration-200 p-1"
                  aria-label="Toggle party view"
                >
                  <svg
                    className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-sans text-black tracking-tight">{family.name}</h3>
                    {family.isAdmin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-sans font-semibold bg-emerald-100 text-emerald-800">
                        Admin
                      </span>
                    )}
                    {hasDiets && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-sans font-semibold bg-amber-100 text-amber-800">
                        Dietary
                      </span>
                    )}
                    {hasTravel && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-sans font-semibold bg-sky-100 text-sky-800">
                        Travel Logged
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-karla text-zinc-500 mt-1">
                    <span>
                      Access Code:{' '}
                      <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-800 font-semibold">
                        {family.password}
                      </code>
                    </span>
                    <span>•</span>
                    <span>{family.guests.length} guest{family.guests.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>
                      Updated: {new Date(family.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Chips & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                <div className="flex items-center gap-1.5 text-xs font-karla mr-2">
                  {attendingCount > 0 && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg font-medium">
                      ✓ {attendingCount} Attending
                    </span>
                  )}
                  {declinedCount > 0 && (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-lg font-medium">
                      ✕ {declinedCount} Declined
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-lg font-medium">
                      ? {pendingCount} Pending
                    </span>
                  )}
                </div>

                {/* Impersonate / View RSVP */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await impersonateFamilyAdmin(family.id)
                      if (res?.error) setActionFeedback({ error: res.error })
                    })
                  }}
                  className="p-2 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors text-xs font-karla flex items-center gap-1 cursor-pointer"
                  title="Preview RSVP form as this family"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>View RSVP</span>
                </button>

                {/* Copy SMS Invite */}
                <button
                  type="button"
                  onClick={() => copySmsInvite(family)}
                  className="p-2 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors text-xs font-karla flex items-center gap-1 cursor-pointer"
                  title="Copy pre-formatted text message invite"
                >
                  {copiedFamilyId === family.id ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      ✓ Copied SMS!
                    </span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                      <span>Copy SMS</span>
                    </>
                  )}
                </button>

                {/* Edit Family Details */}
                <button
                  type="button"
                  onClick={() => onOpenEditFamily(family)}
                  className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit family name or access code"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>

                {/* Delete Family */}
                <button
                  type="button"
                  onClick={() => onOpenDeleteFamily(family)}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete family"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded Guests List */}
            {isExpanded && (
              <div className="border-t border-zinc-100 bg-zinc-50/50 p-5 md:p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-sans uppercase tracking-wider text-zinc-500 font-semibold">
                    Party Members ({family.guests.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAddGuest(family)}
                    className="text-xs font-sans uppercase tracking-wider text-sage hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Add Guest to Party
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {family.guests.map((guest) => {
                    const flatGuest: FlatGuest = {
                      ...guest,
                      familyName: family.name,
                      familyPassword: family.password,
                    }

                    return (
                      <div
                        key={guest.id}
                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3 relative group"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              {guest.title && guest.title !== 'None' && (
                                <span className="text-xs font-karla text-zinc-400 font-normal">
                                  {guest.title}.
                                </span>
                              )}
                              <h4 className="font-sans font-semibold text-black text-base">{guest.name}</h4>
                            </div>
                            <div className="text-xs font-karla text-zinc-500 flex flex-wrap gap-x-2 mt-0.5">
                              {guest.email && <span>{guest.email}</span>}
                              {guest.phoneNumber && <span>{guest.phoneNumber}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenEditGuest(flatGuest)}
                              className="px-2.5 py-1 text-xs font-karla text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer"
                            >
                              Edit RSVP
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDeleteGuest(flatGuest)}
                              className="p-1 text-zinc-300 hover:text-red-600 rounded cursor-pointer"
                              title="Remove guest"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Guest Attendance & Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-karla pt-2 border-t border-zinc-100">
                          <div>
                            <span className="text-zinc-400 block text-[11px]">Wedding (Dec 12)</span>
                            <span
                              className={`font-medium ${
                                guest.isAttendingWedding === true
                                  ? 'text-emerald-700'
                                  : guest.isAttendingWedding === false
                                  ? 'text-rose-700'
                                  : 'text-amber-600'
                              }`}
                            >
                              {guest.isAttendingWedding === true
                                ? '✓ Joyfully Accepts'
                                : guest.isAttendingWedding === false
                                ? '✕ Declines'
                                : 'Pending'}
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-400 block text-[11px]">Welcome (Dec 11)</span>
                            <span
                              className={`font-medium ${
                                guest.isAttendingWelcome === true
                                  ? 'text-emerald-700'
                                  : guest.isAttendingWelcome === false
                                  ? 'text-rose-700'
                                  : 'text-amber-600'
                              }`}
                            >
                              {guest.isAttendingWelcome === true
                                ? '✓ Attending'
                                : guest.isAttendingWelcome === false
                                ? '✕ Declines'
                                : 'Pending'}
                            </span>
                          </div>

                          {guest.dietaryRestrictions && (
                            <div className="col-span-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100 text-amber-900">
                              <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold block">
                                Dietary Requirements
                              </span>
                              <span>{guest.dietaryRestrictions}</span>
                            </div>
                          )}

                          {(guest.hotelName || guest.arrivalFlightNumber || guest.departureFlightNumber) && (
                            <div className="col-span-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100 text-zinc-700 space-y-0.5">
                              {guest.hotelName && (
                                <div>
                                  <span className="text-zinc-400">Hotel:</span> {guest.hotelName}
                                </div>
                              )}
                              {guest.arrivalFlightNumber && (
                                <div>
                                  <span className="text-zinc-400">Arrival:</span>{' '}
                                  <code className="font-mono text-xs">{guest.arrivalFlightNumber}</code>
                                  {guest.arrivalDate && ` (${guest.arrivalDate})`}
                                </div>
                              )}
                              {guest.departureFlightNumber && (
                                <div>
                                  <span className="text-zinc-400">Departure:</span>{' '}
                                  <code className="font-mono text-xs">{guest.departureFlightNumber}</code>
                                  {guest.departureDate && ` (${guest.departureDate})`}
                                </div>
                              )}
                            </div>
                          )}

                          {guest.songRequests && (
                            <div className="col-span-2 text-zinc-600">
                              <span className="text-zinc-400">DJ Request:</span> &ldquo;{guest.songRequests}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
