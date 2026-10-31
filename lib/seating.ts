// Pure seating-chart logic shared by the admin UI, server actions, and (later) the solvers.

export const AFFINITY_MIN = -3
export const AFFINITY_MAX = 3
export const AFFINITY_VALUES = [-3, -2, -1, 0, 1, 2, 3] as const

export const AFFINITY_LABELS: Record<number, string> = {
  3: 'Would love to sit together',
  2: 'Likes',
  1: 'Gets along',
  0: 'Neutral',
  [-1]: 'Slightly apart',
  [-2]: 'Better apart',
  [-3]: 'Keep far apart',
}

// Baseline for guests in the same Family (invite party) unless a group or explicit rating says otherwise
export const FAMILY_AFFINITY = 2

// A guest with no partner at or above this is "isolated": the optimizer has nothing to protect them with
export const STRONG_AFFINITY = 2

// Side seats have two neighbors, so more than two must-sit-next-to constraints can never be satisfied
export const MAX_ADJACENT = 2

export const SEATING_CONSTRAINTS = ['ADJACENT', 'SAME_TABLE', 'DIFFERENT_TABLE', 'NOT_ADJACENT'] as const
export type SeatingConstraint = (typeof SEATING_CONSTRAINTS)[number]

export const CONSTRAINT_LABELS: Record<SeatingConstraint, string> = {
  ADJACENT: 'Must sit next to',
  SAME_TABLE: 'Must share a table',
  DIFFERENT_TABLE: 'Different tables',
  NOT_ADJACENT: 'Not next to',
}

export type SeatingGroupInput = { id: string; name: string; affinity: number; memberIds: string[] }

// A link side: a whole group, a whole party (Family), or one guest
export const LINK_ENDPOINT_TYPES = ['group', 'family', 'guest'] as const
export type LinkEndpointType = (typeof LINK_ENDPOINT_TYPES)[number]
export type LinkEndpoint = { type: LinkEndpointType; id: string }
export type SeatingLinkInput = { a: LinkEndpoint; b: LinkEndpoint; affinity: number }
export type RelationshipInput = {
  guestAId: string
  guestBId: string
  affinity: number | null
  constraint: string | null
}

export type AffinitySource = 'explicit' | 'group' | 'link' | 'family'
export type EffectiveAffinity = {
  affinity: number
  source: AffinitySource
  label: string // Group name, 'A ↔ B' for links, 'Family', or 'Rated'
}

export function isValidAffinity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= AFFINITY_MIN && (value as number) <= AFFINITY_MAX
}

export function isSeatingConstraint(value: unknown): value is SeatingConstraint {
  return SEATING_CONSTRAINTS.includes(value as SeatingConstraint)
}

/**
 * Relationships are undirected and stored once, with guestAId < guestBId.
 */
export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export function pairKey(a: string, b: string): string {
  const [x, y] = normalizePair(a, b)
  return `${x}|${y}`
}

export function isLinkEndpoint(value: unknown): value is LinkEndpoint {
  const e = value as LinkEndpoint
  return !!e && LINK_ENDPOINT_TYPES.includes(e.type) && typeof e.id === 'string' && e.id.length > 0
}

export const endpointKey = (e: LinkEndpoint) => `${e.type}:${e.id}`

/**
 * Links are undirected and stored once, with the sides ordered by endpointKey.
 */
export function normalizeLink(a: LinkEndpoint, b: LinkEndpoint): [LinkEndpoint, LinkEndpoint] {
  return endpointKey(a) < endpointKey(b) ? [a, b] : [b, a]
}

export function linkKey(a: LinkEndpoint, b: LinkEndpoint): string {
  const [x, y] = normalizeLink(a, b)
  return `${endpointKey(x)}|${endpointKey(y)}`
}

/**
 * Why a link can't be saved, or null. Guest↔guest is a rating, and a side can't link to itself.
 */
export function linkProblem(a: LinkEndpoint, b: LinkEndpoint): string | null {
  if (a.type === 'guest' && b.type === 'guest') return 'Use a rating on the Guest Ratings view for two guests.'
  if (endpointKey(a) === endpointKey(b)) return 'A link needs two different sides.'
  return null
}

// SeatingLink stores each side as three nullable FKs; exactly one is set
export function endpointFromColumns(groupId: string | null, familyId: string | null, guestId: string | null): LinkEndpoint | null {
  if (groupId) return { type: 'group', id: groupId }
  if (familyId) return { type: 'family', id: familyId }
  if (guestId) return { type: 'guest', id: guestId }
  return null
}

/**
 * Who gets a seat: anyone not excluded who hasn't declined the wedding (pending guests are planned for).
 */
export function isInSeatingPool(guest: { excludeFromSeating: boolean; isAttendingWedding: boolean | null }): boolean {
  return !guest.excludeFromSeating && guest.isAttendingWedding !== false
}

/**
 * Effective affinity for every pair among `guests`. An explicit rating wins; otherwise the
 * highest baseline among shared groups, links, and same-family; pairs with nothing are left out (= 0).
 * Names are only used for link labels.
 */
export function buildAffinityMap(
  guests: { id: string; familyId: string; name?: string; familyName?: string }[],
  groups: SeatingGroupInput[],
  relationships: RelationshipInput[],
  links: SeatingLinkInput[] = []
): Map<string, EffectiveAffinity> {
  const included = new Set(guests.map((g) => g.id))
  const map = new Map<string, EffectiveAffinity>()

  const offerPair = (a: string, b: string, candidate: EffectiveAffinity) => {
    if (a === b) return
    const key = pairKey(a, b)
    const current = map.get(key)
    if (!current || candidate.affinity > current.affinity) map.set(key, candidate)
  }
  const offerBaseline = (memberIds: string[], candidate: EffectiveAffinity) => {
    const members = memberIds.filter((id) => included.has(id))
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) offerPair(members[i], members[j], candidate)
    }
  }

  const families = new Map<string, string[]>()
  for (const g of guests) families.set(g.familyId, [...(families.get(g.familyId) || []), g.id])
  for (const memberIds of families.values()) {
    offerBaseline(memberIds, { affinity: FAMILY_AFFINITY, source: 'family', label: 'Family' })
  }
  for (const group of groups) {
    offerBaseline(group.memberIds, { affinity: group.affinity, source: 'group', label: group.name })
  }
  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const guestsById = new Map(guests.map((g) => [g.id, g]))
  const expand = (e: LinkEndpoint): { members: string[]; name: string } => {
    if (e.type === 'group') {
      const group = groupsById.get(e.id)
      return { members: (group?.memberIds || []).filter((id) => included.has(id)), name: group?.name || 'Group' }
    }
    if (e.type === 'family') {
      const members = families.get(e.id) || []
      return { members, name: guestsById.get(members[0])?.familyName || 'Party' }
    }
    return { members: included.has(e.id) ? [e.id] : [], name: guestsById.get(e.id)?.name || 'Guest' }
  }
  for (const link of links) {
    const a = expand(link.a)
    const b = expand(link.b)
    const candidate: EffectiveAffinity = { affinity: link.affinity, source: 'link', label: `${a.name} ↔ ${b.name}` }
    for (const x of a.members) for (const y of b.members) offerPair(x, y, candidate)
  }

  for (const r of relationships) {
    if (r.affinity === null || !included.has(r.guestAId) || !included.has(r.guestBId)) continue
    map.set(pairKey(r.guestAId, r.guestBId), { affinity: r.affinity, source: 'explicit', label: 'Rated' })
  }

  return map
}

export function getAffinity(map: Map<string, EffectiveAffinity>, a: string, b: string): number {
  return map.get(pairKey(a, b))?.affinity ?? 0
}

/**
 * Data problems worth fixing before running a solver.
 * - isolated: no partner rated STRONG_AFFINITY or higher, so they'll score ~0 wherever they sit
 * - overConstrained: more must-sit-next-to constraints than a seat has neighbors
 */
export function findSeatingWarnings(
  guestIds: string[],
  map: Map<string, EffectiveAffinity>,
  relationships: RelationshipInput[]
): { isolated: Set<string>; overConstrained: Set<string> } {
  const included = new Set(guestIds)
  const strong = new Set<string>()
  for (const [key, value] of map) {
    if (value.affinity < STRONG_AFFINITY) continue
    const [a, b] = key.split('|')
    strong.add(a)
    strong.add(b)
  }

  const adjacentCounts = new Map<string, number>()
  for (const r of relationships) {
    if (r.constraint !== 'ADJACENT' || !included.has(r.guestAId) || !included.has(r.guestBId)) continue
    for (const id of [r.guestAId, r.guestBId]) adjacentCounts.set(id, (adjacentCounts.get(id) || 0) + 1)
  }

  return {
    isolated: new Set(guestIds.filter((id) => !strong.has(id))),
    overConstrained: new Set(guestIds.filter((id) => (adjacentCounts.get(id) || 0) > MAX_ADJACENT)),
  }
}
