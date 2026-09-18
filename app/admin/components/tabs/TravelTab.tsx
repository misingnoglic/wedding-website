'use client'

import { FlatGuest } from '../../types'

interface TravelTabProps {
  guests: FlatGuest[]
  onOpenEditGuest: (guest: FlatGuest) => void
}

export default function TravelTab({ guests, onOpenEditGuest }: TravelTabProps) {
  const attendingGuests = guests.filter((g) => g.isAttendingWedding === true)

  const hotelGroups: Record<string, FlatGuest[]> = {}
  attendingGuests.forEach((g) => {
    const hotel = g.hotelName ? g.hotelName.trim() : 'Not Specified Yet'
    if (!hotelGroups[hotel]) hotelGroups[hotel] = []
    hotelGroups[hotel].push(g)
  })

  const arrivalFlights = attendingGuests.filter((g) => g.arrivalFlightNumber)
  const departureFlights = attendingGuests.filter((g) => g.departureFlightNumber)

  const arrivalFlightGroups: Record<string, FlatGuest[]> = {}
  arrivalFlights.forEach((g) => {
    const flight = g.arrivalFlightNumber ? g.arrivalFlightNumber.trim() : 'Unknown'
    const dateStr = g.arrivalDate ? ` - ${g.arrivalDate}` : ''
    const key = `${flight}${dateStr}`
    if (!arrivalFlightGroups[key]) arrivalFlightGroups[key] = []
    arrivalFlightGroups[key].push(g)
  })

  const departureFlightGroups: Record<string, FlatGuest[]> = {}
  departureFlights.forEach((g) => {
    const flight = g.departureFlightNumber ? g.departureFlightNumber.trim() : 'Unknown'
    const dateStr = g.departureDate ? ` - ${g.departureDate}` : ''
    const key = `${flight}${dateStr}`
    if (!departureFlightGroups[key]) departureFlightGroups[key] = []
    departureFlightGroups[key].push(g)
  })

  return (
    <div className="space-y-6">
      {/* Hotel Accommodations */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-4">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-lg font-sans text-black">Hotel Accommodations</h3>
          <p className="text-xs font-karla text-zinc-500">
            Where attending guests are staying during the wedding weekend
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(hotelGroups).map(([hotel, list]) => (
            <div
              key={hotel}
              className={`p-4 rounded-xl border ${
                hotel === 'Not Specified Yet'
                  ? 'bg-zinc-50 border-zinc-200'
                  : 'bg-sky-50/40 border-sky-200/60'
              }`}
            >
              <div className="flex justify-between items-baseline mb-2">
                <h4 className="font-semibold text-sm text-black truncate">{hotel}</h4>
                <span className="text-xs font-bold font-sans text-sky-900 bg-sky-100 px-2 py-0.5 rounded-full ml-2">
                  {list.length}
                </span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs font-karla text-zinc-600">
                {list.map((g) => (
                  <div key={g.id} className="flex justify-between items-center py-0.5">
                    <span className="truncate">{g.name}</span>
                    <button
                      type="button"
                      onClick={() => onOpenEditGuest(g)}
                      className="text-[10px] text-zinc-400 hover:text-black cursor-pointer ml-1 transition-colors"
                    >
                      edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flight Schedules Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Arrivals */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-4">
          <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-base font-sans text-black">Arrival Flight Roster</h3>
              <p className="text-xs font-karla text-zinc-500">{arrivalFlights.length} logged arrivals</p>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              ✈ INBOUND
            </span>
          </div>

          {arrivalFlights.length === 0 ? (
            <p className="text-xs font-karla text-zinc-400 py-4 text-center">
              No arrival flights entered yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {Object.entries(arrivalFlightGroups)
                .sort((a, b) => {
                  const dateA = a[1][0]?.arrivalDate || '9999-99-99'
                  const dateB = b[1][0]?.arrivalDate || '9999-99-99'
                  return dateA.localeCompare(dateB)
                })
                .map(([flightKey, list]) => (
                <div
                  key={flightKey}
                  className="p-4 rounded-xl border bg-emerald-50/40 border-emerald-200/60"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="font-semibold text-sm text-black truncate">{flightKey}</h4>
                    <span className="text-xs font-bold font-sans text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full ml-2">
                      {list.length}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs font-karla text-zinc-600">
                    {list.map((g) => (
                      <div key={g.id} className="flex justify-between items-center py-0.5">
                        <span className="truncate">
                          {g.name} <span className="text-zinc-400 ml-1">({g.familyName})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenEditGuest(g)}
                          className="text-[10px] text-zinc-400 hover:text-black cursor-pointer ml-1 transition-colors"
                        >
                          edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-4">
          <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-base font-sans text-black">Departure Flight Roster</h3>
              <p className="text-xs font-karla text-zinc-500">{departureFlights.length} logged departures</p>
            </div>
            <span className="text-xs font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200">
              ✈ OUTBOUND
            </span>
          </div>

          {departureFlights.length === 0 ? (
            <p className="text-xs font-karla text-zinc-400 py-4 text-center">
              No departure flights entered yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {Object.entries(departureFlightGroups)
                .sort((a, b) => {
                  const dateA = a[1][0]?.departureDate || '9999-99-99'
                  const dateB = b[1][0]?.departureDate || '9999-99-99'
                  return dateA.localeCompare(dateB)
                })
                .map(([flightKey, list]) => (
                <div
                  key={flightKey}
                  className="p-4 rounded-xl border bg-sky-50/40 border-sky-200/60"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="font-semibold text-sm text-black truncate">{flightKey}</h4>
                    <span className="text-xs font-bold font-sans text-sky-900 bg-sky-100 px-2 py-0.5 rounded-full ml-2">
                      {list.length}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs font-karla text-zinc-600">
                    {list.map((g) => (
                      <div key={g.id} className="flex justify-between items-center py-0.5">
                        <span className="truncate">
                          {g.name} <span className="text-zinc-400 ml-1">({g.familyName})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenEditGuest(g)}
                          className="text-[10px] text-zinc-400 hover:text-black cursor-pointer ml-1 transition-colors"
                        >
                          edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
