'use client'

import { FlatGuest } from '../../types'

interface DietaryTabProps {
  guests: FlatGuest[]
  onOpenEditGuest: (guest: FlatGuest) => void
}

export default function DietaryTab({ guests, onOpenEditGuest }: DietaryTabProps) {
  const dietaryGuests = guests.filter(
    (g) => g.dietaryRestrictions && g.dietaryRestrictions.trim().length > 0
  )

  const attendingDietaryGuests = dietaryGuests.filter((g) => g.isAttendingWedding === true)
  const declinedDietaryGuests = dietaryGuests.filter((g) => g.isAttendingWedding === false)
  const pendingDietaryGuests = dietaryGuests.filter((g) => g.isAttendingWedding === null)

  // Categorize common keywords
  const categories: Record<string, FlatGuest[]> = {
    Vegetarian: [],
    Vegan: [],
    'Gluten Free': [],
    'Nut Allergy': [],
    'Dairy Free': [],
    Other: [],
  }

  attendingDietaryGuests.forEach((g) => {
    const diet = (g.dietaryRestrictions || '').toLowerCase()
    let matched = false
    if (diet.includes('veg') && !diet.includes('vegan')) {
      categories.Vegetarian.push(g)
      matched = true
    }
    if (diet.includes('vegan')) {
      categories.Vegan.push(g)
      matched = true
    }
    if (diet.includes('gluten') || diet.includes('celiac')) {
      categories['Gluten Free'].push(g)
      matched = true
    }
    if (diet.includes('nut') || diet.includes('peanut') || diet.includes('tree nut')) {
      categories['Nut Allergy'].push(g)
      matched = true
    }
    if (diet.includes('dairy') || diet.includes('lactose')) {
      categories['Dairy Free'].push(g)
      matched = true
    }
    if (!matched) {
      categories.Other.push(g)
    }
  })

  return (
    <div className="space-y-6">
      {/* Category Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(categories).map(([cat, list]) => (
          <div
            key={cat}
            className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs text-center"
          >
            <span className="text-xs font-karla text-zinc-500 block truncate">{cat}</span>
            <span className="text-2xl font-bold font-sans text-amber-900 mt-1 block">
              {list.length}
            </span>
            <span className="text-[10px] text-zinc-400 font-karla">Attending guests</span>
          </div>
        ))}
      </div>

      {/* Main Roster of Attending Guests with Dietary Needs */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-lg font-sans text-black">Attending Guests with Special Diets</h3>
            <p className="text-xs font-karla text-zinc-500">
              {attendingDietaryGuests.length} confirmed attending guest(s) requiring catering attention
            </p>
          </div>
        </div>

        {attendingDietaryGuests.length === 0 ? (
          <p className="text-zinc-500 font-karla text-xs py-4 text-center">
            No attending guests have specified dietary restrictions yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categories)
              .filter(([, list]) => list.length > 0)
              .map(([category, list]) => (
                <div
                  key={category}
                  className="p-4 rounded-xl border bg-amber-50/40 border-amber-200/60"
                >
                  <div className="flex justify-between items-baseline mb-2 border-b border-amber-200/30 pb-2">
                    <h4 className="font-semibold text-sm text-black truncate">{category}</h4>
                    <span className="text-xs font-bold font-sans text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                      {list.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs font-karla text-zinc-600 mt-2">
                    {list.map((g) => (
                      <div key={g.id} className="flex justify-between items-start py-1 border-b border-amber-100 last:border-0">
                        <div className="overflow-hidden">
                          <div className="font-semibold text-black truncate">
                            {g.name} <span className="text-zinc-400 font-normal">({g.familyName})</span>
                          </div>
                          {(category === 'Other' || g.dietaryRestrictions !== category) && (
                            <div className="text-[10px] text-amber-800 italic mt-0.5 truncate">
                              "{g.dietaryRestrictions}"
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenEditGuest(g)}
                          className="text-[10px] text-zinc-400 hover:text-black cursor-pointer ml-2 transition-colors shrink-0"
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

      {/* Pending / Declined Diets (Collapsible context) */}
      {(pendingDietaryGuests.length > 0 || declinedDietaryGuests.length > 0) && (
        <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-200 text-xs font-karla space-y-3">
          <h4 className="font-sans font-semibold text-zinc-700 text-sm">
            Other Recorded Restrictions (Pending or Declined)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-600">
            {pendingDietaryGuests.map((g) => (
              <div key={g.id} className="p-2 bg-white rounded-lg border border-zinc-200">
                <span className="font-medium text-black">{g.name}</span> ({g.familyName}) —{' '}
                <span className="text-amber-700">{g.dietaryRestrictions}</span>{' '}
                <span className="text-amber-600 font-semibold">[Pending RSVP]</span>
              </div>
            ))}
            {declinedDietaryGuests.map((g) => (
              <div key={g.id} className="p-2 bg-white rounded-lg border border-zinc-200 opacity-60">
                <span className="font-medium text-black">{g.name}</span> ({g.familyName}) —{' '}
                <span className="text-zinc-600">{g.dietaryRestrictions}</span>{' '}
                <span className="text-rose-600 font-semibold">[Declined]</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
