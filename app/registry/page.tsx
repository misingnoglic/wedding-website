export default function Registry() {
    return (
        <div className="w-full max-w-3xl px-4 py-8 md:py-12 animate-fade-in text-center mx-auto">
            <h1 className="text-5xl md:text-7xl font-script mb-12">Registry</h1>

            <p className="text-zinc-600 font-karla leading-relaxed text-lg mb-12 max-w-2xl mx-auto">
                Your presence at our wedding is the greatest gift we could ask for!
                However, for friends and family who have been asking for gift ideas,
                we’ve created online registries below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
                <a
                    href="https://www.amazon.com/wedding/guest-view/2GVWP7WALC2T0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center justify-center p-8 bg-zinc-50 border border-zinc-200 rounded-sm hover:border-sage/50 hover:bg-sage/5 hover:shadow-sm transition-all duration-300"
                >
                    <h3 className="text-xl font-sans tracking-wide uppercase text-black mb-2">Amazon</h3>
                    <span className="text-sage text-sm font-karla group-hover:underline underline-offset-4">View Registry &rarr;</span>
                </a>

                <a
                    href="https://www.crateandbarrel.com/gift-registry/christa-caggiano-and-arya-boudaie/r7637168"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center justify-center p-8 bg-zinc-50 border border-zinc-200 rounded-sm hover:border-sage/50 hover:bg-sage/5 hover:shadow-sm transition-all duration-300"
                >
                    <h3 className="text-xl font-sans tracking-wide uppercase text-black mb-2">Crate & Barrel</h3>
                    <span className="text-sage text-sm font-karla group-hover:underline underline-offset-4">View Registry &rarr;</span>
                </a>
            </div>
        </div>
    );
}
