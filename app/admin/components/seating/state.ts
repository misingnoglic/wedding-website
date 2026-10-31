import { endpointKey, LinkEndpoint, linkKey, normalizeLink, normalizePair } from '@/lib/seating'
import { GuestRelationshipItem, SeatingGroupItem, SeatingLinkItem } from '../../types'

export type SeatingState = {
  groups: SeatingGroupItem[]
  links: SeatingLinkItem[]
  relationships: GuestRelationshipItem[]
  excludedIds: Set<string>
  headIds: Set<string> // Guests who must take a head seat
}

// Optimistic edits applied on top of server data until the action's revalidation lands
export type SeatingPatch =
  | { type: 'relationship'; guestId1: string; guestId2: string; affinity?: number | null; constraint?: string | null }
  | { type: 'membership'; groupId: string; guestIds: string[]; isMember: boolean }
  | { type: 'group'; groupId: string; name?: string; affinity?: number; color?: string | null }
  | { type: 'deleteGroup'; groupId: string }
  | { type: 'link'; a: LinkEndpoint; b: LinkEndpoint; affinity: number | null }
  | { type: 'exclude'; guestId: string; excludeFromSeating: boolean }
  | { type: 'seatRequirement'; guestId: string; seatRequirement: string | null }

export const GROUP_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

export function applySeatingPatch(state: SeatingState, patch: SeatingPatch): SeatingState {
  switch (patch.type) {
    case 'relationship': {
      const [guestAId, guestBId] = normalizePair(patch.guestId1, patch.guestId2)
      const existing = state.relationships.find((r) => r.guestAId === guestAId && r.guestBId === guestBId)
      const next: GuestRelationshipItem = {
        guestAId,
        guestBId,
        affinity: patch.affinity === undefined ? existing?.affinity ?? null : patch.affinity,
        constraint: patch.constraint === undefined ? existing?.constraint ?? null : patch.constraint,
        note: existing?.note ?? null,
      }
      const others = state.relationships.filter((r) => r !== existing)
      const isEmpty = next.affinity === null && next.constraint === null && next.note === null
      return { ...state, relationships: isEmpty ? others : [...others, next] }
    }
    case 'membership':
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== patch.groupId) return g
          const ids = new Set(g.memberIds)
          patch.guestIds.forEach((id) => (patch.isMember ? ids.add(id) : ids.delete(id)))
          return { ...g, memberIds: [...ids] }
        }),
      }
    case 'group':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === patch.groupId
            ? {
                ...g,
                name: patch.name ?? g.name,
                affinity: patch.affinity ?? g.affinity,
                color: patch.color === undefined ? g.color : patch.color,
              }
            : g
        ),
      }
    case 'deleteGroup': {
      const groupKey = endpointKey({ type: 'group', id: patch.groupId })
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== patch.groupId),
        links: state.links.filter((l) => endpointKey(l.a) !== groupKey && endpointKey(l.b) !== groupKey),
      }
    }
    case 'link': {
      const key = linkKey(patch.a, patch.b)
      const others = state.links.filter((l) => linkKey(l.a, l.b) !== key)
      if (patch.affinity === null) return { ...state, links: others }
      const [a, b] = normalizeLink(patch.a, patch.b)
      return { ...state, links: [...others, { a, b, affinity: patch.affinity }] }
    }
    case 'exclude': {
      const excludedIds = new Set(state.excludedIds)
      if (patch.excludeFromSeating) excludedIds.add(patch.guestId)
      else excludedIds.delete(patch.guestId)
      return { ...state, excludedIds }
    }
    case 'seatRequirement': {
      const headIds = new Set(state.headIds)
      if (patch.seatRequirement === 'HEAD') headIds.add(patch.guestId)
      else headIds.delete(patch.guestId)
      return { ...state, headIds }
    }
  }
}

export type SeatingActionResult = { success: true } | { error: string }
export type RunSeatingAction = (patch: SeatingPatch | null, action: () => Promise<SeatingActionResult>) => void
