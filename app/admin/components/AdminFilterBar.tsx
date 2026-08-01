'use client'

import { TabType, RsvpFilter, TravelFilter, SortOption } from '../types'

interface AdminFilterBarProps {
  activeTab: TabType
  searchQuery: string
  setSearchQuery: (val: string) => void
  rsvpFilter: RsvpFilter
  setRsvpFilter: (val: RsvpFilter) => void
  travelFilter: TravelFilter
  setTravelFilter: (val: TravelFilter) => void
  onlyDietary: boolean
  setOnlyDietary: (val: boolean) => void
  sortBy: SortOption
  setSortBy: (val: SortOption) => void
  dietaryCount: number
  onExpandAll?: () => void
  onCollapseAll?: () => void
}

export default function AdminFilterBar({
  activeTab,
  searchQuery,
  setSearchQuery,
  rsvpFilter,
  setRsvpFilter,
  travelFilter,
  setTravelFilter,
  onlyDietary,
  setOnlyDietary,
  sortBy,
  setSortBy,
  dietaryCount,
  onExpandAll,
  onCollapseAll,
}: AdminFilterBarProps) {
  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-200/80 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg
            className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search families, guests, passwords, flight numbers, hotels, notes..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 focus:border-sage focus:ring-1 focus:ring-sage rounded-xl font-karla text-sm text-black outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black text-xs font-karla cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Action Buttons for Accordions */}
        {activeTab === 'families' && onExpandAll && onCollapseAll && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={onExpandAll}
              className="px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-lg text-xs font-sans uppercase tracking-wider transition-colors cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-lg text-xs font-sans uppercase tracking-wider transition-colors cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 text-xs font-karla">
        {/* RSVP Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">RSVP Status:</span>
          <select
            value={rsvpFilter}
            onChange={(e) => setRsvpFilter(e.target.value as RsvpFilter)}
            aria-label="RSVP Status Filter"
            className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 outline-none focus:border-sage"
          >
            <option value="all">All Statuses</option>
            <option value="attending_wedding">Attending Wedding</option>
            <option value="declined_wedding">Declined Wedding</option>
            <option value="pending_wedding">Pending Responses</option>
            <option value="attending_welcome">Attending Welcome Party</option>
          </select>
        </div>

        {/* Travel Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">Travel:</span>
          <select
            value={travelFilter}
            onChange={(e) => setTravelFilter(e.target.value as TravelFilter)}
            aria-label="Travel Filter"
            className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 outline-none focus:border-sage"
          >
            <option value="all">All Travel</option>
            <option value="has_flights">Has Flights Entered</option>
            <option value="has_hotel">Has Hotel Confirmed</option>
            <option value="missing_travel">Attending & Missing Travel Info</option>
          </select>
        </div>

        {/* Dietary Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-zinc-700 select-none ml-1">
          <input
            type="checkbox"
            checked={onlyDietary}
            onChange={(e) => setOnlyDietary(e.target.checked)}
            className="accent-sage w-3.5 h-3.5 rounded"
          />
          <span>Has Dietary Restrictions ({dietaryCount})</span>
        </label>

        {/* Sort Options */}
        {activeTab === 'families' && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort Options"
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 outline-none focus:border-sage"
            >
              <option value="name_asc">Family Name (A-Z)</option>
              <option value="name_desc">Family Name (Z-A)</option>
              <option value="guests_desc">Party Size (Largest)</option>
              <option value="updated_desc">Recently Updated</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
