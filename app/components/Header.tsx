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
        <header className="w-full bg-white/90 backdrop-blur-sm border-b border-zinc-200 relative">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center py-8">
                    <Link href="/" className="mb-6 hover:opacity-80 transition-opacity">
                        <Image
                            src="/ac-logo.png"
                            alt="Arya & Christa Monogram"
                            width={64}
                            height={64}
                            className=" object-contain"
                        />
                    </Link>
                    <Link href="/" className="text-4xl md:text-5xl font-sans tracking-wide mb-2 hover:text-sage transition-colors duration-300">
                        Arya & Christa
                    </Link>
                    <p className="text-sm md:text-base font-karla tracking-wider uppercase text-zinc-500 text-center">
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
                                : "text-zinc-600 hover:text-black"
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Floating Mobile Navigation Toggle */}
                <div className="md:hidden fixed top-4 right-4 z-[60]">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="bg-white/90 backdrop-blur-md shadow-md p-3 rounded-full border border-zinc-200 text-zinc-600 hover:text-black focus:outline-none flex items-center justify-center transition-transform hover:scale-105"
                        aria-label="Toggle Menu"
                    >
                        <svg
                            className="w-6 h-6"
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
                <div className="md:hidden fixed top-0 left-0 w-full h-screen bg-white/95 backdrop-blur-lg z-50 flex flex-col items-center justify-center">
                    <nav className="flex flex-col space-y-8 text-center">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`text-2xl tracking-widest uppercase block ${pathname === link.href
                                    ? "text-sage font-medium"
                                    : "text-zinc-600 hover:text-black"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );
}
