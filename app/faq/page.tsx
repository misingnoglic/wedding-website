export default function FAQ() {
    const faqs = [
        {
            question: "How do we RSVP?",
            answer: "RSVPs will open once the formal invitation is sent out. If you know for sure you cannot come, please email us at aryaandchrista@gmail.com to let us know.",
        },
        {
            question: "What days should we arrive and depart?",
            answer: "We suggest arriving on Thursday and departing on Sunday to ensure you have plenty of time to enjoy the festivities!",
        },
        {
            question: "Are children welcome?",
            answer: "Yes! The Cape is a family-friendly hotel, and children are welcome to celebrate with us.",
        },
        {
            question: "Will the wedding be indoors or outdoors?",
            answer: "The ceremony will be outdoors. The reception will be at an indoor/outdoor venue until 11pm when the doors will close and it will be indoor only.",
        },
        {
            question: "What is the dress code?",
            answer: "The dress code is beach formal. The ceremony and reception are taking place outdoors at the hotel (not on the sand). The weather will be 70–80°F during the day and drop to the 60s after sunset. More details to follow.",
        },
        {
            question: "Is the area safe?",
            answer: "Yes, the city is very safe and the \"Tourist Corridor\" between Cabo San Lucas and San José del Cabo is heavily patrolled by federal and local security forces to protect the tourism economy. The Cape also has enhanced security and verifies that everyone coming into the hotel is either a registered guest or specifically invited.",
        },
        {
            question: "How do we find flights?",
            answer: (
                <>
                    We suggest using <a href="https://www.google.com/travel/flights" target="_blank" rel="noopener noreferrer" className="text-sage hover:underline">Google Flights</a> and putting <strong>SJD</strong> as the destination with the Thursday-Sunday dates.
                </>
            ),
        },
        {
            question: "Is there anything you recommend doing in the area?",
            answer: "If you have an extra day, we highly recommend renting a car or booking transport to Balandra Beach in La Paz. It is the most beautiful beach we have ever been to (they only allow 450 visitors a day, so arrive early!). For shorter activities, we recommend going to Marina Cabo San Lucas and taking a boat tour.",
        },
        {
            question: "Where should we stay?",
            answer: (
                <>
                    Our wedding will be held at <strong>The Cape, a Thompson Hotel, by Hyatt</strong> in Cabo San Lucas, Mexico. We have secured a room block for our guests with a minimum stay of 3 days that gives a discount for The Cape. You are welcome to stay at any hotel you want! You can book The Cape using our <a href="https://www.hyatt.com/events/en-US/group-booking/CSLTH/G-CABO" target="_blank" rel="noopener noreferrer" className="text-sage hover:underline">room block link</a>.
                </>
            ),
        },
        {
            question: "Are there any alternative hotels you recommend?",
            answer: (
                <>
                    Yes! For a more affordable option within walking distance of the wedding venue, we recommend checking out <a href="https://reservas.brisas.com.mx/44/rooms" target="_blank" rel="noopener noreferrer" className="text-sage hover:underline">this hotel</a>. If you are looking for an all-inclusive experience, <strong>Pueblo Bonito Rosé Resort & Spa</strong> is a great option about 20 minutes away.
                </>
            ),
        },
        {
            question: "How do we get from the airport to the hotel?",
            answer: (
                <>
                    You can take an official taxi, Uber, or InDrive from Los Cabos International Airport (SJD). Please see our <a href="/travel" className="text-sage hover:underline">Travel & Accommodations page</a> for complete directions. For taxis, go through immigration, skip the information booths, and find the yellow "authorized taxi" booth outside. For Uber/InDrive, you must go upstairs to the departures level to be picked up.
                </>
            ),
        },
        {
            question: "How can we contact you or stay updated?",
            answer: (
                <>
                    You can email us anytime at <a href="mailto:aryaandchrista@gmail.com" className="text-sage hover:underline">aryaandchrista@gmail.com</a>. You can also sign up for our mailing list on the <a href="/contact" className="text-sage hover:underline">Contact page</a> to receive updates on the wedding weekend!
                </>
            ),
        },
    ];

    return (
        <div className="w-full max-w-3xl px-4 py-16 md:py-24 animate-fade-in text-left">
            <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Frequently Asked Questions</h1>

            <div className="space-y-8">
                {faqs.map((faq, index) => (
                    <div key={index} className="border-b border-zinc-200 pb-6">
                        <h3 className="text-xl font-sans font-medium mb-3 text-black">
                            {faq.question}
                        </h3>
                        <p className="text-zinc-600 font-karla leading-relaxed">
                            {faq.answer}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-16 text-center">
                <p className="text-zinc-500 font-karla">
                    Have more questions?{" "}
                    <a href="/contact" className="text-sage hover:underline underline-offset-4">
                        Contact us
                    </a>
                </p>
            </div>
        </div>
    );
}
