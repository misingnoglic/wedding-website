import type { LinkEndpoint } from '@/lib/seating'
import type { AlgorithmId, Params } from '@/lib/seatingSolver/algorithms'
import type { LayoutConfig } from '@/lib/seatingSolver/layout'
import type { ObjectiveConfig } from '@/lib/seatingSolver/problem'

export type LabGuest = {
  id: string
  name: string
  familyId: string
  familyName: string
  excludeFromSeating: boolean
  isAttendingWedding: boolean | null
  seatRequirement: string | null
  seatingWeight: number | null
}

export type LabPlanAssignment = { seatKey: string; guestId: string; isLocked: boolean }

export type LabPlan = {
  id: string
  name: string
  source: string
  score: number | null
  createdAt: string
  updatedAt: string
  config: Partial<LabConfig> | null
  params: { algorithm?: AlgorithmId; params?: Params; seed?: number } | null
  assignments: LabPlanAssignment[]
}

// What a plan snapshots and what "Save as defaults" stores
export type LabConfig = {
  objective: ObjectiveConfig
  layout: LayoutConfig
}

export type LabData = {
  guests: LabGuest[]
  groups: { id: string; name: string; affinity: number; seatingWeight: number | null; memberIds: string[] }[]
  links: { a: LinkEndpoint; b: LinkEndpoint; affinity: number }[]
  relationships: { guestAId: string; guestBId: string; affinity: number | null; constraint: string | null }[]
  plans: LabPlan[]
  settings: Partial<LabConfig> | null
}
