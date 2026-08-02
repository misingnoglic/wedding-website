import { getAuthenticatedFamily } from '@/lib/auth'
import RsvpForm from './RsvpForm'

export default async function RsvpPage() {
  const family = await getAuthenticatedFamily('/rsvp')

  return (
    <div className="w-full max-w-4xl px-4 flex-grow py-8 md:py-12 flex flex-col items-center mx-auto animate-fade-in">
      <div className="w-full text-center mb-6">
        <h1 className="text-5xl md:text-7xl font-script mb-2">RSVP</h1>
        <p className="text-zinc-600 uppercase tracking-widest font-karla font-semibold text-xs md:text-sm">
          Kindly reply by September 30, 2026
        </p>
      </div>

      <RsvpForm family={family} />
    </div>
  )
}
