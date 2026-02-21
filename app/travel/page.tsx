import Link from "next/link";

export default function Travel() {
    return (
        <div className="w-full max-w-4xl px-4 py-16 md:py-24 animate-fade-in text-left">
            <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Travel & Accommodations</h1>

            <div className="space-y-16">
                <section>
                    <h2 className="text-3xl font-sans mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                        The Hotel
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 font-karla leading-relaxed text-lg mb-4">
                        Our wedding will be held at <strong>The Cape, a Thompson Hotel</strong> in beautiful Cabo San Lucas, Mexico.
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400 font-karla leading-relaxed text-lg mb-6">
                        We have secured a room block for our guests at a discounted rate. While you are welcome to stay at any hotel in the area, we would love for you to join us at The Cape. Please note that the room block requires a minimum stay of 3 days.
                    </p>
                    <a
                        href="https://www.hyatt.com/events/en-US/group-booking/CSLTH/G-CABO"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-8 py-4 bg-black text-white dark:bg-white dark:text-black font-sans tracking-wide uppercase text-sm hover:bg-sage dark:hover:bg-sage hover:text-white transition-colors duration-300"
                    >
                        Book Room Block
                    </a>
                </section>

                <section>
                    <h2 className="text-3xl font-sans mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                        Getting There
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 font-karla leading-relaxed text-lg mb-8">
                        You will want to fly into <strong>Los Cabos International Airport (SJD)</strong>.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-sm border border-zinc-100 dark:border-zinc-800">
                            <h3 className="text-xl font-sans mb-3">Taxis</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 font-karla text-base mb-2">
                                Go to the official taxi stand outside the airport.
                            </p>
                            <p className="text-red-600 dark:text-red-400 font-karla text-sm">
                                <strong>Important:</strong> Do not accept rides from people walking up to you inside the airport terminal.
                            </p>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-sm border border-zinc-100 dark:border-zinc-800">
                            <h3 className="text-xl font-sans mb-3">Uber</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 font-karla text-base mb-2">
                                You can use the regular Uber app. Credit cards are accepted.
                            </p>
                            <p className="text-zinc-600 dark:text-zinc-400 font-karla text-sm">
                                <strong>Pickup Location:</strong> You must go up the stairs and walk to "Puerto 1" to be picked up.
                            </p>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-sm border border-zinc-100 dark:border-zinc-800">
                            <h3 className="text-xl font-sans mb-3">InDrive App</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 font-karla text-base mb-2">
                                For a potentially cheaper ride, you can use the InDrive app which lets you offer your own prices.
                            </p>
                            <p className="text-zinc-600 dark:text-zinc-400 font-karla text-sm">
                                <strong>Note:</strong> Cash only. Pickup is at the same "Puerto 1" location as Uber.
                            </p>
                        </div>

                        <div className="bg-sage/10 p-6 rounded-sm border border-sage/30">
                            <h3 className="text-xl font-sans mb-3 text-sage">Pro Tip: The Toll Road</h3>
                            <p className="text-zinc-700 dark:text-zinc-300 font-karla text-base">
                                For taxis and rideshare, make sure they take the toll road (in Spanish: "carretera de peaje"). Otherwise, it can take significantly longer to reach the hotel. They may ask for ~$3 USD to cover the toll; this is normal and not a scam.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
