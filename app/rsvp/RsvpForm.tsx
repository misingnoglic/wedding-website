'use client'

import { useTransition, useRef, useState } from 'react'
import { updateRsvp, logoutFamily } from '@/app/actions/rsvp'

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
  guests: Guest[]
}

const TITLE_OPTIONS = ['None', 'Mr', 'Mrs', 'Ms', 'Dr']
const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten Free (Celiac)', 'Kosher (Certified)', 'Kids']

const normalizeFlightInput = (fn: string): string => {
  if (!fn) return ''
  let val = fn.trim().toUpperCase()
  if (!val) return ''

  val = val.replace(/^(?:FLIGHT|FLT|NO\.?)\s*/i, '')
  val = val.replace(/#/g, '')
  val = val.trim()

  const airlineMap: [RegExp, string][] = [
    [/^(?:AMERICAN\s*AIRLINES|AMERICAN)\s*/i, 'AA '],
    [/^(?:DELTA\s*AIR\s*LINES|DELTA\s*AIRLINES|DELTA)\s*/i, 'DL '],
    [/^(?:UNITED\s*AIRLINES|UNITED)\s*/i, 'UA '],
    [/^(?:SOUTHWEST\s*AIRLINES|SOUTHWEST)\s*/i, 'WN '],
    [/^(?:ALASKA\s*AIRLINES|ALASKA)\s*/i, 'AS '],
    [/^(?:JETBLUE\s*AIRWAYS|JET\s*BLUE|JETBLUE)\s*/i, 'B6 '],
    [/^(?:SPIRIT\s*AIRLINES|SPIRIT)\s*/i, 'NK '],
    [/^(?:FRONTIER\s*AIRLINES|FRONTIER)\s*/i, 'F9 '],
    [/^(?:AEROMEXICO|AERO\s*MEXICO)\s*/i, 'AM '],
    [/^(?:VOLARIS)\s*/i, 'Y4 '],
    [/^(?:VIVA\s*AEROBUS|VIVAAEROBUS|VIVA)\s*/i, 'VB '],
    [/^(?:AIR\s*CANADA)\s*/i, 'AC '],
    [/^(?:WESTJET|WEST\s*JET)\s*/i, 'WS '],
  ]

  for (const [regex, code] of airlineMap) {
    if (regex.test(val)) {
      val = val.replace(regex, code)
      break
    }
  }

  const match = val.match(/^([A-Z0-9]{2,3})\s*(\d+)$/i)
  if (match) {
    val = `${match[1].toUpperCase()} ${match[2]}`
  } else {
    val = val.replace(/\s+/g, ' ')
  }

  return val
}

const normalizePhoneInput = (val: string): string => {
  const trimmed = val.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\s+/g, ' ').trim()
  }
  return trimmed
}

const normalizeEmailInput = (val: string): string => {
  return val.trim().toLowerCase()
}

const normalizeHotelInput = (val: string): string => {
  const trimmed = val.trim()
  if (!trimmed) return ''

  if (/\bcape\b/i.test(trimmed)) return 'The Cape'
  if (/\bsun\s*rock\b/i.test(trimmed)) return 'Sunrock Hotel'
  if (/\bpueblo\s*bonito\b/i.test(trimmed) || /\bpb\s*ros[eé]\b/i.test(trimmed)) return 'Pueblo Bonito Rosé'
  if (/\b(?:airbnb|air\s*bnb|vrbo)\b/i.test(trimmed)) return 'Airbnb / Villa'
  if (/\bgrand\s*velas\b/i.test(trimmed)) return 'Grand Velas'
  if (/\bhacienda\b/i.test(trimmed)) return 'Hacienda Beach Club'

  return trimmed
}

export default function RsvpForm({ family }: { family: Family }) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<{ error?: string, success?: boolean, message?: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [guestTitles, setGuestTitles] = useState<Record<string, string>>(() => {
    const titles: Record<string, string> = {}
    family.guests.forEach(g => {
      titles[g.id] = g.title || 'None'
    })
    return titles
  })

  const [guestNames, setGuestNames] = useState<Record<string, string>>(() => {
    const names: Record<string, string> = {}
    family.guests.forEach(g => {
      names[g.id] = g.name
    })
    return names
  })
  const [editingNames, setEditingNames] = useState<Record<string, boolean>>({})

  const [guestState, setGuestState] = useState(() => {
    const initialState: Record<string, {
      isAttendingWelcome: boolean | null,
      isAttendingWedding: boolean | null,
      arrivalDate: string,
      departureDate: string,
      dietaryType: string,
      dietaryText: string,
      hasBookedTravel: boolean | null,
    }> = {}

    family.guests.forEach(g => {
      let dType = 'None'
      let dText = ''
      if (g.dietaryRestrictions) {
        const d = g.dietaryRestrictions.trim()
        const matched = DIETARY_OPTIONS.find(opt => opt.toLowerCase() === d.toLowerCase())
        if (matched) {
          dType = matched
        } else if (d.toLowerCase() !== 'none' && d !== '') {
          dType = 'Other'
          dText = d
        }
      }

      initialState[g.id] = {
        isAttendingWelcome: g.isAttendingWelcome,
        isAttendingWedding: g.isAttendingWedding,
        arrivalDate: g.arrivalDate || '2026-12-10',
        departureDate: g.departureDate || '2026-12-13',
        dietaryType: dType,
        dietaryText: dText,
        hasBookedTravel: (g.arrivalFlightNumber || g.departureFlightNumber || g.hotelName) ? true : null,
      }
    })
    return initialState
  })

  const handleAutoSave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (formRef.current) {
        formRef.current.requestSubmit()
      }
    }, 1500)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateRsvp(null, formData)
      setState(result as any)
    })
  }

  const resetGuest = (guestId: string) => {
    setGuestState(prev => ({
      ...prev,
      [guestId]: {
        isAttendingWelcome: null,
        isAttendingWedding: null,
        arrivalDate: '2026-12-10',
        departureDate: '2026-12-13',
        dietaryType: 'None',
        dietaryText: '',
        hasBookedTravel: null,
      }
    }))

    if (formRef.current) {
      const form = formRef.current
      const fields = [
        `email_${guestId}`,
        `phoneNumber_${guestId}`,
        `songRequests_${guestId}`,
        `arrivalFlightNumber_${guestId}`,
        `departureFlightNumber_${guestId}`,
        `hotelName_${guestId}`,
      ]
      fields.forEach(name => {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
        if (el) el.value = ''
      })
    }

    handleAutoSave()
  }

  const copyTravelInfoToAll = (sourceGuestId: string) => {
    if (!formRef.current) return
    const form = formRef.current

    const fieldsToCopy = [
      'arrivalFlightNumber',
      'arrivalDate',
      'departureFlightNumber',
      'departureDate',
      'hotelName'
    ]

    const sourceValues = fieldsToCopy.reduce((acc, field) => {
      const input = form.elements.namedItem(`${field}_${sourceGuestId}`) as HTMLInputElement
      if (input) {
        let val = input.value
        if (field === 'hotelName') {
          val = normalizeHotelInput(val)
          input.value = val
        } else if (field === 'arrivalFlightNumber' || field === 'departureFlightNumber') {
          val = normalizeFlightInput(val)
          input.value = val
        }
        acc[field] = val
      }
      return acc
    }, {} as Record<string, string>)

    family.guests.forEach(guest => {
      if (guest.id === sourceGuestId) return
      fieldsToCopy.forEach(field => {
        const input = form.elements.namedItem(`${field}_${guest.id}`) as HTMLInputElement
        if (input) input.value = sourceValues[field] || ''
      })
    })

    setGuestState(prev => {
      const next = { ...prev }
      family.guests.forEach(guest => {
        if (guest.id === sourceGuestId) return
        next[guest.id] = {
          ...next[guest.id],
          arrivalDate: sourceValues['arrivalDate'] || '',
          departureDate: sourceValues['departureDate'] || '',
          hasBookedTravel: true,
        }
      })
      return next
    })

    handleAutoSave()
  }

  const adjustDate = (guestId: string, field: 'arrivalDate' | 'departureDate', days: number) => {
    setGuestState(prev => {
      const current = prev[guestId][field]
      if (!current) return prev
      const [year, month, day] = current.split('-').map(Number)
      const dateObj = new Date(year, month - 1, day)
      dateObj.setDate(dateObj.getDate() + days)
      const y = dateObj.getFullYear()
      const m = String(dateObj.getMonth() + 1).padStart(2, '0')
      const d = String(dateObj.getDate()).padStart(2, '0')
      return {
        ...prev,
        [guestId]: { ...prev[guestId], [field]: `${y}-${m}-${d}` }
      }
    })
    handleAutoSave()
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-zinc-200 pb-6 gap-4">
        <div>
          <h2 className="text-4xl md:text-5xl font-script text-black">Welcome, {family.name}</h2>
          <p className="text-zinc-500 font-karla mt-2">Please let us know who will be celebrating with us.</p>
        </div>
        <form action={logoutFamily}>
          <button type="submit" className="text-sm font-karla text-zinc-400 hover:text-black underline underline-offset-4 transition-colors">
            Log out
          </button>
        </form>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} onChange={handleAutoSave} className="space-y-12">
        {family.guests.map((guest) => {
          const isDecliningBoth = guestState[guest.id].isAttendingWelcome === false && guestState[guest.id].isAttendingWedding === false;

          return (
            <div key={guest.id} className="bg-white p-6 md:p-8 rounded-xl border border-zinc-100 shadow-sm relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-2 h-full bg-sage"></div>
              <input type="hidden" name="guestId" value={guest.id} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-2 border-b border-zinc-100">
                {editingNames[guest.id] ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2.5 w-full max-w-lg animate-in fade-in duration-200">
                    <div className="w-full sm:w-28">
                      <label htmlFor={`title_select_${guest.id}`} className="block text-xs font-karla text-zinc-500 mb-1">
                        Title
                      </label>
                      <select
                        id={`title_select_${guest.id}`}
                        name={`title_${guest.id}`}
                        value={guestTitles[guest.id] ?? (guest.title || 'None')}
                        onChange={(e) => {
                          setGuestTitles(prev => ({ ...prev, [guest.id]: e.target.value }))
                        }}
                        className="w-full px-3 py-2 border border-sage focus:ring-1 focus:ring-sage rounded-md font-sans text-base outline-none bg-white text-black cursor-pointer"
                      >
                        {TITLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === 'None' ? 'None' : `${opt}.`}
                          </option>
                        ))}
                        {guest.title && !TITLE_OPTIONS.includes(guest.title) && (
                          <option value={guest.title}>{guest.title}</option>
                        )}
                      </select>
                    </div>

                    <div className="flex-1 w-full">
                      <label htmlFor={`name_input_${guest.id}`} className="block text-xs font-karla text-zinc-500 mb-1">
                        Guest Name
                      </label>
                      <input
                        type="text"
                        id={`name_input_${guest.id}`}
                        name={`name_${guest.id}`}
                        value={guestNames[guest.id] ?? guest.name}
                        onChange={(e) => {
                          setGuestNames(prev => ({ ...prev, [guest.id]: e.target.value }))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!guestNames[guest.id]?.trim()) {
                              setGuestNames(prev => ({ ...prev, [guest.id]: guest.name }))
                            }
                            setEditingNames(prev => ({ ...prev, [guest.id]: false }))
                            handleAutoSave()
                          }
                        }}
                        className="w-full px-3 py-1.5 border border-sage focus:ring-1 focus:ring-sage rounded-md font-sans text-xl outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 sm:mt-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (!guestNames[guest.id]?.trim()) {
                            setGuestNames(prev => ({ ...prev, [guest.id]: guest.name }))
                          }
                          setEditingNames(prev => ({ ...prev, [guest.id]: false }))
                          handleAutoSave()
                        }}
                        className="px-3.5 py-2 bg-black text-white text-xs font-sans uppercase tracking-wider rounded-md hover:bg-sage transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGuestNames(prev => ({ ...prev, [guest.id]: guest.name }))
                          setGuestTitles(prev => ({ ...prev, [guest.id]: guest.title || 'None' }))
                          setEditingNames(prev => ({ ...prev, [guest.id]: false }))
                        }}
                        className="px-2.5 py-2 text-zinc-400 hover:text-black text-xs font-sans uppercase tracking-wider rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-sans text-black">
                      {guestTitles[guest.id] && guestTitles[guest.id] !== 'None'
                        ? `${guestTitles[guest.id].endsWith('.') ? guestTitles[guest.id] : `${guestTitles[guest.id]}.`} `
                        : guest.title && guest.title !== 'None'
                          ? `${guest.title.endsWith('.') ? guest.title : `${guest.title}.`} `
                          : ''}
                      {guestNames[guest.id] || guest.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingNames(prev => ({ ...prev, [guest.id]: true }))}
                        className="text-xs font-karla text-zinc-400 hover:text-sage flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-zinc-50 border border-transparent hover:border-zinc-200 cursor-pointer"
                        title="Edit title and name"
                      >
                        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => resetGuest(guest.id)}
                        className="text-xs font-karla text-zinc-400 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-red-50/50 border border-transparent hover:border-red-100 cursor-pointer"
                        title="Reset RSVP and all details for this guest"
                      >
                        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Reset</span>
                      </button>
                    </div>
                    <input type="hidden" name={`title_${guest.id}`} value={guestTitles[guest.id] || guest.title || 'None'} />
                    <input type="hidden" name={`name_${guest.id}`} value={guestNames[guest.id] || guest.name} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                {/* RSVP Statuses */}
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-black mb-3">Welcome Party (Dec 11)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                        <input
                          type="radio"
                          name={`isAttendingWelcome_${guest.id}`}
                          value="true"
                          checked={guestState[guest.id].isAttendingWelcome === true}
                          onChange={() => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], isAttendingWelcome: true } }))}
                          className="accent-sage w-4 h-4"
                        />
                        Joyfully Accepts
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                        <input
                          type="radio"
                          name={`isAttendingWelcome_${guest.id}`}
                          value="false"
                          checked={guestState[guest.id].isAttendingWelcome === false}
                          onChange={() => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], isAttendingWelcome: false } }))}
                          className="accent-sage w-4 h-4"
                        />
                        Regretfully Declines
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-3">Wedding Day (Dec 12)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                        <input
                          type="radio"
                          name={`isAttendingWedding_${guest.id}`}
                          value="true"
                          checked={guestState[guest.id].isAttendingWedding === true}
                          onChange={() => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], isAttendingWedding: true } }))}
                          className="accent-sage w-4 h-4"
                        />
                        Joyfully Accepts
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                        <input
                          type="radio"
                          name={`isAttendingWedding_${guest.id}`}
                          value="false"
                          checked={guestState[guest.id].isAttendingWedding === false}
                          onChange={() => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], isAttendingWedding: false } }))}
                          className="accent-sage w-4 h-4"
                        />
                        Regretfully Declines
                      </label>
                    </div>
                  </div>
                </div>

                {!isDecliningBoth && (
                  <>
                    {/* Contact Info */}
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        name={`email_${guest.id}`}
                        defaultValue={guest.email || ''}
                        onBlur={(e) => {
                          e.target.value = normalizeEmailInput(e.target.value)
                          handleAutoSave()
                        }}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage focus:ring-1 focus:ring-sage font-karla outline-none"
                      />
                    </div>
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name={`phoneNumber_${guest.id}`}
                        defaultValue={guest.phoneNumber || ''}
                        onBlur={(e) => {
                          e.target.value = normalizePhoneInput(e.target.value)
                          handleAutoSave()
                        }}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage focus:ring-1 focus:ring-sage font-karla outline-none"
                      />
                    </div>

                    {/* Dietary */}
                    <div className="col-span-1 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-zinc-700 mb-3">Dietary Restrictions & Allergies</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {[...DIETARY_OPTIONS, 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], dietaryType: opt } }))
                              handleAutoSave()
                            }}
                            className={`px-4 py-2 text-sm font-karla rounded-full border transition-all ${guestState[guest.id].dietaryType === opt
                              ? 'bg-black text-white border-black'
                              : 'bg-white text-zinc-600 border-zinc-200 hover:border-sage hover:text-black'
                              }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>

                      {guestState[guest.id].dietaryType === 'Other' && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                          <input
                            type="text"
                            value={guestState[guest.id].dietaryText}
                            onChange={(e) => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], dietaryText: e.target.value } }))}
                            placeholder="Please specify..."
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage font-karla outline-none"
                          />
                        </div>
                      )}

                      <input
                        type="hidden"
                        name={`dietaryRestrictions_${guest.id}`}
                        value={guestState[guest.id].dietaryType === 'Other'
                          ? guestState[guest.id].dietaryText
                          : (guestState[guest.id].dietaryType === 'None' ? '' : guestState[guest.id].dietaryType)}
                      />
                    </div>

                    {/* Song Requests */}
                    <div className="col-span-1 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Song Requests</label>
                      <textarea
                        name={`songRequests_${guest.id}`}
                        defaultValue={guest.songRequests || ''}
                        rows={2}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage focus:ring-1 focus:ring-sage font-karla outline-none resize-none"
                        placeholder="Let us know what you're excited for the DJ to play."
                      ></textarea>
                    </div>

                    {/* Travel Info */}
                    <div className="col-span-1 md:col-span-2 pt-4 border-t border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex flex-col mb-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-sans uppercase tracking-wider text-zinc-500">Travel & Accommodation Info</h4>
                          {family.guests.length > 1 && guestState[guest.id].hasBookedTravel === true && (
                            <button
                              type="button"
                              onClick={() => copyTravelInfoToAll(guest.id)}
                              className="text-xs font-karla text-sage hover:text-black underline underline-offset-4 transition-colors"
                            >
                              Copy to all guests
                            </button>
                          )}
                        </div>

                        <div className="mb-2">
                          <label className="block text-sm font-medium text-black mb-3">Have you booked your flights or hotel yet?</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                              <input
                                type="radio"
                                name={`hasBookedTravel_radio_${guest.id}`}
                                value="true"
                                checked={guestState[guest.id].hasBookedTravel === true}
                                onChange={() => {
                                  setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], hasBookedTravel: true } }));
                                  handleAutoSave();
                                }}
                                className="accent-sage w-4 h-4"
                              />
                              Yes, I have!
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-karla text-zinc-700">
                              <input
                                type="radio"
                                name={`hasBookedTravel_radio_${guest.id}`}
                                value="false"
                                checked={guestState[guest.id].hasBookedTravel === false}
                                onChange={() => {
                                  setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], hasBookedTravel: false } }));
                                  handleAutoSave();
                                }}
                                className="accent-sage w-4 h-4"
                              />
                              Not yet
                            </label>
                          </div>
                        </div>

                        {guestState[guest.id].hasBookedTravel === false && (
                          <div className="mt-4 p-4 bg-zinc-50 border border-zinc-100 rounded-lg text-sm text-zinc-600 font-karla animate-in fade-in slide-in-from-top-2">
                            Please come back and add your details once you&apos;ve booked your trip.
                          </div>
                        )}
                      </div>
                      <div className={guestState[guest.id].hasBookedTravel === true ? "grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 animate-in fade-in slide-in-from-top-2 mt-4" : "hidden"}>
                        <div className="col-span-1 md:col-span-2 p-3 bg-sage/5 border border-sage/20 rounded-md text-sm text-zinc-600 font-karla">
                          If you&apos;ve only booked your flights or only your hotel, enter that and leave the rest blank. You can always come back and add the rest later.
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Arrival Flight Number</label>
                          <input
                            type="text"
                            name={`arrivalFlightNumber_${guest.id}`}
                            defaultValue={guest.arrivalFlightNumber || ''}
                            placeholder="e.g. AA 1234"
                            onBlur={(e) => {
                              e.target.value = normalizeFlightInput(e.target.value)
                              handleAutoSave()
                            }}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage font-karla outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Arrival Date</label>
                          <div className="flex items-center">
                            <button type="button" onClick={() => adjustDate(guest.id, 'arrivalDate', -1)} className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md hover:bg-zinc-100 transition-colors font-mono font-bold text-zinc-600">-</button>
                            <input
                              type="date"
                              name={`arrivalDate_${guest.id}`}
                              value={guestState[guest.id].arrivalDate}
                              onChange={(e) => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], arrivalDate: e.target.value } }))}
                              className="w-full px-3 py-2 border-y border-zinc-200 focus:border-sage font-karla outline-none text-center"
                            />
                            <button type="button" onClick={() => adjustDate(guest.id, 'arrivalDate', 1)} className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-r-md hover:bg-zinc-100 transition-colors font-mono font-bold text-zinc-600">+</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Departure Flight Number</label>
                          <input
                            type="text"
                            name={`departureFlightNumber_${guest.id}`}
                            defaultValue={guest.departureFlightNumber || ''}
                            placeholder="e.g. DL 567"
                            onBlur={(e) => {
                              e.target.value = normalizeFlightInput(e.target.value)
                              handleAutoSave()
                            }}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage font-karla outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Departure Date</label>
                          <div className="flex items-center">
                            <button type="button" onClick={() => adjustDate(guest.id, 'departureDate', -1)} className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md hover:bg-zinc-100 transition-colors font-mono font-bold text-zinc-600">-</button>
                            <input
                              type="date"
                              name={`departureDate_${guest.id}`}
                              value={guestState[guest.id].departureDate}
                              onChange={(e) => setGuestState(prev => ({ ...prev, [guest.id]: { ...prev[guest.id], departureDate: e.target.value } }))}
                              className="w-full px-3 py-2 border-y border-zinc-200 focus:border-sage font-karla outline-none text-center"
                            />
                            <button type="button" onClick={() => adjustDate(guest.id, 'departureDate', 1)} className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-r-md hover:bg-zinc-100 transition-colors font-mono font-bold text-zinc-600">+</button>
                          </div>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Hotel Name</label>
                          <input
                            type="text"
                            name={`hotelName_${guest.id}`}
                            defaultValue={guest.hotelName || ''}
                            placeholder="Where are you staying?"
                            onBlur={(e) => {
                              e.target.value = normalizeHotelInput(e.target.value)
                              handleAutoSave()
                            }}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:border-sage font-karla outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {state?.error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center font-karla animate-pulse">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="p-4 bg-sage/10 border border-sage/30 text-sage rounded-lg text-center font-karla">
            {state.message}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-4 bg-black text-white rounded-md font-sans tracking-widest uppercase text-sm hover:bg-sage transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
          >
            {isPending ? 'Saving...' : 'Save RSVP Details'}
          </button>
        </div>
      </form>
    </div>
  )
}
