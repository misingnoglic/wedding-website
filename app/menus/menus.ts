export const MENUS = [
  { slug: 'hors-doeuvres', title: "Hors d'Oeuvres" },
  { slug: 'sushi', title: 'Sushi' },
  { slug: 'dinner', title: 'Dinner' },
  { slug: 'espresso-martini', title: 'Espresso Martini Station' },
  { slug: 'drinks', title: 'Drinks' },
] as const

export const getMenu = (slug: string) => MENUS.find((m) => m.slug === slug)
