'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  FamilyWithGuests,
  FlatGuest,
  AuditEventItem,
  SmsMessageItem,
  TabType,
  RsvpFilter,
  TravelFilter,
  SortOption,
  AdminStats,
} from './types'

import AdminHeader from './components/AdminHeader'
import AdminKpiCards from './components/AdminKpiCards'
import AdminFilterBar from './components/AdminFilterBar'

import FamiliesTab from './components/tabs/FamiliesTab'
import GuestsTab from './components/tabs/GuestsTab'
import DietaryTab from './components/tabs/DietaryTab'
import TravelTab from './components/tabs/TravelTab'
import SongsTab from './components/tabs/SongsTab'
import MessagesTab from './components/tabs/MessagesTab'
import ActivityLogTab from './components/tabs/ActivityLogTab'

import AddFamilyModal from './components/modals/AddFamilyModal'
import EditFamilyModal from './components/modals/EditFamilyModal'
import DeleteFamilyModal from './components/modals/DeleteFamilyModal'
import AddGuestModal from './components/modals/AddGuestModal'
import EditGuestModal from './components/modals/EditGuestModal'
import DeleteGuestModal from './components/modals/DeleteGuestModal'

interface AdminDashboardProps {
  initialFamilies: FamilyWithGuests[]
  initialAuditEvents: AuditEventItem[]
  initialMessages?: SmsMessageItem[]
  currentAdmin: {
    id: string
    name: string
    isAdmin: boolean
  }
}

export default function AdminDashboard({
  initialFamilies,
  initialAuditEvents,
  initialMessages = [],
  currentAdmin,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('families')
  const [searchQuery, setSearchQuery] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all')
  const [travelFilter, setTravelFilter] = useState<TravelFilter>('all')
  const [onlyDietary, setOnlyDietary] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())

  // Modal target states
  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false)
  const [editFamilyTarget, setEditFamilyTarget] = useState<FamilyWithGuests | null>(null)
  const [deleteFamilyTarget, setDeleteFamilyTarget] = useState<FamilyWithGuests | null>(null)
  const [addGuestFamilyTarget, setAddGuestFamilyTarget] = useState<FamilyWithGuests | null>(null)
  const [editGuestTarget, setEditGuestTarget] = useState<FlatGuest | null>(null)
  const [deleteGuestTarget, setDeleteGuestTarget] = useState<FlatGuest | null>(null)

  // Server action transition & feedback alerts
  const [isPending, startTransition] = useTransition()
  const [actionFeedback, setActionFeedback] = useState<{ error?: string; success?: string } | null>(null)

  // Flatten all guests for stats, tables, and searches
  const allGuests = useMemo<FlatGuest[]>(() => {
    const list: FlatGuest[] = []
    initialFamilies.forEach((f) => {
      f.guests.forEach((g) => {
        list.push({
          ...g,
          familyName: f.name,
          familyPassword: f.password,
        })
      })
    })
    return list
  }, [initialFamilies])

  // Compute High-Level Metrics & KPIs
  const stats = useMemo<AdminStats>(() => {
    const totalFamilies = initialFamilies.length
    const totalGuests = allGuests.length

    let weddingAccepted = 0
    let weddingDeclined = 0
    let weddingPending = 0
    let welcomeAccepted = 0
    let welcomeDeclined = 0
    let welcomePending = 0
    let hasFlightsCount = 0
    let hasHotelCount = 0
    let dietaryCount = 0
    let songRequestsCount = 0

    allGuests.forEach((g) => {
      if (g.isAttendingWedding === true) weddingAccepted++
      else if (g.isAttendingWedding === false) weddingDeclined++
      else weddingPending++

      if (g.isAttendingWelcome === true) welcomeAccepted++
      else if (g.isAttendingWelcome === false) welcomeDeclined++
      else welcomePending++

      if (g.arrivalFlightNumber || g.departureFlightNumber) hasFlightsCount++
      if (g.hotelName && g.hotelName.trim().length > 0) hasHotelCount++
      if (g.dietaryRestrictions && g.dietaryRestrictions.trim().length > 0) dietaryCount++
      if (g.songRequests && g.songRequests.trim().length > 0) songRequestsCount++
    })

    const respondedGuests = totalGuests - weddingPending
    const responseRate = totalGuests > 0 ? Math.round((respondedGuests / totalGuests) * 100) : 0
    const acceptanceRate = totalGuests > 0 ? Math.round((weddingAccepted / totalGuests) * 100) : 0
    const websiteVisitsCount = initialAuditEvents.filter((ev) => ev.eventType === 'WEBSITE_VISIT').length

    return {
      totalFamilies,
      totalGuests,
      weddingAccepted,
      weddingDeclined,
      weddingPending,
      welcomeAccepted,
      welcomeDeclined,
      welcomePending,
      responseRate,
      acceptanceRate,
      hasFlightsCount,
      hasHotelCount,
      dietaryCount,
      songRequestsCount,
      totalMessagesCount: initialMessages.length,
      websiteVisitsCount,
      totalAuditEvents: initialAuditEvents.length,
    }
  }, [initialFamilies, allGuests, initialAuditEvents, initialMessages])

  // Filter and sort families
  const filteredFamilies = useMemo(() => {
    return initialFamilies
      .filter((family) => {
        // 1. Search Query Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim()
          const matchesFamilyName = family.name.toLowerCase().includes(query)
          const matchesPassword = family.password.toLowerCase().includes(query)
          const matchesGuest = family.guests.some((g) => {
            return (
              g.name.toLowerCase().includes(query) ||
              (g.email && g.email.toLowerCase().includes(query)) ||
              (g.phoneNumber && g.phoneNumber.toLowerCase().includes(query)) ||
              (g.hotelName && g.hotelName.toLowerCase().includes(query)) ||
              (g.arrivalFlightNumber && g.arrivalFlightNumber.toLowerCase().includes(query)) ||
              (g.departureFlightNumber && g.departureFlightNumber.toLowerCase().includes(query)) ||
              (g.dietaryRestrictions && g.dietaryRestrictions.toLowerCase().includes(query)) ||
              (g.songRequests && g.songRequests.toLowerCase().includes(query))
            )
          })

          if (!matchesFamilyName && !matchesPassword && !matchesGuest) {
            return false
          }
        }

        // 2. RSVP Status Filter
        if (rsvpFilter !== 'all') {
          if (rsvpFilter === 'attending_wedding') {
            if (!family.guests.some((g) => g.isAttendingWedding === true)) return false
          } else if (rsvpFilter === 'declined_wedding') {
            if (!family.guests.some((g) => g.isAttendingWedding === false)) return false
          } else if (rsvpFilter === 'pending_wedding') {
            if (!family.guests.some((g) => g.isAttendingWedding === null)) return false
          } else if (rsvpFilter === 'attending_welcome') {
            if (!family.guests.some((g) => g.isAttendingWelcome === true)) return false
          }
        }

        // 3. Travel Filter
        if (travelFilter !== 'all') {
          if (travelFilter === 'has_flights') {
            if (!family.guests.some((g) => g.arrivalFlightNumber || g.departureFlightNumber)) return false
          } else if (travelFilter === 'has_hotel') {
            if (!family.guests.some((g) => g.hotelName && g.hotelName.trim().length > 0)) return false
          } else if (travelFilter === 'missing_travel') {
            const attendingGuests = family.guests.filter((g) => g.isAttendingWedding === true)
            if (!attendingGuests.some((g) => !g.arrivalFlightNumber && !g.hotelName)) return false
          }
        }

        // 4. Dietary Filter
        if (onlyDietary) {
          if (!family.guests.some((g) => g.dietaryRestrictions && g.dietaryRestrictions.trim().length > 0)) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
        if (sortBy === 'guests_desc') return b.guests.length - a.guests.length
        if (sortBy === 'updated_desc') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        return 0
      })
  }, [initialFamilies, searchQuery, rsvpFilter, travelFilter, onlyDietary, sortBy])

  // Filtered flat guests list
  const filteredGuests = useMemo(() => {
    return allGuests.filter((g) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const match =
          g.name.toLowerCase().includes(query) ||
          g.familyName.toLowerCase().includes(query) ||
          (g.email && g.email.toLowerCase().includes(query)) ||
          (g.phoneNumber && g.phoneNumber.toLowerCase().includes(query)) ||
          (g.hotelName && g.hotelName.toLowerCase().includes(query)) ||
          (g.arrivalFlightNumber && g.arrivalFlightNumber.toLowerCase().includes(query)) ||
          (g.departureFlightNumber && g.departureFlightNumber.toLowerCase().includes(query)) ||
          (g.dietaryRestrictions && g.dietaryRestrictions.toLowerCase().includes(query)) ||
          (g.songRequests && g.songRequests.toLowerCase().includes(query))
        if (!match) return false
      }

      if (rsvpFilter !== 'all') {
        if (rsvpFilter === 'attending_wedding' && g.isAttendingWedding !== true) return false
        if (rsvpFilter === 'declined_wedding' && g.isAttendingWedding !== false) return false
        if (rsvpFilter === 'pending_wedding' && g.isAttendingWedding !== null) return false
        if (rsvpFilter === 'attending_welcome' && g.isAttendingWelcome !== true) return false
      }

      if (travelFilter !== 'all') {
        if (travelFilter === 'has_flights' && !g.arrivalFlightNumber && !g.departureFlightNumber) return false
        if (travelFilter === 'has_hotel' && (!g.hotelName || g.hotelName.trim().length === 0)) return false
        if (
          travelFilter === 'missing_travel' &&
          !(g.isAttendingWedding === true && !g.arrivalFlightNumber && !g.hotelName)
        ) {
          return false
        }
      }

      if (onlyDietary && (!g.dietaryRestrictions || g.dietaryRestrictions.trim().length === 0)) {
        return false
      }

      return true
    })
  }, [allGuests, searchQuery, rsvpFilter, travelFilter, onlyDietary])

  // Accordion Toggle Handlers
  const toggleFamilyExpanded = (id: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedFamilies(new Set(initialFamilies.map((f) => f.id)))
  const collapseAll = () => setExpandedFamilies(new Set())

  return (
    <div className="min-h-screen bg-sand/30 py-8 px-4 sm:px-6 lg:px-8 space-y-8 max-w-7xl mx-auto">
      {/* Feedback Alert Toast */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl text-sm font-karla flex justify-between items-center shadow-md animate-fade-in ${
            actionFeedback.error
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <span>{actionFeedback.error || actionFeedback.success}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold px-2 py-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Header */}
      <AdminHeader
        currentAdmin={currentAdmin}
        stats={stats}
        initialFamilies={initialFamilies}
        allGuests={allGuests}
        onOpenAddFamily={() => setIsAddFamilyOpen(true)}
      />

      {/* KPI Cards */}
      <AdminKpiCards stats={stats} />

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200/80 overflow-x-auto no-scrollbar gap-2 sm:gap-4">
        {[
          { id: 'families', label: 'Party Overview', count: filteredFamilies.length },
          { id: 'guests', label: 'All Guests (Flat Roster)', count: filteredGuests.length },
          { id: 'messages', label: 'SMS Messages', count: initialMessages.length },
          { id: 'dietary', label: 'Dietary & Catering', count: stats.dietaryCount },
          { id: 'travel', label: 'Flights & Hotel', count: stats.hasFlightsCount + stats.hasHotelCount },
          { id: 'songs', label: 'DJ Song Requests', count: stats.songRequestsCount },
          { id: 'activity', label: 'Activity & Audit Log', count: initialAuditEvents.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`py-3 px-4 text-xs font-sans uppercase tracking-wider transition-all whitespace-nowrap border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === tab.id
                ? 'border-sage text-black font-semibold bg-white/60 rounded-t-xl'
                : 'border-transparent text-zinc-500 hover:text-black hover:border-zinc-300'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-sage text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar (shown for Families & Guests tabs) */}
      {(activeTab === 'families' || activeTab === 'guests') && (
        <AdminFilterBar
          activeTab={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          rsvpFilter={rsvpFilter}
          setRsvpFilter={setRsvpFilter}
          travelFilter={travelFilter}
          setTravelFilter={setTravelFilter}
          onlyDietary={onlyDietary}
          setOnlyDietary={setOnlyDietary}
          sortBy={sortBy}
          setSortBy={setSortBy}
          dietaryCount={stats.dietaryCount}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      )}

      {/* Tab Panels */}
      {activeTab === 'families' && (
        <FamiliesTab
          families={filteredFamilies}
          expandedFamilies={expandedFamilies}
          toggleFamilyExpanded={toggleFamilyExpanded}
          onOpenEditFamily={(f) => setEditFamilyTarget(f)}
          onOpenDeleteFamily={(f) => setDeleteFamilyTarget(f)}
          onOpenAddGuest={(f) => setAddGuestFamilyTarget(f)}
          onOpenEditGuest={(g) => setEditGuestTarget(g)}
          onOpenDeleteGuest={(g) => setDeleteGuestTarget(g)}
          isPending={isPending}
          startTransition={startTransition}
          setActionFeedback={setActionFeedback}
        />
      )}

      {activeTab === 'guests' && (
        <GuestsTab
          guests={filteredGuests}
          onOpenEditGuest={(g) => setEditGuestTarget(g)}
          onOpenDeleteGuest={(g) => setDeleteGuestTarget(g)}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesTab messages={initialMessages} allGuests={allGuests} />
      )}

      {activeTab === 'dietary' && (
        <DietaryTab
          guests={allGuests}
          onOpenEditGuest={(g) => setEditGuestTarget(g)}
        />
      )}

      {activeTab === 'travel' && (
        <TravelTab
          guests={allGuests}
          onOpenEditGuest={(g) => setEditGuestTarget(g)}
        />
      )}

      {activeTab === 'songs' && <SongsTab guests={allGuests} />}

      {activeTab === 'activity' && <ActivityLogTab auditEvents={initialAuditEvents} />}

      {/* Modals */}
      <AddFamilyModal
        isOpen={isAddFamilyOpen}
        onClose={() => setIsAddFamilyOpen(false)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />

      <EditFamilyModal
        family={editFamilyTarget}
        onClose={() => setEditFamilyTarget(null)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />

      <DeleteFamilyModal
        family={deleteFamilyTarget}
        onClose={() => setDeleteFamilyTarget(null)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />

      <AddGuestModal
        family={addGuestFamilyTarget}
        onClose={() => setAddGuestFamilyTarget(null)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />

      <EditGuestModal
        guest={editGuestTarget}
        onClose={() => setEditGuestTarget(null)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />

      <DeleteGuestModal
        guest={deleteGuestTarget}
        onClose={() => setDeleteGuestTarget(null)}
        isPending={isPending}
        startTransition={startTransition}
        setActionFeedback={setActionFeedback}
      />
    </div>
  )
}
