'use client'

import { useState } from 'react'
import { updateGuestAdmin } from '@/app/actions/admin'
import { FlatGuest, TITLE_OPTIONS, DIETARY_QUICK_CHIPS, HOTEL_QUICK_CHIPS } from '../../types'

interface EditGuestModalProps {
  guest: FlatGuest | null
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function EditGuestModal({
  guest,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: EditGuestModalProps) {
  const [dietaryValue, setDietaryValue] = useState(guest?.dietaryRestrictions || '')
  const [hotelValue, setHotelValue] = useState(guest?.hotelName || '')

  if (!guest) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-2xl w-full border border-zinc-200 shadow-2xl space-y-6 my-8">
        <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-sage font-medium font-sans">
              Party: {guest.familyName}
            </span>
            <h3 className="text-2xl font-sans text-black mt-0.5">Edit Guest & RSVP Overrides</h3>
            <p className="text-xs font-karla text-zinc-500">
              Update guest details, attendance statuses, flight numbers, or catering notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-black text-xl p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form
          action={async (formData) => {
            startTransition(async () => {
              const res = await updateGuestAdmin(null, formData)
              if (res?.error) {
                setActionFeedback({ error: res.error })
              } else {
                setActionFeedback({ success: res?.message })
                onClose()
              }
            })
          }}
          className="space-y-5 font-karla text-sm"
        >
          <input type="hidden" name="guestId" value={guest.id} />

          {/* Guest Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Title
              </label>
              <select
                name="title"
                defaultValue={guest.title || 'None'}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
              >
                {TITLE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Guest Name *
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={guest.name}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none font-medium"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                defaultValue={guest.email || ''}
                placeholder="guest@example.com"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                defaultValue={guest.phoneNumber || ''}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
              />
            </div>
          </div>

          {/* RSVP Statuses */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
            <h4 className="text-xs font-sans uppercase tracking-wider text-zinc-700 font-semibold">
              Event Attendance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">
                  Wedding Ceremony & Reception (Dec 12)
                </label>
                <select
                  name="isAttendingWedding"
                  defaultValue={
                    guest.isAttendingWedding === true ? 'true' : guest.isAttendingWedding === false ? 'false' : ''
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-sage font-medium"
                >
                  <option value="">Pending / Not Answered</option>
                  <option value="true">✓ Joyfully Accepts</option>
                  <option value="false">✕ Regretfully Declines</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-600 mb-1">Welcome Fiesta (Dec 11)</label>
                <select
                  name="isAttendingWelcome"
                  defaultValue={
                    guest.isAttendingWelcome === true ? 'true' : guest.isAttendingWelcome === false ? 'false' : ''
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-sage font-medium"
                >
                  <option value="">Pending / Not Answered</option>
                  <option value="true">✓ Attending</option>
                  <option value="false">✕ Declines</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dietary Restrictions */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500">
                Dietary Restrictions & Allergies
              </label>
            </div>
            <input
              type="text"
              name="dietaryRestrictions"
              value={dietaryValue}
              onChange={(e) => setDietaryValue(e.target.value)}
              placeholder="e.g. Vegetarian, Severe Peanut Allergy, Gluten Free"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DIETARY_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    if (chip === 'None') {
                      setDietaryValue('')
                    } else if (dietaryValue) {
                      setDietaryValue(`${dietaryValue}, ${chip}`)
                    } else {
                      setDietaryValue(chip)
                    }
                  }}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-[11px] font-karla transition-colors cursor-pointer"
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>

          {/* Accommodation */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Hotel / Accommodation
            </label>
            <input
              type="text"
              name="hotelName"
              value={hotelValue}
              onChange={(e) => setHotelValue(e.target.value)}
              placeholder="e.g. The Cape, A Thompson Hotel"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {HOTEL_QUICK_CHIPS.map((hotel) => (
                <button
                  key={hotel}
                  type="button"
                  onClick={() => setHotelValue(hotel)}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-[11px] font-karla transition-colors cursor-pointer"
                >
                  {hotel}
                </button>
              ))}
            </div>
          </div>

          {/* Travel & Flights */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
            <h4 className="text-xs font-sans uppercase tracking-wider text-zinc-700 font-semibold">
              Flight Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Arrival Flight (e.g. AA 1234)</label>
                <input
                  type="text"
                  name="arrivalFlightNumber"
                  defaultValue={guest.arrivalFlightNumber || ''}
                  placeholder="AA 1234"
                  className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono uppercase focus:border-sage outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Arrival Date (e.g. Dec 10)</label>
                <input
                  type="text"
                  name="arrivalDate"
                  defaultValue={guest.arrivalDate || ''}
                  placeholder="Dec 10, 2026"
                  className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:border-sage outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Departure Flight (e.g. UA 5678)</label>
                <input
                  type="text"
                  name="departureFlightNumber"
                  defaultValue={guest.departureFlightNumber || ''}
                  placeholder="UA 5678"
                  className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono uppercase focus:border-sage outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Departure Date (e.g. Dec 14)</label>
                <input
                  type="text"
                  name="departureDate"
                  defaultValue={guest.departureDate || ''}
                  placeholder="Dec 14, 2026"
                  className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:border-sage outline-none"
                />
              </div>
            </div>
          </div>

          {/* Song Requests */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Song Requests (for DJ)
            </label>
            <input
              type="text"
              name="songRequests"
              defaultValue={guest.songRequests || ''}
              placeholder="e.g. September - Earth, Wind & Fire"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-sans uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-black text-white rounded-xl text-xs font-sans uppercase tracking-wider hover:bg-sage transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Overrides'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
