'use client'

import { deleteFamilyAdmin } from '@/app/actions/admin'
import { FamilyWithGuests } from '../../types'

interface DeleteFamilyModalProps {
  family: FamilyWithGuests | null
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function DeleteFamilyModal({
  family,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: DeleteFamilyModalProps) {
  if (!family) return null

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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-sans text-black">Delete &ldquo;{family.name}&rdquo;?</h3>
        </div>

        <p className="text-xs font-karla text-zinc-600 leading-relaxed">
          Are you sure you want to permanently delete this party and all{' '}
          <strong>{family.guests.length} guest records</strong> associated with it? This action cannot be undone.
        </p>

        <form
          action={async (formData) => {
            startTransition(async () => {
              const res = await deleteFamilyAdmin(formData)
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
          <input type="hidden" name="familyId" value={family.id} />
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
            {isPending ? 'Deleting...' : 'Delete Party'}
          </button>
        </form>
      </div>
    </div>
  )
}
