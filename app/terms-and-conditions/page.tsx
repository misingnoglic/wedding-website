import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions | The Wedding of Arya & Christa',
  description: 'Terms and Conditions for the wedding website of Arya and Christa.',
}

export default function TermsAndConditions() {
  return (
    <div className="w-full max-w-3xl px-4 py-8 md:py-16 animate-fade-in text-left">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-script mb-3 text-black">Terms & Conditions</h1>
        <p className="text-xs uppercase tracking-widest font-karla text-zinc-500">
          Last Updated: August 2026
        </p>
      </div>

      <div className="space-y-10 font-karla text-zinc-600 leading-relaxed">
        <section>
          <p className="text-base text-zinc-700">
            Welcome to the wedding website of Arya and Christa (<a href="https://www.aryachrista.wedding" className="text-sage hover:underline">www.aryachrista.wedding</a>). These Terms and Conditions govern your access to and use of this website. By accessing or using this website, you agree to be bound by these terms.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            1. Purpose of the Website
          </h2>
          <p>
            This website is provided exclusively for the invited guests, family, and friends of Arya and Christa to share event details, manage RSVPs, provide travel recommendations, and facilitate wedding planning logistics for our celebration in Cabo San Lucas, Mexico.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            2. Access & Authentication
          </h2>
          <p>
            Certain sections of this website (such as the RSVP portal) are restricted to invited guests and secured via individualized credentials or invitation passwords. You agree to maintain the confidentiality of your access credentials and not share them with unauthorized parties.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            3. SMS & Electronic Communications
          </h2>
          <p className="mb-3">
            By providing your contact information (email address and phone number) on the website or RSVP form, you agree that we may send you administrative notices, reminders, schedule updates, and logistical information regarding the wedding via email and text message (SMS).
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Consent to receive communications is voluntary.</li>
            <li>Standard message and data rates may apply depending on your wireless carrier.</li>
            <li>You may opt out of SMS messages at any time by replying <strong>STOP</strong> or contacting us directly.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            4. User Conduct
          </h2>
          <p className="mb-3">When using this website, you agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Submit inaccurate, misleading, or fraudulent RSVP and guest information.</li>
            <li>Attempt to interfere with, disrupt, or compromise the integrity or security of the website.</li>
            <li>Use automated systems, bots, or scripts to access or extract content from this website.</li>
          </ul>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            5. Intellectual Property
          </h2>
          <p>
            All custom artwork, photographs, text, designs, sketches, and materials published on this website are the personal property of Arya and Christa or used with appropriate permission. Unauthorized copying, distribution, or commercial use of any content is strictly prohibited.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            6. Third-Party Services & External Links
          </h2>
          <p>
            Our website may include links to external third-party websites for your convenience, such as hotel booking portals (The Cape, Thompson Hotels/Hyatt, Sunrock Hotel), flight search engines (Google Flights), and local transportation providers. We are not responsible for the content, privacy practices, terms, or availability of these external third-party services.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            7. Disclaimer of Warranties & Limitation of Liability
          </h2>
          <p>
            This website and its content are provided on an &quot;as is&quot; and &quot;as available&quot; basis for personal informational purposes. While we strive to ensure all event details, schedules, and recommendations are accurate and up-to-date, schedules and event specifics may change.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            8. Changes to These Terms
          </h2>
          <p>
            We may revise these Terms and Conditions from time to time. Any updates will be posted directly to this page with an updated effective date.
          </p>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className="text-xl font-sans font-medium text-black uppercase tracking-wider mb-3">
            9. Contact Information
          </h2>
          <p>
            If you have any questions regarding these Terms & Conditions, please contact us at:{' '}
            <a href="mailto:aryaandchrista@gmail.com" className="text-sage hover:underline font-medium">
              aryaandchrista@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
