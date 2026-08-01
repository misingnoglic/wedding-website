'use client'

import { addGuestAdmin } from '@/app/actions/admin'
import { FamilyWithGuests, TITLE_OPTIONS } from '../../types'

interface AddGuestModalProps {
  family: FamilyWithGuests | null
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function AddGuestModal({
  family,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: AddGuestModalProps) {
  if (!family) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full border border-zinc-200 shadow-2xl space-y-6">
        <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-2xl font-sans text-black">Add Guest to Party</h3>
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
              const res = await addGuestAdmin(null, formData)
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Title
              </label>
              <select
                name="title"
                defaultValue="None"
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none text-xs"
              >
                {TITLE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Maria Sanchez"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              name="email"
              placeholder="maria@example.com"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Phone (Optional)
            </label>
            <input
              type="tel"
              name="phoneNumber"
              placeholder="+1 (555) 000-0000"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage outline-none"
            />
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
              {isPending ? 'Adding...' : 'Add Guest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
