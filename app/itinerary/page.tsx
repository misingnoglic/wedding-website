export default function Itinerary() {
    return (
        <div className="w-full max-w-4xl px-4 py-16 md:py-24 animate-fade-in text-center flex flex-col items-center">
            <h1 className="text-5xl md:text-7xl font-script mb-16">Itinerary</h1>

            <div className="w-full max-w-2xl text-left relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-300 before:to-transparent">

                {/* Event 1 */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-12">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-sage shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ml-0 md:ml-auto md:mr-auto"></div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-zinc-50 p-6 rounded-sm border border-zinc-100 transition-transform duration-300 hover:-translate-y-1">
                        <div className="flex flex-col mb-2">
                            <span className="text-sage font-sans tracking-wide uppercase text-sm mb-1">12/11/26</span>
                            <h3 className="text-xl font-sans">Welcome Party</h3>
                        </div>
                        <p className="text-zinc-600 font-karla">
                            Details to be announced.
                        </p>
                    </div>
                </div>

                {/* Event 2 */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-sage shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ml-0 md:ml-auto md:mr-auto"></div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-zinc-50 p-6 rounded-sm border border-zinc-100 transition-transform duration-300 hover:-translate-y-1">
                        <div className="flex flex-col mb-2">
                            <span className="text-sage font-sans tracking-wide uppercase text-sm mb-1">12/12/26</span>
                            <h3 className="text-xl font-sans">Wedding Ceremony & Reception</h3>
                        </div>
                        <p className="text-zinc-600 font-karla">
                            Details to be announced.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
