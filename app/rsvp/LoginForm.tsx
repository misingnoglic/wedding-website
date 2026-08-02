'use client'

import { useActionState } from 'react'
import { loginFamily } from '@/app/actions/rsvp'

interface LoginFormProps {
  redirectUrl?: string
  title?: string
  subtitle?: string
  buttonText?: string
}

export default function LoginForm({
  redirectUrl = '/rsvp',
  title = 'Welcome',
  subtitle = 'Please enter your password to continue.',
  buttonText = 'Continue',
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginFamily, null)

  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 animate-fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-sans text-black mb-2">{title}</h2>
        <p className="text-zinc-500 font-karla">{subtitle}</p>
      </div>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="redirectUrl" value={redirectUrl} />
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
            Password
          </label>
          <input
            type="text"
            id="password"
            name="password"
            placeholder="e.g. SMITH"
            className="w-full px-4 py-3 bg-white/50 border border-sage-200 focus:border-sage focus:ring-1 focus:ring-sage rounded-xl font-karla outline-none transition-all text-black"
            required
            autoComplete="off"
          />
        </div>

        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-karla text-center animate-pulse">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-4 bg-sage text-white rounded-xl font-sans tracking-widest uppercase text-sm hover:bg-black hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? 'Accessing...' : buttonText}
        </button>
      </form>
    </div>
  )
}
