'use client'

import { updateFamilyAdmin } from '@/app/actions/admin'
import { FamilyWithGuests } from '../../types'

interface EditFamilyModalProps {
  family: FamilyWithGuests | null
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function EditFamilyModal({
  family,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: EditFamilyModalProps) {
  if (!family) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full border border-zinc-200 shadow-2xl space-y-6">
        <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-2xl font-sans text-black">Edit Family Details</h3>
            <p className="text-xs font-karla text-zinc-500 mt-0.5">{family.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-black text-xl p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form
          action={async (formData) => {
            startTransition(async () => {
              const res = await updateFamilyAdmin(null, formData)
              if (res?.error) {
                setActionFeedback({ error: res.error })
              } else {
                setActionFeedback({ success: res?.message })
                onClose()
              }
            })
          }}
          className="space-y-4 font-karla text-sm"
        >
          <input type="hidden" name="familyId" value={family.id} />

          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Family / Party Name *
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={family.name}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage focus:ring-1 focus:ring-sage outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Invitation Access Code *
            </label>
            <input
              type="text"
              name="password"
              required
              defaultValue={family.password}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono focus:border-sage focus:ring-1 focus:ring-sage outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editIsAdminCheckbox"
              name="isAdmin"
              value="true"
              defaultChecked={family.isAdmin}
              className="accent-sage w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="editIsAdminCheckbox" className="text-xs text-zinc-700 cursor-pointer select-none">
              Grant Admin Privileges (Admin Dashboard access)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
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
              className="px-5 py-2.5 bg-black text-white rounded-xl text-xs font-sans uppercase tracking-wider hover:bg-sage transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
