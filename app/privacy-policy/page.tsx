import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Event Management Platform',
  description: 'Privacy Policy for the Event Management Platform.',
}

export default function PrivacyPolicy() {
  return (
    <div className="w-full max-w-3xl px-4 py-8 md:py-16 animate-fade-in text-left">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-script mb-3 text-black">Privacy Policy</h1>
        <p className="text-xs uppercase tracking-widest font-karla text-zinc-500">
          Last Updated: August 2026
        </p>
      </div>

      <div className="space-y-10 font-karla text-zinc-600 leading-relaxed">
        <section>
          <p className="text-base text-zinc-700">
            Welcome to the Event Management Platform (<a href="https://www.aryachrista.wedding" className="text-sage hover:underline">www.aryachrista.wedding</a>). We respect your privacy and are committed to protecting the personal information you share with us as we manage event logistics.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            1. Information We Collect
          </h2>
          <p className="mb-3">
            When you interact with our website and registration portal, we may collect the following personal information:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-zinc-800">Contact Information:</strong> Names, email addresses, and phone numbers.
            </li>
            <li>
              <strong className="text-zinc-800">Registration Details:</strong> Attendance status and event preferences.
            </li>
            <li>
              <strong className="text-zinc-800">Usage Data:</strong> Basic website analytics and session tokens to ensure our platform functions securely and smoothly.
            </li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            2. How We Use Your Information
          </h2>
          <p className="mb-3">We use your information solely for purposes related to event management, including:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Managing guest lists and headcount for event coordination.</li>
            <li>Communicating event schedules, reminders, and updates.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            3. SMS & Email Communications
          </h2>
          <p className="mb-3">
            By providing your mobile phone number and email address on our registration form, you consent to receive text messages (SMS) and emails from us regarding event details, reminders, schedule updates, and important announcements.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Message frequency may vary.</li>
            <li>Standard message and data rates may apply depending on your mobile carrier plan.</li>
            <li>You can opt out of text messaging at any time by replying <strong>STOP</strong> or contacting us directly.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            4. Information Sharing & Third Parties
          </h2>
          <p className="mb-3">
            We will <strong className="text-zinc-800">never sell, rent, or trade</strong> your personal information to third parties for marketing or promotional purposes.
          </p>
          <p>
            Your information is shared only on a confidential, need-to-know basis with trusted event partners solely for executing event-related services.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            5. Data Security & Retention
          </h2>
          <p>
            We implement appropriate technical measures to protect your personal data against unauthorized access. We retain your information only as long as necessary to manage the event.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            6. Updating or Removing Your Information
          </h2>
          <p>
            You may review, update, or request the removal of your information and contact details at any time by emailing us directly.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            7. Contact Us
          </h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or your personal information, please feel free to reach out to us at:{' '}
            <a href="mailto:admin@aryachrista.wedding" className="text-sage hover:underline font-medium">
              admin@aryachrista.wedding
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
