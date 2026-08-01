export type Guest = {
  id: string
  familyId: string
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
  createdAt: Date | string
  updatedAt: Date | string
}

export type FlatGuest = Guest & {
  familyName: string
  familyPassword?: string
}

export type FamilyWithGuests = {
  id: string
  name: string
  password: string
  isAdmin: boolean
  passwordUpdatedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  guests: Guest[]
}

export type AuditEventItem = {
  id: string
  familyId: string | null
  actorType: string
  actorName: string
  eventType: string
  description: string
  details: string | null
  createdAt: Date | string
  family?: {
    id: string
    name: string
  } | null
}

export type TabType = 'families' | 'guests' | 'dietary' | 'travel' | 'songs' | 'activity'
export type RsvpFilter = 'all' | 'attending_wedding' | 'declined_wedding' | 'pending_wedding' | 'attending_welcome'
export type TravelFilter = 'all' | 'has_flights' | 'has_hotel' | 'missing_travel'
export type SortOption = 'name_asc' | 'name_desc' | 'guests_desc' | 'updated_desc'
export type ActivityFilter = 'all' | 'visits' | 'rsvps' | 'management' | 'auth'

export interface AdminStats {
  totalFamilies: number
  totalGuests: number
  weddingAccepted: number
  weddingDeclined: number
  weddingPending: number
  welcomeAccepted: number
  welcomeDeclined: number
  welcomePending: number
  responseRate: number
  acceptanceRate: number
  hasFlightsCount: number
  hasHotelCount: number
  dietaryCount: number
  songRequestsCount: number
  websiteVisitsCount: number
  totalAuditEvents: number
}

export const TITLE_OPTIONS = ['None', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev']
export const DIETARY_QUICK_CHIPS = ['None', 'Vegetarian', 'Vegan', 'Gluten Free', 'Nut Allergy', 'Dairy Free', 'Kosher', 'Kids Meal']
export const HOTEL_QUICK_CHIPS = ['The Cape', 'Sunrock Hotel', 'Pueblo Bonito Rosé', 'Grand Velas', 'Hacienda Beach Club', 'Airbnb / Villa']
