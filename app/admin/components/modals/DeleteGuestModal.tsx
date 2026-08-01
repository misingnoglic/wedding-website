'use client'

import { deleteGuestAdmin } from '@/app/actions/admin'
import { FlatGuest } from '../../types'

interface DeleteGuestModalProps {
  guest: FlatGuest | null
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function DeleteGuestModal({
  guest,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: DeleteGuestModalProps) {
  if (!guest) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full border border-red-200 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <div className="p-2 bg-red-100 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <h3 className="text-xl font-sans text-black">Remove Guest?</h3>
        </div>

        <p className="text-xs font-karla text-zinc-600 leading-relaxed">
          Are you sure you want to remove <strong>{guest.name}</strong> from{' '}
          <strong>{guest.familyName}</strong>?
        </p>

        <form
          action={async (formData) => {
            startTransition(async () => {
              const res = await deleteGuestAdmin(formData)
              if (res?.error) {
                setActionFeedback({ error: res.error })
              } else {
                setActionFeedback({ success: res?.message })
                onClose()
              }
            })
          }}
          className="flex justify-end gap-3 pt-4 border-t border-zinc-100"
        >
          <input type="hidden" name="guestId" value={guest.id} />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-sans uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-sans uppercase tracking-wider hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Removing...' : 'Remove Guest'}
          </button>
        </form>
      </div>
    </div>
  )
}
