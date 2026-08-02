import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | The Wedding of Arya & Christa',
  description: 'Privacy Policy for the wedding website of Arya and Christa.',
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
            Welcome to the wedding website of Arya and Christa (<a href="https://www.aryachrista.wedding" className="text-sage hover:underline">www.aryachrista.wedding</a>). We respect your privacy and are committed to protecting the personal information you share with us as we plan and celebrate our special day.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            1. Information We Collect
          </h2>
          <p className="mb-3">
            When you interact with our website and RSVP form, we may collect the following personal information:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-zinc-800">Contact Information:</strong> Names, email addresses, and phone numbers.
            </li>
            <li>
              <strong className="text-zinc-800">RSVP & Event Preferences:</strong> Attendance status for the Welcome Party and Wedding Ceremony/Reception, dietary restrictions, food allergies, and song requests.
            </li>
            <li>
              <strong className="text-zinc-800">Travel & Lodging Details:</strong> Optional details including arrival and departure flight numbers, travel dates, and hotel or accommodation names to help us coordinate event logistics.
            </li>
            <li>
              <strong className="text-zinc-800">Usage Data:</strong> Basic website analytics and session tokens to ensure our website functions securely and smoothly.
            </li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            2. How We Use Your Information
          </h2>
          <p className="mb-3">We use your information solely for purposes related to our wedding festivities, including:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Managing guest lists and headcount for event coordination.</li>
            <li>Communicating event schedules, travel tips, venue directions, reminders, and updates.</li>
            <li>Accommodating dietary requirements and allergies with our catering team and venue.</li>
            <li>Coordinating airport transfers, group logistics, and activities in Cabo San Lucas.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            3. SMS & Email Communications
          </h2>
          <p className="mb-3">
            By providing your mobile phone number and email address on our RSVP form, you consent to receive text messages (SMS) and emails from us regarding event details, reminders, schedule updates, and important wedding announcements.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Message frequency may vary leading up to and during the wedding weekend in December 2026.</li>
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
            Your information is shared only on a confidential, need-to-know basis with trusted event partners (such as our wedding coordinator, catering staff, and venue at The Cape) solely for executing wedding-related services.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            5. Data Security & Retention
          </h2>
          <p>
            We implement appropriate technical measures to protect your personal data against unauthorized access. We retain your information only as long as necessary to plan, celebrate, and follow up after the wedding events conclude.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            6. Updating or Removing Your Information
          </h2>
          <p>
            You may review, update, or request the removal of your RSVP information and contact details at any time through the RSVP section or by emailing us directly.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            7. Contact Us
          </h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or your personal information, please feel free to reach out to us at:{' '}
            <a href="mailto:aryaandchrista@gmail.com" className="text-sage hover:underline font-medium">
              aryaandchrista@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
