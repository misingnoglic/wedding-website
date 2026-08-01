'use client'

import Link from 'next/link'
import { AdminStats, FlatGuest, FamilyWithGuests } from '../types'

interface AdminHeaderProps {
  currentAdmin: {
    id: string
    name: string
    isAdmin: boolean
  }
  stats: AdminStats
  initialFamilies: FamilyWithGuests[]
  allGuests: FlatGuest[]
  onOpenAddFamily: () => void
}

export default function AdminHeader({
  currentAdmin,
  stats,
  initialFamilies,
  allGuests,
  onOpenAddFamily,
}: AdminHeaderProps) {
  const handleExportCsv = () => {
    const headers = [
      'Family Name',
      'Invitation Code',
      'Title',
      'Guest Name',
      'Full Name',
      'Wedding RSVP (Dec 12)',
      'Welcome Party RSVP (Dec 11)',
      'Dietary Restrictions',
      'Arrival Date',
      'Arrival Flight',
      'Departure Date',
      'Departure Flight',
      'Hotel Name',
      'Email',
      'Phone Number',
      'Song Requests',
      'Family Admin',
      'Last Updated',
    ]

    const rows = allGuests.map((g) => {
      const family = initialFamilies.find((f) => f.id === g.familyId)
      const weddingStatus =
        g.isAttendingWedding === true ? 'Attending' : g.isAttendingWedding === false ? 'Declined' : 'Pending'
      const welcomeStatus =
        g.isAttendingWelcome === true ? 'Attending' : g.isAttendingWelcome === false ? 'Declined' : 'Pending'

      return [
        `"${(g.familyName || '').replace(/"/g, '""')}"`,
        `"${(g.familyPassword || '').replace(/"/g, '""')}"`,
        `"${(g.title || '').replace(/"/g, '""')}"`,
        `"${(g.name || '').replace(/"/g, '""')}"`,
        `"${((g.title && g.title !== 'None' ? `${g.title}. ` : '') + (g.name || '')).replace(/"/g, '""')}"`,
        `"${weddingStatus}"`,
        `"${welcomeStatus}"`,
        `"${(g.dietaryRestrictions || '').replace(/"/g, '""')}"`,
        `"${(g.arrivalDate || '').replace(/"/g, '""')}"`,
        `"${(g.arrivalFlightNumber || '').replace(/"/g, '""')}"`,
        `"${(g.departureDate || '').replace(/"/g, '""')}"`,
        `"${(g.departureFlightNumber || '').replace(/"/g, '""')}"`,
        `"${(g.hotelName || '').replace(/"/g, '""')}"`,
        `"${(g.email || '').replace(/"/g, '""')}"`,
        `"${(g.phoneNumber || '').replace(/"/g, '""')}"`,
        `"${(g.songRequests || '').replace(/"/g, '""')}"`,
        `"${family?.isAdmin ? 'Yes' : 'No'}"`,
        `"${new Date(g.updatedAt).toLocaleDateString()}"`,
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `arya-christa-wedding-rsvps-${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-zinc-200/80 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-widest text-sage font-medium font-sans">
            Admin Control Center
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Admin: {currentAdmin.name}
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-sans text-black tracking-tight">RSVP Master Dashboard</h1>
        <p className="text-zinc-500 font-karla mt-1 text-sm md:text-base">
          Live management of all {stats.totalFamilies} families and {stats.totalGuests} invited guests.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <button
          type="button"
          onClick={onOpenAddFamily}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-sage transition-all duration-200 shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          + Add Family
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          title="Print this report"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>

        <Link
          href="/account"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-sans tracking-wider uppercase text-xs hover:bg-zinc-200 transition-colors"
        >
          My Account
        </Link>
      </div>
    </div>
  )
}
