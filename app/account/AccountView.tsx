'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { resetPassword, logoutFamily, updateFamilyName } from '@/app/actions/rsvp'

type Guest = {
  id: string
  title: string | null
  name: string
  email: string | null
  phoneNumber: string | null
  isAttendingWelcome: boolean | null
  isAttendingWedding: boolean | null
  dietaryRestrictions: string | null
  arrivalFlightNumber: string | null
  arrivalDate: string | null
  departureFlightNumber: string | null
  departureDate: string | null
  hotelName: string | null
  songRequests: string | null
}

type Family = {
  id: string
  name: string
  isAdmin?: boolean
  guests: Guest[]
}

export default function AccountView({ family }: { family: Family }) {
  const [state, formAction, isPending] = useActionState(resetPassword, null)
  const [familyNameState, updateFamilyNameAction, isFamilyNamePending] = useActionState(updateFamilyName, null)
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset()
    }
  }, [state])

  useEffect(() => {
    if (familyNameState?.success) {
      setIsEditingFamilyName(false)
    }
  }, [familyNameState])

  const attendingCount = family.guests.filter(g => g.isAttendingWedding === true).length
  const totalGuests = family.guests.length

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in space-y-8">
      {/* Top Header Card */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-zinc-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-sage font-medium font-sans">Family Account</span>
            {family.isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700">
                Admin
              </span>
            )}
          </div>
          
          {isEditingFamilyName ? (
            <form action={updateFamilyNameAction} className="mt-2 mb-2">
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  name="familyName"
                  defaultValue={family.name}
                  required
                  minLength={2}
                  className="px-3 py-1.5 border border-sage focus:ring-1 focus:ring-sage rounded-md font-sans text-2xl md:text-3xl text-black outline-none w-full bg-white shadow-sm"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isFamilyNamePending}
                  className="px-4 py-2 bg-black text-white text-xs font-sans uppercase tracking-wider rounded-md hover:bg-sage transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isFamilyNamePending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingFamilyName(false)}
                  className="px-3 py-2 text-zinc-500 hover:text-black text-xs font-sans uppercase tracking-wider rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              {familyNameState?.error && (
                <p className="text-xs text-red-600 font-karla mt-1">{familyNameState.error}</p>
              )}
            </form>
          ) : (
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <h2 className="text-3xl md:text-4xl font-sans text-black">{family.name}</h2>
              <button
                type="button"
                onClick={() => setIsEditingFamilyName(true)}
                className="text-xs font-karla text-zinc-400 hover:text-sage flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-zinc-100 border border-transparent hover:border-zinc-200 cursor-pointer"
                title="Edit family name"
              >
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                <span>Edit</span>
              </button>
            </div>
          )}

          <p className="text-zinc-500 font-karla mt-1">
            {totalGuests} {totalGuests === 1 ? 'guest' : 'guests'} in party •{' '}
            <span className="text-zinc-700 font-medium">
              {attendingCount > 0 ? `${attendingCount} attending wedding` : 'RSVP pending'}
            </span>
          </p>
          {familyNameState?.success && !isEditingFamilyName && (
            <p className="text-xs text-emerald-600 font-karla mt-1">✓ Family name updated successfully</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {family.isAdmin && (
            <Link
              href="/admin"
              className="flex-1 md:flex-none text-center px-5 py-2.5 bg-purple-950 text-white rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-black transition-all duration-300 shadow-sm flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Dashboard
            </Link>
          )}
          <Link
            href="/rsvp"
            className="flex-1 md:flex-none text-center px-5 py-2.5 bg-sage text-white rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-black transition-all duration-300 shadow-sm"
          >
            Go to RSVP
          </Link>
          <form action={() => logoutFamily('/login?redirect=/account')}>
            <button
              type="submit"
              className="px-4 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-zinc-200 hover:text-black transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Party Details */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
            <h3 className="text-lg font-sans text-black border-b border-zinc-100 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Party Members
            </h3>
            <ul className="divide-y divide-zinc-100 font-karla">
              {family.guests.map((guest) => (
                <li key={guest.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-medium text-black">
                    {guest.title && guest.title !== 'None' ? `${guest.title}. ` : ''}{guest.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        guest.isAttendingWedding === true
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : guest.isAttendingWedding === false
                          ? 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {guest.isAttendingWedding === true
                        ? 'Attending Wedding'
                        : guest.isAttendingWedding === false
                        ? 'Declined'
                        : 'RSVP Pending'}
                    </span>
                    {guest.isAttendingWelcome === true && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sage/15 text-zinc-700 border border-sage/30">
                        Welcome Party
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-sage/10 border border-sage/30 rounded-2xl p-6 text-sm font-karla text-zinc-700 space-y-2">
            <h4 className="font-medium text-black font-sans uppercase tracking-wider text-xs flex items-center gap-1.5">
              <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Need to update guest list?
            </h4>
            <p>
              If you have any questions or need to make adjustments to your party members, please contact us directly at{' '}
              <a href="mailto:aryaandchrista@gmail.com" className="text-sage hover:underline font-medium">
                aryaandchrista@gmail.com
              </a>.
            </p>
          </div>
        </div>

        {/* Right Column: Reset Password Section */}
        <div className="md:col-span-2">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-zinc-200/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-sage" />

            <div className="mb-6">
              <span className="text-xs uppercase tracking-widest text-sage font-medium font-sans">Security</span>
              <h3 className="text-2xl font-sans text-black mt-1">Reset Password</h3>
              <p className="text-zinc-500 font-karla text-sm mt-1">
                Choose a new family code to use for future logins.
              </p>
            </div>

            <form ref={formRef} action={formAction} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-800 mb-2">
                  New Password / Code
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    name="newPassword"
                    placeholder="Enter your new family password"
                    required
                    minLength={3}
                    className="w-full px-4 py-3 bg-zinc-50/80 border border-zinc-200 focus:border-sage focus:ring-1 focus:ring-sage rounded-xl font-karla outline-none transition-all text-black pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors p-1"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 font-karla">Minimum 3 characters (e.g. SMITH2026 or a memorable phrase).</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-800 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Re-enter your new password"
                    required
                    minLength={3}
                    className="w-full px-4 py-3 bg-zinc-50/80 border border-zinc-200 focus:border-sage focus:ring-1 focus:ring-sage rounded-xl font-karla outline-none transition-all text-black pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {state?.error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-karla text-center animate-fade-in flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{state.error}</span>
                </div>
              )}

              {state?.success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-karla text-center animate-fade-in flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{state.message}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3.5 bg-black text-white rounded-xl font-sans tracking-widest uppercase text-xs hover:bg-sage hover:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating Password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
