'use client'

import { useLayoutEffect, useRef } from 'react'
import { getSegmentInfo } from '@/lib/smsText'
import { Icon, ICONS, Spinner } from './ui'
import { useMediaQuery } from './utils'

interface ReplyBoxProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  isSending?: boolean
  submitLabel?: string
}

const MAX_HEIGHT_PX = 160

export default function ReplyBox({ value, onChange, onSubmit, placeholder, isSending, submitLabel = 'Send' }: ReplyBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isTouch = useMediaQuery('(pointer: coarse)')
  const segments = getSegmentInfo(value)
  const canSend = value.trim().length > 0 && !isSending

  // Grow with content up to a cap, then scroll
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  const submit = () => {
    if (canSend) onSubmit()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="border-t border-zinc-200/80 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // On desktop Enter sends; on touch keyboards Enter inserts a newline
            if (e.key === 'Enter' && !e.shiftKey && !isTouch) {
              e.preventDefault()
              submit()
            }
          }}
          className="flex-1 min-w-0 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base leading-snug font-karla text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-sage focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={submitLabel}
          className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
            canSend ? 'bg-sage text-white hover:bg-black cursor-pointer' : 'bg-zinc-100 text-zinc-300'
          }`}
        >
          {isSending ? <Spinner /> : <Icon path={ICONS.send} className="w-5 h-5" />}
        </button>
      </div>
      {(segments.segments > 1 || segments.isUnicode) && (
        <p className="mt-1.5 px-2 text-[11px] font-karla text-zinc-400">
          {segments.length} characters · {segments.segments} SMS
          {segments.isUnicode && ' · emoji or special characters use 70 per SMS'}
        </p>
      )}
    </form>
  )
}
