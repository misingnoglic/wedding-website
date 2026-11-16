import { Metadata } from 'next'
import Link from 'next/link'
import { MENUS } from './menus'

export const metadata: Metadata = {
  title: 'Menus | Arya & Christa',
  robots: { index: false, follow: false },
}

export default function MenusPage() {

  return (
    <div className="w-full max-w-3xl px-4 py-8 md:py-12 animate-fade-in text-left">
      <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Menus</h1>

      <div className="space-y-4">
        {MENUS.map((menu) => (
          <Link
            key={menu.slug}
            href={`/menus/${menu.slug}`}
            className="flex items-center justify-between border-b border-zinc-200 pb-6 group"
          >
            <span className="text-xl font-sans font-medium text-black group-hover:text-sage transition-colors">
              {menu.title} Menu
            </span>
            <span className="text-zinc-400 group-hover:text-sage transition-colors">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
