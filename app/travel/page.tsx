import Link from "next/link";

export default function Travel() {
    return (
        <div className="w-full max-w-4xl px-4 py-16 md:py-24 animate-fade-in text-left">
            <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Travel & Accommodations</h1>

            <div className="space-y-16">
                <section>
                    <h2 className="text-3xl font-sans mb-6 pb-2 border-b border-zinc-200">
                        The Hotel
                    </h2>
                    <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-4">
                        Our wedding will be held at <strong>The Cape, a Thompson Hotel, by Hyatt</strong> in beautiful Cabo San Lucas, Mexico.
                    </p>
                    <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-6">
                        We have secured a room block for our guests at a discounted rate. While you are welcome to stay at any hotel in the area, we would love for you to join us at The Cape. Please note that the room block requires a minimum stay of 3 days.
                    </p>
                    <a
                        href="https://www.hyatt.com/events/en-US/group-booking/CSLTH/G-CABO"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-8 py-4 bg-black text-white font-sans tracking-wide uppercase text-sm hover:bg-sage hover:text-white transition-colors duration-300"
                    >
                        Book Room Block
                    </a>
                </section>

                <section>
                    <h2 className="text-3xl font-sans mb-6 pb-2 border-b border-zinc-200">
                        Getting There
                    </h2>
                    <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-8">
                        You will want to fly into <strong>Los Cabos International Airport (SJD)</strong>.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-100 flex flex-col h-full">
                            <h3 className="text-xl font-sans mb-3 flex-shrink-0">Taxis</h3>
                            <p className="text-zinc-600 font-karla text-base mb-2 flex-grow">
                                After you go through immigration, skip the "information" booths and go straight through the doors outside to the yellow booth that says "authorized taxi".
                            </p>
                            <p className="text-red-600 font-karla text-sm mt-4 shrink-0">
                                <strong>Important:</strong> Do not accept rides from people walking up to you inside the airport terminal.
                            </p>
                        </div>

                        <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-100 flex flex-col h-full">
                            <h3 className="text-xl font-sans mb-3 flex items-center gap-2 flex-shrink-0">
                                Uber & <a href="https://indrive.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-sage transition-colors">InDrive</a>
                            </h3>
                            <div className="flex-grow">
                                <p className="text-zinc-600 font-karla text-base mb-4">
                                    Rideshare apps cannot pick you up at the terminal doors. You must walk to the designated pickup area.
                                </p>

                                <h4 className="font-karla font-semibold mb-2">How to get there:</h4>
                                <ol className="list-decimal list-inside space-y-2 text-zinc-600 font-karla text-sm mb-6 ml-2">
                                    <li><strong>Go upstairs</strong> to the departures level.</li>
                                    <li><strong>Turn left</strong> out of the doors.</li>
                                    <li><strong>Keep walking</strong> past the first entrance towards the street.</li>
                                </ol>
                            </div>

                            <a
                                href="https://maps.app.goo.gl/wGHEWWyDTn36tkVn7"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-black text-white py-3 px-4 rounded-sm text-center font-sans tracking-wide uppercase text-xs hover:bg-sage hover:text-white transition-colors duration-300 mt-auto shrink-0"
                            >
                                View Google Maps Pin
                            </a>
                        </div>

                        <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-100 flex flex-col h-full">
                            <h3 className="text-xl font-sans mb-3 flex-shrink-0">Private Transport Service</h3>
                            <p className="text-zinc-600 font-karla text-base italic flex-grow">
                                Information coming soon.
                            </p>
                        </div>

                        <div className="bg-sage/10 p-6 rounded-sm border border-sage/30 flex flex-col h-full">
                            <h3 className="text-xl font-sans mb-3 text-sage flex-shrink-0">Pro Tip: The Toll Road</h3>
                            <p className="text-zinc-700 font-karla text-base flex-grow">
                                For taxis and rideshare, make sure they take the toll road (in Spanish: "carretera de peaje"). Otherwise, it can take significantly longer to reach the hotel. They may ask for ~$3 USD to cover the toll; this is normal and not a scam.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
