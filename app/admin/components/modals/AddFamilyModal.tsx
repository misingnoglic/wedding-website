'use client'

import { useState } from 'react'
import { createFamilyAdmin } from '@/app/actions/admin'
import { TITLE_OPTIONS } from '../../types'

interface AddFamilyModalProps {
  isOpen: boolean
  onClose: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  setActionFeedback: (feedback: { error?: string; success?: string } | null) => void
}

export default function AddFamilyModal({
  isOpen,
  onClose,
  isPending,
  startTransition,
  setActionFeedback,
}: AddFamilyModalProps) {
  const [guests, setGuests] = useState<Array<{ title: string; name: string; email: string; phoneNumber: string }>>([
    { title: 'None', name: '', email: '', phoneNumber: '' },
  ])

  if (!isOpen) return null

  const generateSuggestedCode = (familyName: string) => {
    const cleanName = familyName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8)
    const suffix = '26'
    return cleanName ? `${cleanName}${suffix}` : `INVITE${Math.floor(100 + Math.random() * 900)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-xl w-full border border-zinc-200 shadow-2xl space-y-6 my-8">
        <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-2xl font-sans text-black">Add New Family / Party</h3>
            <p className="text-xs font-karla text-zinc-500 mt-0.5">
              Create a new guest invitation with a custom access code and party members.
            </p>
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
            formData.set('guestsJson', JSON.stringify(guests))
            startTransition(async () => {
              const res = await createFamilyAdmin(null, formData)
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
          {/* Family Name */}
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500 mb-1">
              Family / Party Name *
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. The Rodriguez Family or John & Sarah"
              onChange={(e) => {
                const codeInput = document.getElementById('new-family-code') as HTMLInputElement
                if (codeInput && (!codeInput.value || codeInput.dataset.touched !== 'true')) {
                  codeInput.value = generateSuggestedCode(e.target.value)
                }
              }}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-sage focus:ring-1 focus:ring-sage outline-none"
            />
          </div>

          {/* Password / Code */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500">
                Invitation Access Code *
              </label>
              <button
                type="button"
                onClick={() => {
                  const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement
                  const codeInput = document.getElementById('new-family-code') as HTMLInputElement
                  if (codeInput) {
                    codeInput.value = generateSuggestedCode(nameInput?.value || 'GUEST')
                    codeInput.dataset.touched = 'true'
                  }
                }}
                className="text-xs text-sage hover:underline uppercase tracking-wider font-sans cursor-pointer"
              >
                Auto-Generate Code
              </button>
            </div>
            <input
              id="new-family-code"
              type="text"
              name="password"
              required
              placeholder="e.g. RODRIGUEZ26"
              onChange={() => {
                const codeInput = document.getElementById('new-family-code') as HTMLInputElement
                if (codeInput) codeInput.dataset.touched = 'true'
              }}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono focus:border-sage focus:ring-1 focus:ring-sage outline-none uppercase"
            />
          </div>

          {/* Admin Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isAdminCheckbox"
              name="isAdmin"
              value="true"
              className="accent-sage w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="isAdminCheckbox" className="text-xs text-zinc-700 cursor-pointer select-none">
              Grant Admin Privileges (Can view this dashboard and edit guests)
            </label>
          </div>

          {/* Party Members Builder */}
          <div className="border-t border-zinc-100 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-sans uppercase tracking-wider text-zinc-500">
                Party Guests ({guests.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  setGuests((prev) => [...prev, { title: 'None', name: '', email: '', phoneNumber: '' }])
                }}
                className="text-xs text-sage hover:underline uppercase tracking-wider font-sans cursor-pointer"
              >
                + Add Another Guest
              </button>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {guests.map((g, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-50 rounded-xl border border-zinc-200/80">
                  <select
                    value={g.title}
                    onChange={(e) => {
                      const val = e.target.value
                      setGuests((prev) => prev.map((item, i) => (i === idx ? { ...item, title: val } : item)))
                    }}
                    className="px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-sage"
                  >
                    {TITLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t === 'None' ? 'Title...' : t}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    required
                    placeholder="Guest full name *"
                    value={g.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setGuests((prev) => prev.map((item, i) => (i === idx ? { ...item, name: val } : item)))
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-sage"
                  />

                  {guests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setGuests((prev) => prev.filter((_, i) => i !== idx))
                      }}
                      className="text-zinc-400 hover:text-red-600 p-1 text-xs cursor-pointer"
                      title="Remove guest"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
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
              {isPending ? 'Creating...' : 'Create Family Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
