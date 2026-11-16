import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMenu, MENUS } from '../menus'
import DrinksMenu from '../content/DrinksMenu'

// Menus without an entry here render as a blank page
const CONTENT: Record<string, () => React.ReactNode> = {
  drinks: DrinksMenu,
}

export const metadata: Metadata = {
  title: 'Menu | Arya & Christa',
  robots: { index: false, follow: false },
}

export const generateStaticParams = () => MENUS.map((m) => ({ slug: m.slug }))

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const menu = getMenu(slug)
  if (!menu) notFound()
  const Content = CONTENT[slug]

  return (
    <div className="w-full max-w-3xl px-4 py-8 md:py-12 animate-fade-in text-left">
      <h1 className="text-5xl md:text-7xl font-script mb-8 md:mb-12 text-center">{menu.title} Menu</h1>
      {Content && <Content />}
    </div>
  )
}
