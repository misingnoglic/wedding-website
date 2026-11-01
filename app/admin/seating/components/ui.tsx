'use client'

import { ReactNode, useState } from 'react'

type TipPlacement = { side?: 'top' | 'bottom'; align?: 'left' | 'center' | 'right' }

const TIP_SIDE = { top: 'bottom-full mb-1.5', bottom: 'top-full mt-1.5' }
const TIP_ALIGN = { left: '-left-1', center: 'left-1/2 -translate-x-1/2', right: '-right-1' }

/**
 * Shows `text` in a dark bubble while hovering or focusing the children. Shows instantly, unlike
 * the native title tooltip.
 */
export function Tip({ text, children, className = '', side = 'top', align = 'left' }: { text?: string; children: ReactNode; className?: string } & TipPlacement) {
  if (!text) return <>{children}</>
  return (
    <span className={`relative group/tip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-60 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-left text-[11px] font-normal leading-snug normal-case tracking-normal text-white shadow-lg opacity-0 invisible transition-opacity delay-100 group-hover/tip:visible group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:visible group-has-[:focus-visible]/tip:opacity-100 ${TIP_SIDE[side]} ${TIP_ALIGN[align]}`}
      >
        {text}
      </span>
    </span>
  )
}

// A small "?" after a label that explains it on hover
export function Help({ text, ...placement }: { text?: string } & TipPlacement) {
  if (!text) return null
  return (
    <Tip text={text} className="inline-flex align-middle ml-1" {...placement}>
      <span
        tabIndex={0}
        aria-label={text}
        onClick={(e) => e.preventDefault()} // Don't toggle the control when inside a <label>
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-zinc-300 text-[9px] font-semibold leading-none text-zinc-400 cursor-help hover:border-zinc-900 hover:text-zinc-900 focus:outline-none focus:border-zinc-900 focus:text-zinc-900"
      >
        ?
      </span>
    </Tip>
  )
}

// A label with its help marker
export function Label({ text, help, className = 'text-zinc-600', ...placement }: { text: ReactNode; help?: string; className?: string } & TipPlacement) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {text}
      <Help text={help} {...placement} />
    </span>
  )
}

export function Card({
  title,
  help,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  help?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          {title && (
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 inline-flex items-center">
              {title}
              <Help text={help} />
            </h3>
          )}
          {actions}
        </div>
      )}
      <div className="px-4 pb-4">{children}</div>
    </section>
  )
}

export function Collapsible({ title, help, defaultOpen = true, children }: { title: string; help?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
        <span className="inline-flex items-center">
          <button type="button" onClick={() => setOpen(!open)} className="uppercase tracking-wider cursor-pointer">
            {title}
          </button>
          <Help text={help} />
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-right cursor-pointer" aria-label={open ? 'Collapse' : 'Expand'}>
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        </button>
      </div>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
  format = (v) => String(v),
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  help?: string
  format?: (value: number) => string
  disabled?: boolean
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs">
        <Label text={label} help={help} />
        <span className="font-mono text-zinc-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black disabled:opacity-40"
      />
    </label>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  help?: string
  disabled?: boolean
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <Label text={label} help={help} />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        className="w-28 border border-zinc-200 rounded-lg px-2 py-1 text-right font-mono text-xs disabled:opacity-40"
      />
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string; title?: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex w-full p-0.5 bg-zinc-100 rounded-lg">
      {options.map((o, i) => (
        <Tip key={o.value} text={o.title} className="flex-1 flex" align={i === 0 ? 'left' : i === options.length - 1 ? 'right' : 'center'}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`flex-1 px-2 py-1 rounded-md text-xs transition-all cursor-pointer disabled:cursor-not-allowed ${
              value === o.value ? 'bg-white text-black shadow-sm font-medium' : 'text-zinc-500 hover:text-black'
            }`}
          >
            {o.label}
          </button>
        </Tip>
      ))}
    </div>
  )
}

export function Stat({
  label,
  value,
  tone = 'default',
  hint,
  ...placement
}: { label: string; value: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad'; hint?: string } & TipPlacement) {
  const toneClass = {
    default: 'text-black',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  }[tone]
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold inline-flex items-center">
        {label}
        <Help text={hint} {...placement} />
      </div>
      <div className={`text-lg font-mono font-semibold leading-tight ${toneClass}`}>{value}</div>
    </div>
  )
}
