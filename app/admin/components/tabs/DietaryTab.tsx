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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attendingDietaryGuests.map((g) => (
              <div
                key={g.id}
                className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/60 flex justify-between items-start"
              >
                <div>
                  <div className="font-semibold text-black text-sm">
                    {g.title && g.title !== 'None' ? `${g.title}. ` : ''}
                    {g.name}
                  </div>
                  <div className="text-xs font-karla text-zinc-500">{g.familyName}</div>
                  <div className="mt-2 text-xs font-medium text-amber-900 bg-white/80 px-2.5 py-1 rounded-md border border-amber-200/50 inline-block">
                    🍴 {g.dietaryRestrictions}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenEditGuest(g)}
                  className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 rounded-md text-xs font-karla border border-zinc-200 shadow-xs cursor-pointer"
                >
                  Edit
                </button>
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
