'use client'

import { AdminStats } from '../types'

interface AdminKpiCardsProps {
  stats: AdminStats
}

export default function AdminKpiCards({ stats }: AdminKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {/* Headcount Card */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-sage" />
        <span className="text-xs uppercase tracking-wider text-zinc-500 font-sans">Total Guest List</span>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-3xl md:text-4xl font-bold font-sans text-black">{stats.totalGuests}</span>
          <span className="text-xs font-karla text-zinc-500">{stats.totalFamilies} parties</span>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-karla text-zinc-600">
          <span>Response Rate:</span>
          <span className="font-semibold text-black">
            {stats.responseRate}% ({stats.totalGuests - stats.weddingPending}/{stats.totalGuests})
          </span>
        </div>
        <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-sage h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.responseRate}%` }}
          />
        </div>
      </div>

      {/* Wedding Day Card */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
        <span className="text-xs uppercase tracking-wider text-zinc-500 font-sans">Wedding Day (Dec 12)</span>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-3xl md:text-4xl font-bold font-sans text-emerald-700">{stats.weddingAccepted}</span>
          <span className="text-xs font-karla text-emerald-700 font-medium">{stats.acceptanceRate}% Attending</span>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-karla">
          <span className="text-zinc-500">
            Declined: <strong className="text-zinc-800">{stats.weddingDeclined}</strong>
          </span>
          <span className="text-amber-600 font-medium">
            Pending: <strong>{stats.weddingPending}</strong>
          </span>
        </div>
      </div>

      {/* Welcome Party Card */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
        <span className="text-xs uppercase tracking-wider text-zinc-500 font-sans">Welcome Party (Dec 11)</span>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-3xl md:text-4xl font-bold font-sans text-zinc-900">{stats.welcomeAccepted}</span>
          <span className="text-xs font-karla text-zinc-500">Attending</span>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-karla">
          <span className="text-zinc-500">
            Declined: <strong className="text-zinc-800">{stats.welcomeDeclined}</strong>
          </span>
          <span className="text-amber-600 font-medium">
            Pending: <strong>{stats.welcomePending}</strong>
          </span>
        </div>
      </div>

      {/* Logistics & Needs Card */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
        <span className="text-xs uppercase tracking-wider text-zinc-500 font-sans">Logistics & Activity</span>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-karla">
          <div className="p-2 bg-zinc-50 rounded-lg">
            <span className="text-zinc-400 block">Flights Entered</span>
            <strong className="text-base text-zinc-800">{stats.hasFlightsCount}</strong>
          </div>
          <div className="p-2 bg-zinc-50 rounded-lg">
            <span className="text-zinc-400 block">Hotel Confirmed</span>
            <strong className="text-base text-zinc-800">{stats.hasHotelCount}</strong>
          </div>
          <div className="p-2 bg-amber-50/60 border border-amber-100 rounded-lg">
            <span className="text-amber-700 block">Special Diets</span>
            <strong className="text-base text-amber-900">{stats.dietaryCount}</strong>
          </div>
          <div className="p-2 bg-purple-50/60 border border-purple-100 rounded-lg">
            <span className="text-purple-700 block">Website Visits</span>
            <strong className="text-base text-purple-900">{stats.websiteVisitsCount}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
