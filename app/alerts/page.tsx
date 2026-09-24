"use client"

import { useState } from 'react'

export default function AlertsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate network latency (between 0.2s and 1.1s)
    const delay = Math.random() * 900 + 200
    await new Promise(resolve => setTimeout(resolve, delay))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  return (
    <div className="w-full max-w-lg px-4 py-16 mx-auto animate-fade-in flex flex-col items-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-script mb-3 text-black">Event Registration</h1>
        <p className="text-zinc-600 font-karla">
          Register for the upcoming event and optionally sign up for automated SMS notifications.
        </p>
      </div>

      <div className="w-full bg-white p-6 rounded-lg shadow-sm border border-zinc-200 min-h-[300px] flex flex-col justify-center">
        {isSubmitted ? (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 bg-sage/10 text-sage rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-sans font-medium text-black uppercase tracking-wider mb-2">Thank you</h2>
            <p className="text-zinc-600 font-karla">
              Your registration has been received successfully.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="mt-6 text-sm text-sage hover:text-black transition-colors uppercase tracking-widest font-sans"
            >
              Submit another registration
            </button>
          </div>
        ) : (
          <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1 font-sans uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Jane Doe"
                className="w-full p-3 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-sage focus:border-sage transition-colors font-karla disabled:opacity-50"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1 font-sans uppercase tracking-wider">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="jane@example.com"
                className="w-full p-3 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-sage focus:border-sage transition-colors font-karla disabled:opacity-50"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1 font-sans uppercase tracking-wider">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="(555) 555-5555"
                className="w-full p-3 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-sage focus:border-sage transition-colors font-karla disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="sms-consent"
                  name="sms-consent"
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-sage focus:ring-sage disabled:opacity-50"
                  disabled={isSubmitting}
                />
              </div>
              <label htmlFor="sms-consent" className={`text-sm font-karla leading-relaxed ${isSubmitting ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <strong>Optional SMS Alerts:</strong> I consent to receive automated transactional SMS notifications regarding event logistics, schedule updates, and registration status from the Event Management Platform. Message frequency varies. Message and data rates may apply. Reply STOP to cancel.
              </label>
            </div>

            <p className="text-xs text-zinc-500 font-karla">
              By submitting this form, you agree to our <a href="/terms-and-conditions" className="underline hover:text-sage">Terms & Conditions</a> and <a href="/privacy-policy" className="underline hover:text-sage">Privacy Policy</a>.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black text-white p-3 rounded font-sans uppercase tracking-widest text-sm hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 flex justify-center items-center h-12"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Complete Registration"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
