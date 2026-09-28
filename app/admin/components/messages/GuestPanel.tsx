'use client'

import { useState } from 'react'
import { formatPhoneNumber, getPhoneKey } from '@/lib/phone'
import { FlatGuest } from '../../types'
import GuestSearch from './GuestSearch'
import { Icon, ICONS, Spinner } from './ui'

interface GuestPanelProps {
  phone: string
  guests: FlatGuest[] // Guests whose phone matches this conversation
  allGuests: FlatGuest[]
  onClose?: () => void // Shown when the panel is an overlay
  onEditGuest: (guest: FlatGuest) => void
  onTextGuest: (guest: FlatGuest) => void
  onAssign: (guest: FlatGuest) => Promise<void>
}

function Rsvp({ value }: { value: boolean | null }) {
  if (value === true) return <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-semibold text-[#5f6b4c]">Yes</span>
  if (value === false) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">No</span>
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">Pending</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-xs font-karla text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-xs font-karla text-zinc-900 text-right min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-zinc-100">
      <h4 className="mb-2 text-[11px] font-sans uppercase tracking-wider text-zinc-400">{title}</h4>
      {children}
    </section>
  )
}

export default function GuestPanel({ phone, guests, allGuests, onClose, onEditGuest, onTextGuest, onAssign }: GuestPanelProps) {
  const [copied, setCopied] = useState(false)
  const [pendingAssign, setPendingAssign] = useState<FlatGuest | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const phoneKey = getPhoneKey(phone)
  const primary = guests[0]
  const familyMembers = primary
    ? allGuests.filter((g) => g.familyId === primary.familyId && !guests.some((c) => c.id === g.id))
    : []

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirmAssign = async (guest: FlatGuest) => {
    setIsAssigning(true)
    await onAssign(guest)
    setIsAssigning(false)
    setPendingAssign(null)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <h3 className="text-sm font-sans font-semibold text-black">{guests.length > 1 ? 'Guests on this number' : 'Guest details'}</h3>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close details" className="h-9 w-9 -mr-2 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100">
            <Icon path={ICONS.close} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {guests.length === 0 ? (
          <Section title="Unknown number">
            <p className="text-sm font-karla text-zinc-600">
              {formatPhoneNumber(phone) || phone} isn&apos;t on any guest. Assign it to link this conversation and save the number.
            </p>
            <div className="mt-3">
              {pendingAssign ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <p className="text-xs font-karla text-amber-900">
                    Replace {pendingAssign.name}&apos;s number {formatPhoneNumber(pendingAssign.phoneNumber)} with{' '}
                    {formatPhoneNumber(phone) || phone}?
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => confirmAssign(pendingAssign)} disabled={isAssigning} className="flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-xs font-karla text-white cursor-pointer">
                      {isAssigning && <Spinner className="w-3 h-3" />} Replace
                    </button>
                    <button type="button" onClick={() => setPendingAssign(null)} className="rounded-full px-3 py-1.5 text-xs font-karla text-zinc-600 hover:bg-white cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isAssigning ? (
                <div className="flex items-center gap-2 text-xs font-karla text-zinc-500">
                  <Spinner className="w-3.5 h-3.5" /> Linking…
                </div>
              ) : (
                <GuestSearch
                  guests={allGuests}
                  placeholder="Assign to a guest"
                  onPick={(guest) => {
                    // Confirm before overwriting a different existing number
                    if (guest.phoneNumber && getPhoneKey(guest.phoneNumber) !== phoneKey) setPendingAssign(guest)
                    else confirmAssign(guest)
                  }}
                />
              )}
            </div>
          </Section>
        ) : (
          guests.map((guest) => (
            <div key={guest.id}>
              <Section title={guest.familyName}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-sans text-black">{guest.title ? `${guest.title} ` : ''}{guest.name}</div>
                    <div className="text-xs font-karla text-zinc-500">{guest.hasLoggedIn ? 'Has logged in' : 'Never logged in'}</div>
                  </div>
                  <button type="button" onClick={() => onEditGuest(guest)} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-karla text-zinc-600 hover:border-sage hover:text-black cursor-pointer">
                    Edit
                  </button>
                </div>
                {guest.familyPassword && (
                  <button type="button" onClick={() => copyCode(guest.familyPassword!)} className="mt-3 w-full flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs font-karla hover:bg-zinc-100 cursor-pointer">
                    <span className="text-zinc-500">Invite code</span>
                    <span className="font-mono text-black">{copied ? 'Copied!' : guest.familyPassword}</span>
                  </button>
                )}
              </Section>

              <Section title="RSVP">
                <dl>
                  <Row label="Wedding"><Rsvp value={guest.isAttendingWedding} /></Row>
                  <Row label="Welcome party"><Rsvp value={guest.isAttendingWelcome} /></Row>
                  {guest.isRehearsalDinnerInvited && (
                    <Row label="Rehearsal dinner"><Rsvp value={guest.isAttendingRehearsalDinner} /></Row>
                  )}
                </dl>
              </Section>

              <Section title="Travel & details">
                <dl>
                  <Row label="Hotel">{guest.hotelName || <span className="text-zinc-400">Not given</span>}</Row>
                  <Row label="Arrival">
                    {guest.arrivalFlightNumber ? `${guest.arrivalFlightNumber}${guest.arrivalDate ? ` · ${guest.arrivalDate}` : ''}` : <span className="text-zinc-400">—</span>}
                  </Row>
                  <Row label="Departure">
                    {guest.departureFlightNumber ? `${guest.departureFlightNumber}${guest.departureDate ? ` · ${guest.departureDate}` : ''}` : <span className="text-zinc-400">—</span>}
                  </Row>
                  <Row label="Dietary">{guest.dietaryRestrictions || <span className="text-zinc-400">None</span>}</Row>
                  {guest.email && <Row label="Email">{guest.email}</Row>}
                  {guest.songRequests && <Row label="Song">{guest.songRequests}</Row>}
                </dl>
              </Section>
            </div>
          ))
        )}

        {familyMembers.length > 0 && (
          <Section title="Also in this family">
            <ul className="space-y-1">
              {familyMembers.map((member) => (
                <li key={member.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-sans text-black">{member.name}</div>
                    <div className="text-[11px] font-karla text-zinc-500">
                      {member.phoneNumber ? formatPhoneNumber(member.phoneNumber) : 'No phone'}
                    </div>
                  </div>
                  <Rsvp value={member.isAttendingWedding} />
                  {member.phoneNumber && getPhoneKey(member.phoneNumber) !== phoneKey && (
                    <button type="button" onClick={() => onTextGuest(member)} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-karla text-zinc-700 hover:bg-sage hover:text-white cursor-pointer">
                      Text
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
