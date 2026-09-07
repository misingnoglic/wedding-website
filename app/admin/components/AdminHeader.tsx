'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminStats, FlatGuest, FamilyWithGuests } from '../types'
import PushNotificationManager from './PushNotificationManager'
import { clearRedisCache } from '@/app/actions/admin'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      const result = await clearRedisCache()
      if (result.error) {
        console.error(result.error)
      } else {
        console.log(result.message)
      }
    } catch (error) {
      alert('Failed to clear cache')
    } finally {
      setIsClearing(false)
      setIsMenuOpen(false)
    }
  }

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
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 lg:p-8 border border-white shadow-xl shadow-zinc-200/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-30">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold font-sans bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
            Live Feed Active
          </span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-sans px-2 py-1 bg-white/50 rounded-full border border-zinc-200">
            Admin: {currentAdmin.name}
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-sans text-zinc-900 tracking-tight font-light">RSVP Master Dashboard</h1>
        <p className="text-zinc-500 font-karla mt-2 text-sm md:text-base max-w-2xl">
          Overview of {stats.totalFamilies} families and {stats.totalGuests} invited guests. Changes are synced in real-time.
        </p>
      </div>

      <div className="flex items-center gap-2 w-full lg:w-auto">
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100/80 text-zinc-700 rounded-2xl font-sans tracking-wide uppercase text-xs hover:bg-zinc-200 hover:text-black transition-all cursor-pointer shadow-sm border border-zinc-200/50"
        >
          <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>

        <button
          type="button"
          onClick={onOpenAddFamily}
          className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-2xl font-sans tracking-wide uppercase text-xs hover:bg-zinc-800 hover:shadow-lg hover:shadow-black/20 transition-all shadow-md cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Family
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl border transition-all cursor-pointer ${
              isMenuOpen ? 'bg-zinc-200 border-zinc-300 text-black' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 z-50 overflow-hidden py-2 animate-fade-in origin-top-right">
                <button
                  type="button"
                  onClick={() => {
                    window.print()
                    setIsMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-sans text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Report
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="w-full text-left px-4 py-3 text-sm font-sans text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isClearing ? 'Clearing...' : 'Clear Redis Cache'}
                </button>
                <div className="h-px bg-zinc-100 my-1" />
                <Link
                  href="/account"
                  className="w-full text-left px-4 py-3 text-sm font-sans text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Account
                </Link>
                <div className="px-4 py-3">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Push Notifications</div>
                  <PushNotificationManager />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
