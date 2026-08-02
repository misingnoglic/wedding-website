import Link from "next/link";

export default function Footer() {
    return (
        <footer className="w-full border-t border-zinc-200 bg-zinc-50 py-8 text-center mt-auto">
            <p className="text-zinc-500 text-sm font-sans tracking-wide">
                &copy; 2026 Arya & Christa. All rights reserved.
            </p>
            <p className="text-zinc-400 text-xs font-karla mt-2 tracking-widest uppercase">
                Cabo San Lucas, Mexico
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] font-karla text-zinc-400 mt-3">
                <Link href="/privacy-policy" className="hover:text-zinc-600 transition-colors">
                    Privacy Policy
                </Link>
                <span className="text-zinc-300 select-none">•</span>
                <Link href="/terms-and-conditions" className="hover:text-zinc-600 transition-colors">
                    Terms & Conditions
                </Link>
            </div>
        </footer>
    );
}
