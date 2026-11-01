// Display helpers shared by the Seating Lab components

const STOPS: [number, [number, number, number]][] = [
  [-3, [225, 29, 72]], // rose-600
  [0, [251, 146, 60]], // orange-400
  [2, [253, 230, 138]], // amber-200
  [5, [110, 231, 183]], // emerald-300
  [10, [5, 150, 105]], // emerald-600
]

/**
 * Seat color for a happiness value: red below zero, amber around the floor, green when well connected.
 */
export function happinessColor(h: number): string {
  return interpolate(STOPS, h)
}

function interpolate(stops: [number, [number, number, number]][], v: number): string {
  if (v <= stops[0][0]) return rgb(stops[0][1])
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]
    if (v <= x1) {
      const [x0, c0] = stops[i - 1]
      const t = (v - x0) / (x1 - x0)
      return rgb([0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * t) as [number, number, number])
    }
  }
  return rgb(stops[stops.length - 1][1])
}

const rgb = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

// The same scale for happiness as a share of the guest's best possible (see happinessPotential)
const SHARE_STOPS: [number, [number, number, number]][] = [
  [-0.5, [225, 29, 72]],
  [0, [251, 146, 60]],
  [0.25, [253, 230, 138]],
  [0.55, [110, 231, 183]],
  [0.9, [5, 150, 105]],
]
const NO_TIES = 'rgb(228, 228, 231)' // zinc-200: nobody they like is at the wedding

export function shareColor(share: number | null): string {
  return share === null ? NO_TIES : interpolate(SHARE_STOPS, share)
}

export const shareTextColor = (share: number | null) => (share !== null && (share < -0.2 || share > 0.7) ? '#ffffff' : '#18181b')

// Dark text on light seat colors, white on the saturated ends
export const happinessTextColor = (h: number) => (h < -1 || h > 7 ? '#ffffff' : '#18181b')

const truncateFirst = (first: string) => (first.length > 8 ? `${first.slice(0, 7)}…` : first)

/**
 * Seat labels: first name and last initial, using more of the last name (then the full first name)
 * only where two guests would otherwise share a label, e.g. "Celine Be." and "Celine Bo.".
 */
export function shortNames(names: string[]): string[] {
  const parts = names.map((name) => {
    const words = name.trim().split(/\s+/)
    return { first: words[0], last: words.length > 1 ? words[words.length - 1] : '' }
  })
  const label = (i: number, lastLength: number, fullFirst = false) => {
    const { first, last } = parts[i]
    const shownFirst = fullFirst ? first : truncateFirst(first)
    if (!last) return shownFirst
    return lastLength >= last.length ? `${shownFirst} ${last}` : `${shownFirst} ${last.slice(0, lastLength)}.`
  }

  const labels = names.map((_, i) => label(i, 1))
  const groups = new Map<string, number[]>()
  labels.forEach((l, i) => groups.set(l, [...(groups.get(l) || []), i]))
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const longest = Math.max(...members.map((i) => parts[i].last.length))
    const unique = (candidate: string[]) => new Set(candidate).size === candidate.length
    let chosen: string[] | null = null
    for (let k = 2; k <= longest && !chosen; k++) {
      const candidate = members.map((i) => label(i, k))
      if (unique(candidate)) chosen = candidate
    }
    chosen ??= members.map((i) => label(i, 1, true)) // Same last name: show the whole first name
    if (!unique(chosen)) chosen = members.map((i) => names[i]) // Last resort
    members.forEach((i, j) => (labels[i] = chosen![j]))
  }
  return labels
}

export function formatScore(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export const formatShare = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

export function formatSigned(value: number, digits = 1): string {
  const s = formatScore(Math.abs(value), digits)
  return value > 0.0005 ? `+${s}` : value < -0.0005 ? `−${s}` : s
}

export function formatCount(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`
  return `${Math.round(value)}`
}

export function formatMetric(value: number | string): string {
  if (typeof value === 'string') return value
  if (Number.isInteger(value)) return formatCount(value)
  if (Math.abs(value) < 1) return value.toFixed(3)
  return formatScore(value, 2)
}

export const CONSTRAINT_TEXT: Record<string, string> = {
  ADJACENT: 'must sit next to',
  NOT_ADJACENT: 'must not sit next to',
  SAME_TABLE: 'must share a table with',
  DIFFERENT_TABLE: 'must be at a different table from',
  HEAD: 'must sit at a head',
}
