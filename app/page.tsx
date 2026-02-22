import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-center">
      <section className="w-full max-w-5xl px-4 py-16 md:py-24 flex flex-col items-center text-center">
        <h1 className="text-6xl md:text-8xl font-script mb-8 text-black dark:text-white">
          We're Getting Married!
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400 font-karla tracking-widest uppercase mb-16 leading-relaxed">
          Join us for a celebration of love, tequila, and tacos in beautiful Cabo San Lucas.
        </p>

        <div className="relative w-full max-w-4xl aspect-[4/3] md:aspect-[16/9] mb-16 flex justify-center items-center">
          <Image
            src="/sketch.png"
            alt="The Cape Hotel Sketch"
            fill
            className="object-contain dark:invert"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
        </div>

        <div className="flex flex-col gap-4 text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-sans tracking-wide">The Cape, a Thompson Hotel, by Hyatt</h2>
          <p className="text-zinc-500 uppercase tracking-widest font-karla text-sm">
            December 12, 2026
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          <Link
            href="/travel"
            className="px-8 py-4 bg-black text-white dark:bg-white dark:text-black font-sans tracking-wide uppercase text-sm hover:bg-sage dark:hover:bg-sage hover:text-white transition-colors duration-300"
          >
            Travel & Accommodations
          </Link>
          <Link
            href="/rsvp"
            className="px-8 py-4 border border-black dark:border-white font-sans tracking-wide uppercase text-sm hover:border-sage hover:text-sage transition-colors duration-300"
          >
            RSVP (Coming Soon)
          </Link>
        </div>
      </section>
    </div>
  );
}
