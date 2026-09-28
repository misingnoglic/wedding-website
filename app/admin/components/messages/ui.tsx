import { initials } from './utils'

export function Avatar({ name, known, size = 'md' }: { name: string; known: boolean; size?: 'sm' | 'md' }) {
  const dimensions = size === 'sm' ? 'w-9 h-9 text-[11px]' : 'w-11 h-11 text-xs'
  return (
    <div
      className={`${dimensions} rounded-full flex items-center justify-center font-sans font-semibold shrink-0 ${
        known ? 'bg-sage text-white' : 'bg-zinc-200 text-zinc-500'
      }`}
    >
      {known ? (
        initials(name)
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
    </div>
  )
}

export function Icon({ path, className = 'w-5 h-5' }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

export const ICONS = {
  back: 'M15 19l-7-7 7-7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  send: 'M5 12h14M12 5l7 7-7 7',
  check: 'M5 13l4 4L19 7',
  close: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  compose: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  alert: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <div className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin`} />
}
