import Link from "next/link";
import HoverColorImage from "../components/HoverColorImage";

export default function Travel() {
    return (
        <div className="w-full max-w-4xl px-4 py-16 md:py-24 animate-fade-in text-left">
            <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Travel & Accommodations</h1>

            <div className="space-y-16">
                <section>
                    <div className="mb-12">
                        <h2 className="text-4xl font-sans tracking-tight mb-6 text-center">
                            The Hotel
                        </h2>
                        <div className="w-24 h-px bg-zinc-300 mx-auto"></div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-stretch">
                        <div className="w-full md:w-1/2 flex flex-col items-start justify-between py-1">
                            <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-4">
                                Our wedding will be held at <strong>The Cape, a Thompson Hotel, by Hyatt</strong> in beautiful Cabo San Lucas, Mexico.
                            </p>
                            <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-4">
                                While you are welcome to stay at any hotel in the area, we would love for you to join us at The Cape.
                            </p>
                            <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-4">
                                We have secured a room block for our guests at a discounted rate. Please note that the room block requires a minimum stay of 3 days. In accordance with our planned events, we recommend you check in on 12/10 and check out on 12/13. Booking Note: A one-night deposit is required to hold your room within our block.
                            </p>
                            <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-4">
                                This Michelin Key oasis offers breathtaking views of the Sea of Cortez and El Arco from every room. Between the festivities, we hope you’ll enjoy the property’s amenities which include the lively infinity pool and the secluded saltwater pool. To kick off the weekend, a custom hand-etched bottle of Realeza Mexicana tequila will be waiting in your room upon arrival.
                            </p>
                            <a
                                href="https://www.hyatt.com/events/en-US/group-booking/CSLTH/G-CABO"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-8 py-4 bg-black text-white font-sans tracking-wide uppercase text-sm hover:bg-sage hover:text-white transition-colors duration-300 mt-4"
                            >
                                Book Room Block
                            </a>
                        </div>
                        <div className="w-full md:w-1/2">
                            <HoverColorImage
                                src="/cape-landscape.jpg"
                                alt="The Cape Hotel"
                                containerClassName="w-full aspect-[2/3] rounded-sm"
                                sizes="(max-width: 768px) 100vw, 896px"
                            />
                        </div>
                    </div>
                </section>

                <section>
                    <div className="mb-12">
                        <h2 className="text-4xl font-sans tracking-tight mb-6 text-center">
                            Getting There
                        </h2>
                        <div className="w-24 h-px bg-zinc-300 mx-auto"></div>
                    </div>
                    <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-8">
                        You will want to fly into <strong>Los Cabos International Airport (SJD)</strong>. Once you get to the airport, there are many ways of getting to your hotel.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-50 p-6 rounded-sm border-2 border-sage/40 flex flex-col h-full shadow-sm">
                            <h3 className="text-xl font-sans mb-3 flex-shrink-0 flex items-center justify-between">
                                Private Transport
                                <span className="text-xs font-semibold uppercase tracking-wider text-sage bg-sage/10 px-2 py-1 rounded-sm">Recommended</span>
                            </h3>
                            <div className="flex-grow">
                                <p className="text-zinc-600 font-karla text-base mb-4">
                                    We are partnering with <strong>Eliker Transfer</strong> for advance arrangements with guaranteed pricing.
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-zinc-600 font-karla text-sm mb-4 ml-1">
                                    <li>SUV (up to 5 passengers) - $155.00 (Round trip)</li>
                                    <li>Van (up to 10 passengers) - $185.00 (Round trip)</li>
                                    <li>Car & booster seats free of charge</li>
                                </ul>
                                <p className="text-sage font-karla text-sm font-semibold mb-4">
                                    When booking, please add a note that you are coming for Arya & Christa's wedding so our planner can coordinate.
                                </p>
                            </div>
                            <a
                                href="https://www.elikertransfer.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-black text-white py-3 px-4 rounded-sm text-center font-sans tracking-wide uppercase text-xs hover:bg-sage hover:text-white transition-colors duration-300 mt-auto shrink-0"
                            >
                                Book with Eliker
                            </a>
                        </div>

                        <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-100 flex flex-col h-full">
                            <h3 className="text-xl font-sans mb-3 flex-shrink-0">Taxis</h3>
                            <p className="text-zinc-600 font-karla text-base mb-2 flex-grow">
                                After clearing immigration, bypass the "information" booths and head straight outside to the yellow "authorized taxi" stand. Fares are pre-negotiated based on your hotel's zone and group size, and you will pay by card before getting into the taxi.
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
                                <div className="text-zinc-600 font-karla text-sm space-y-2 mb-4">
                                    <p><strong>Uber:</strong> The same app used in America, and you pay by card.</p>
                                    <p><strong>InDrive:</strong> Another app that allows you to negotiate your own rate. It is often cheaper, but you have to pay in cash.</p>
                                </div>
                                <p className="text-zinc-600 font-karla text-base mb-4 border-t border-zinc-200 pt-4">
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
