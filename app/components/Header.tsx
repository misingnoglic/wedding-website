"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
    { href: "/", label: "Home" },
    { href: "/travel", label: "Travel" },
    { href: "/itinerary", label: "Itinerary" },
    { href: "/faq", label: "FAQ" },
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
    { href: "/rsvp", label: "RSVP" },
];

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 dark:bg-black/90">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center py-8">
                    <Link href="/" className="mb-6 hover:opacity-80 transition-opacity">
                        <Image
                            src="/ac-logo.png"
                            alt="Arya & Christa Monogram"
                            width={64}
                            height={64}
                            className="dark:invert object-contain"
                        />
                    </Link>
                    <Link href="/" className="text-4xl md:text-5xl font-sans tracking-wide mb-2 hover:text-sage transition-colors duration-300">
                        Arya & Christa
                    </Link>
                    <p className="text-sm md:text-base font-karla tracking-wider uppercase text-zinc-500 dark:text-zinc-400 text-center">
                        December 12, 2026 • Cabo San Lucas, Mexico
                    </p>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex justify-center space-x-8 pb-6">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`text-sm tracking-widest uppercase transition-colors duration-200 ${pathname === link.href
                                ? "text-sage border-b-2 border-sage pb-1"
                                : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Mobile Navigation Toggle */}
                <div className="md:hidden flex justify-center pb-6">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white focus:outline-none flex items-center gap-2 text-sm tracking-widest uppercase"
                    >
                        {isOpen ? "Close Menu" : "Menu"}
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {isOpen ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isOpen && (
                <nav className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 pt-2 pb-4 shadow-lg absolute w-full left-0">
                    <div className="flex flex-col space-y-4 text-center mt-4">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`text-base tracking-widest uppercase block py-2 ${pathname === link.href
                                    ? "text-sage font-medium"
                                    : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </nav>
            )}
        </header>
    );
}
