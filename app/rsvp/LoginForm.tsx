'use client'

import { useActionState, useState } from 'react'
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
  // The field is a real password input so password managers save it; echo it below so guests can check what they typed
  const [password, setPassword] = useState('')

  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 animate-fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-sans text-black mb-2">{title}</h2>
        <p className="text-zinc-500 font-karla">{subtitle}</p>
      </div>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="redirectUrl" value={redirectUrl} />
        {/* Password managers save credentials as a username/password pair; this names the saved entry */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value="Arya & Christa Wedding"
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password here"
            className="w-full px-4 py-3 bg-white/50 border border-sage-200 focus:border-sage focus:ring-1 focus:ring-sage rounded-xl font-karla outline-none transition-all text-black"
            required
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
          />
          {/* Always rendered (just invisible when empty) so the line's space is reserved and the button doesn't shift */}
          <p
            aria-hidden={!password}
            className={`mt-2 min-h-6 text-base font-karla text-zinc-600 break-all ${password ? '' : 'invisible'}`}
          >
            You typed: <span className="font-semibold text-black">{password}</span>
          </p>
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
