'use client'

import { useRef, useState } from 'react'
import { Problem } from '@/lib/seatingSolver/problem'
import { formatScore, formatShare, formatSigned, happinessColor, happinessTextColor, shareColor, shareTextColor } from '../format'

export type TieMode = 'off' | 'selected' | 'strong'

interface TableViewProps {
  problem: Problem
  guestAt: Int32Array
  happiness: ArrayLike<number>
  potential: ArrayLike<number> | null // Color by share of each guest's best possible happiness instead of raw
  labels: string[] // Short names, per guest
  selectedGuest: number | null
  lockedSeats: Set<number>
  violatingGuests: Set<number>
  highlighted: Set<number> | null // Dim everyone else
  tieMode: TieMode
  clean: boolean // Names only, for screenshots: no scores, colors, ties or markers
  animationMs: number
  canEdit: boolean // Dragging is off while a solver runs
  deltaFor: (seatA: number, seatB: number) => number // Objective change for a swap, without making it
  onSelectGuest: (guest: number | null) => void
  onSwapSeats: (seatA: number, seatB: number) => void
}

const U = 66 // Horizontal distance between seats
const V = 60 // Vertical distance between seat rows
const R = 23 // Seat radius
const PAD_X = 40
const PAD_Y = 52
const DRAG_THRESHOLD = 4

type Drag = { guest: number; fromSeat: number; startX: number; startY: number; x: number; y: number; moved: boolean }

export default function TableView({
  problem,
  guestAt,
  happiness,
  potential,
  labels,
  selectedGuest,
  lockedSeats,
  violatingGuests,
  highlighted,
  tieMode,
  clean,
  animationMs,
  canEdit,
  deltaFor,
  onSelectGuest,
  onSwapSeats,
}: TableViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [hoverSeat, setHoverSeat] = useState<number | null>(null)

  const { seats, layout, n, A, guestNames, mustHead } = problem
  const px = (x: number) => PAD_X + (x + (layout.heads ? 1 : 0)) * U + R
  const py = (y: number) => PAD_Y + y * V
  const width = px(Math.max(...seats.map((s) => s.x))) + R + PAD_X
  const height = py((layout.tables - 1) * 4 + 2) + R + 44

  const seatOf = new Int32Array(problem.S)
  guestAt.forEach((token, s) => (seatOf[token] = s))
  const pos = (seat: number) => ({ x: px(seats[seat].x), y: py(seats[seat].y) })

  // Raw happiness, or the share of the guest's best possible (null when nobody they like is here)
  const shareOf = (g: number) => {
    const best = potential?.[g] ?? 0
    return best > 0 ? happiness[g] / best : happiness[g] < 0 ? -1 : null
  }
  const fillOf = (g: number) => (clean ? '#ffffff' : potential ? shareColor(shareOf(g)) : happinessColor(happiness[g]))
  const initials = (g: number) => {
    const words = guestNames[g].trim().split(/\s+/)
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
  }

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: point.x, y: point.y }
  }
  const seatNear = (x: number, y: number) => {
    let best: number | null = null
    let bestDistance = (R * 1.4) ** 2
    for (let s = 0; s < seats.length; s++) {
      const p = pos(s)
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < bestDistance) {
        bestDistance = d
        best = s
      }
    }
    return best
  }

  const onPointerDown = (event: React.PointerEvent, guest: number) => {
    const { x, y } = toSvg(event.clientX, event.clientY)
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({ guest, fromSeat: seatOf[guest], startX: x, startY: y, x, y, moved: false })
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return
    const { x, y } = toSvg(event.clientX, event.clientY)
    const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD
    if (!canEdit || lockedSeats.has(drag.fromSeat)) {
      setDrag({ ...drag, moved })
      return
    }
    setDrag({ ...drag, x, y, moved })
    const near = moved ? seatNear(x, y) : null
    setTarget(near !== null && near !== drag.fromSeat && !lockedSeats.has(near) ? near : null)
  }
  const onPointerUp = () => {
    if (!drag) return
    if (drag.moved && target !== null) onSwapSeats(drag.fromSeat, target)
    else if (!drag.moved) onSelectGuest(drag.guest === selectedGuest ? null : drag.guest)
    setDrag(null)
    setTarget(null)
  }

  // Lines between guests: the selected guest's ties, or strong ties within each table
  const focus = drag?.moved ? drag.guest : selectedGuest
  const ties: { key: string; x1: number; y1: number; x2: number; y2: number; affinity: number }[] = []
  if (tieMode !== 'off' && !clean) {
    const add = (g: number, k: number) => {
      const a = pos(seatOf[g])
      const b = pos(seatOf[k])
      ties.push({ key: `${g}-${k}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, affinity: A[g * n + k] })
    }
    if (focus !== null) {
      for (let k = 0; k < n; k++) if (k !== focus && A[focus * n + k] !== 0) add(focus, k)
    } else if (tieMode === 'strong') {
      for (let g = 0; g < n; g++)
        for (let k = g + 1; k < n; k++)
          if (A[g * n + k] >= 2 && problem.tableOf[seatOf[g]] === problem.tableOf[seatOf[k]]) add(g, k)
    }
  }

  // Per-table summary for the labels
  const tableStats = Array.from({ length: layout.tables }, () => ({ guests: 0, happiness: 0, share: 0, shared: 0 }))
  for (let g = 0; g < n; g++) {
    const t = problem.tableOf[seatOf[g]]
    tableStats[t].guests++
    tableStats[t].happiness += happiness[g]
    const share = shareOf(g)
    if (share !== null) {
      tableStats[t].share += share
      tableStats[t].shared++
    }
  }

  // What-if badge: the drop target while dragging, or the hovered seat when someone is selected
  const previewFrom = drag?.moved ? drag.fromSeat : selectedGuest !== null ? seatOf[selectedGuest] : null
  const previewTo = drag?.moved ? target : canEdit && hoverSeat !== null && hoverSeat !== previewFrom && !lockedSeats.has(hoverSeat) ? hoverSeat : null
  const preview =
    !clean && previewFrom !== null && previewTo !== null && !lockedSeats.has(previewFrom) && canEdit
      ? { at: pos(previewTo), delta: deltaFor(previewFrom, previewTo) }
      : null

  const transition = animationMs > 0 ? `transform ${animationMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none'

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto select-none touch-none"
      role="img"
      aria-label="Seating chart"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDrag(null)
        setTarget(null)
      }}
    >
      {/* Tables */}
      {Array.from({ length: layout.tables }, (_, t) => {
        const top = py(t * 4) + R + 6
        const bottom = py(t * 4 + 2) - R - 6
        const left = px(0) - U / 2 + 6
        const right = px(Math.max(...seats.filter((s) => s.table === t && !s.isHead).map((s) => s.x))) + U / 2 - 6
        const stats = tableStats[t]
        return (
          <g key={t}>
            <rect x={left} y={top} width={right - left} height={bottom - top} rx={14} className="fill-amber-50 stroke-amber-200" strokeWidth={1.5} />
            <text x={(left + right) / 2} y={(top + bottom) / 2 + 2} textAnchor="middle" className="fill-amber-900/50 text-[15px] font-semibold tracking-[0.2em] uppercase">
              Table {t + 1}
            </text>
            <text x={(left + right) / 2} y={(top + bottom) / 2 + 19} textAnchor="middle" className="fill-amber-900/40 text-[11px]">
              {stats.guests} guests
              {clean
                ? ''
                : potential
                  ? ` · avg ${formatShare(stats.shared ? stats.share / stats.shared : null)} of best possible`
                  : ` · avg happiness ${formatScore(stats.guests ? stats.happiness / stats.guests : 0)}`}
            </text>
          </g>
        )
      })}

      {/* Seat outlines; empty ones are visible drop targets */}
      {seats.map((seat, s) => {
        const { x, y } = pos(s)
        const isEmpty = guestAt[s] >= n
        return (
          <circle
            key={seat.key}
            cx={x}
            cy={y}
            r={R}
            className={isEmpty ? 'fill-white stroke-zinc-300' : 'fill-transparent stroke-transparent'}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            onMouseEnter={() => isEmpty && setHoverSeat(s)}
            onMouseLeave={() => isEmpty && setHoverSeat(null)}
          />
        )
      })}

      {/* Ties */}
      <g pointerEvents="none">
        {ties.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.affinity > 0 ? '#059669' : '#e11d48'}
            strokeOpacity={focus !== null ? 0.7 : 0.22}
            strokeWidth={focus !== null ? 1 + Math.abs(t.affinity) : 1.5}
            strokeDasharray={t.affinity < 0 ? '5 4' : undefined}
          />
        ))}
      </g>

      {/* Drop target ring */}
      {target !== null && <circle cx={pos(target).x} cy={pos(target).y} r={R + 6} className="fill-none stroke-black" strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />}

      {/* Guests; the one being dragged fades in place while a ghost follows the pointer */}
      {Array.from({ length: n }, (_, g) => {
        const s = seatOf[g]
        const isDragging = drag?.guest === g && drag.moved && canEdit && !lockedSeats.has(s)
        const { x, y } = pos(s)
        const seat = seats[s]
        const h = happiness[g]
        const share = shareOf(g)
        const isSelected = g === selectedGuest && !clean
        const isHighlighted = !clean && !!highlighted?.has(g)
        const isViolating = !clean && violatingGuests.has(g)
        return (
          <g
            key={problem.guestIds[g]}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition,
              opacity: isDragging ? 0.35 : !clean && highlighted && !highlighted.has(g) ? 0.22 : 1,
            }}
            className={canEdit && !lockedSeats.has(s) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
            onPointerDown={(e) => onPointerDown(e, g)}
            onMouseEnter={() => setHoverSeat(s)}
            onMouseLeave={() => setHoverSeat(null)}
          >
            <title>
              {clean ? guestNames[g] : `${guestNames[g]} · happiness ${formatScore(h)}${potential?.[g] ? ` of a possible ${formatScore(potential[g])}` : ''}`}
            </title>
            {isSelected && <circle r={R + 6} className="fill-none stroke-black" strokeWidth={2} />}
            {isHighlighted && !isSelected && <circle r={R + 5} className="fill-none stroke-indigo-500" strokeWidth={2.5} />}
            <circle
              r={R}
              fill={fillOf(g)}
              stroke={isViolating ? '#dc2626' : clean ? '#a1a1aa' : '#ffffff'}
              strokeWidth={isViolating ? 3 : clean ? 1.5 : 2}
            />
            {clean ? (
              <text y={4} textAnchor="middle" className="fill-zinc-600 text-[12px] font-semibold pointer-events-none">
                {initials(g)}
              </text>
            ) : (
              <text
                y={4}
                textAnchor="middle"
                fill={potential ? shareTextColor(share) : happinessTextColor(h)}
                className={`${potential && share !== null && share >= 0.995 ? 'text-[11px]' : 'text-[12px]'} font-bold font-mono pointer-events-none`}
              >
                {potential ? formatShare(share) : formatScore(h)}
              </text>
            )}
            <text
              y={seat.side === 'R' ? R + 14 : -R - 7}
              textAnchor="middle"
              className={`text-[10px] pointer-events-none ${isSelected ? 'fill-black font-bold' : 'fill-zinc-700'}`}
            >
              {labels[g]}
            </text>
            {mustHead[g] === 1 && !clean && (
              <text x={-R - 2} y={-R + 10} className="text-[13px] fill-amber-600 pointer-events-none">
                ♛
              </text>
            )}
            {lockedSeats.has(s) && !clean && (
              <text x={R - 10} y={-R + 9} className="text-[11px] pointer-events-none">
                🔒
              </text>
            )}
          </g>
        )
      })}

      {drag?.moved && canEdit && !lockedSeats.has(drag.fromSeat) && (
        <g transform={`translate(${drag.x}, ${drag.y})`} pointerEvents="none" className="drop-shadow-lg">
          <circle r={R + 2} fill={fillOf(drag.guest)} stroke="#18181b" strokeWidth={2} />
          <text y={4} textAnchor="middle" className="fill-black text-[11px] font-bold pointer-events-none">
            {labels[drag.guest].split(' ')[0]}
          </text>
        </g>
      )}

      {/* What-if badge */}
      {preview && (
        <g transform={`translate(${preview.at.x}, ${preview.at.y - R - 26})`} pointerEvents="none">
          <rect x={-30} y={-13} width={60} height={22} rx={11} className={preview.delta >= 0 ? 'fill-emerald-600' : 'fill-rose-600'} />
          <text y={3} textAnchor="middle" className="fill-white text-[12px] font-bold font-mono">
            {formatSigned(preview.delta)}
          </text>
        </g>
      )}
    </svg>
  )
}
