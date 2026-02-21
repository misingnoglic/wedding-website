import Link from "next/link";

export default function RSVP() {
    return (
        <div className="w-full flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
            <h1 className="text-6xl md:text-8xl font-script mb-8">RSVP</h1>
            <p className="max-w-md text-xl text-zinc-600 dark:text-zinc-400 font-karla tracking-widest uppercase mb-12">
                Formal invitations and RSVP options will be available closer to the date.
            </p>

            <Link
                href="/"
                className="text-sm font-sans tracking-widest uppercase text-sage hover:text-black dark:hover:text-white transition-colors duration-300 pb-1 border-b border-transparent hover:border-black dark:hover:border-white"
            >
                Return Home
            </Link>
        </div>
    );
}
