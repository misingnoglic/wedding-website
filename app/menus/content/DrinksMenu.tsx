import { ReactNode } from 'react'

type Drink = { name: string; description: string; note?: string }

const SIGNATURES: Drink[] = [
  { name: 'Mangonada', description: "A grown-up take on Mexico's favorite mango treat: vodka, mango and elderflower" },
  {
    name: 'Amorcito',
    description: 'Our "little love": Mexican rum and tropical fruits',
  },
]

const SPICE_AND_RIM = 'ask for it spicy, or with a salt or Tajín rim'

const MEXICAN: Drink[] = [
  {
    name: 'Margarita',
    description: 'Tequila, orange liqueur, lime',
    note: SPICE_AND_RIM,
  },
  {
    name: 'Mezcalita',
    description: 'A margarita made with mezcal, for a smoky twist',
    note: SPICE_AND_RIM,
  },
  {
    name: 'Paloma',
    description: "Mexico's everyday tequila drink: tequila, grapefruit soda, lime",
  },
  { name: 'Ranch Water', description: 'Tequila, lime, sparkling water' },
  {
    name: 'Batanga',
    description: 'Tequila and Coca-Cola with lime and a salted rim',
  },
]

const CLASSICS: Drink[] = [
  { name: 'Aperol Spritz', description: 'Aperol, Prosecco, soda' },
  { name: 'Hugo Spritz', description: 'St-Germain, Prosecco, soda, mint' },
  { name: 'Cosmo', description: 'Vodka, orange liqueur, cranberry, lime' },
  { name: 'Midori Sour', description: 'Midori, lime, Sprite' },
  { name: 'Moscow Mule', description: 'Vodka, ginger beer, lime', note: 'or swap the vodka for whiskey or mezcal' },
]

const BEERS = ['Pacifico', 'Corona', 'Corona Light', 'Modelo', 'Dos Equis (XX)']

const BEER_STYLES: Drink[] = [
  { name: 'Straight', description: 'Ice cold, with a lime' },
  {
    name: 'Chelada',
    description: 'Your beer over ice with fresh lime juice and a salted rim',
  },
  {
    name: 'Michelada',
    description: 'A chelada plus tomato juice, hot sauce and a Tajín rim',
  },
]

const WINES: Drink[] = [
  { name: 'Naonis Prosecco', description: 'Sparkling · Italy' },
  { name: 'La Belle Angèle Sauvignon Blanc', description: 'White · France' },
  { name: 'La Belle Angèle Cabernet Sauvignon', description: 'Red · France' },
]

type Spirit = {
  category: string
  note?: string
  bottles: { name: string; detail?: string }[]
  // Bottles worth their own write-up: listed one per line instead of joined
  featured?: { name: string; styles?: string; about: string }[]
}

const SPIRITS: Spirit[] = [
  {
    category: 'Tequila',
    note: 'Made only with blue agave from Jalisco.',
    bottles: [],
    featured: [
      {
        name: 'Tromba',
        styles: 'Blanco (unaged) · Reposado (lightly aged) · Añejo (aged)',
        about:
          'From Marco Cedano, the original master distiller at Don Julio. Seven-year-old highland agave, baked in brick ovens and distilled in copper pot stills.',
      },
      {
        name: 'Realeza Mexicana',
        styles: 'Blanco (unaged) · Reposado (lightly aged)',
        about:
          "100% blue agave from Jalisco's valley region, distilled twice. The reposado is roasted in traditional brick ovens: sip it neat for vanilla and a light peppery finish.",
      },
    ],
  },
  {
    category: 'Mezcal',
    note: "Tequila's smoky cousin: the agave is roasted in underground pits before it's distilled.",
    bottles: [],
    featured: [
      {
        name: 'Gracias a Dios Espadín',
        about:
          'Made in Santiago Matatlán, Oaxaca, by fourth-generation mezcalero Oscar Hernández. Eight-year-old espadín agave, distilled twice in copper. Lightly smoky.',
      },
      {
        name: 'Bruxo No. 2',
        about:
          'A vegetarian pechuga: a celebration mezcal of espadín and barril agave, finished with roasted agave hearts for extra richness. Gentle smoke, roasted pear and almond.',
      },
    ],
  },
  {
    category: 'Gin',
    bottles: [],
    featured: [
      {
        name: 'Gracias a Dios Agave Gin',
        styles: 'Oaxaca Recipe',
        about:
          'Made from the same agave spirit as their mezcal, with juniper and Oaxacan botanicals like avocado leaf, yerba santa, cacao and tangerine.',
      },
    ],
  },
  {
    category: 'Rum',
    bottles: [],
    featured: [
      {
        name: 'Uruapan Charanda Blanco',
        about:
          'A Pacheco family tradition since 1907. Half fresh-pressed cane juice, half molasses, from cane grown over 4,000 feet up. The heart of our Amorcito.',
      },
    ],
  },
  { category: 'Vodka', bottles: [{ name: 'Absolut' }] },
  {
    category: 'Whiskey',
    bottles: [{ name: "Jack Daniel's" }, { name: "Maker's Mark" }],
  },
  {
    category: 'Liqueurs',
    bottles: [{ name: 'Aperol' }, { name: 'Baileys' }, { name: 'Midori' }],
  },
]

const SOFT_DRINKS = ['Coca-Cola', 'Diet Coke', 'Sprite', 'Fresca', 'Ginger Beer', 'Red Bull', 'Sparkling Water', 'Still Water']
const JUICES = ['Orange', 'Grapefruit', 'Cranberry', 'Pineapple']

const SECTIONS = [
  { id: 'signature', label: 'Signature' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'classics', label: 'Classics' },
  { id: 'beer', label: 'Beer' },
  { id: 'wine', label: 'Wine' },
  { id: 'spirits', label: 'Spirits' },
  { id: 'soft-drinks', label: 'Soft Drinks' },
]

function JumpLinks() {
  return (
    <nav className="sticky top-0 z-10 -mx-4 mb-8 border-y border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
      {/* On phones the row scrolls sideways: the edges fade so cut-off links read as "more this way", and the
          right padding lets the last link scroll clear of the floating site-menu button */}
      <div className="flex gap-5 overflow-x-auto no-scrollbar px-4 py-3 pr-20 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%_-_56px),transparent)] md:justify-center md:gap-6 md:pr-4 md:[mask-image:none]">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 text-[11px] font-sans uppercase tracking-[0.15em] text-zinc-500 transition-colors hover:text-sage md:tracking-[0.2em]"
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <h2 className="flex items-center gap-3 text-[11px] font-sans font-semibold uppercase tracking-[0.3em] text-sage">
        <span className="h-px flex-1 bg-zinc-300" />
        {title}
        <span className="h-px flex-1 bg-zinc-300" />
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DrinkList({ drinks, large }: { drinks: Drink[]; large?: boolean }) {
  return (
    <ul className="space-y-3">
      {drinks.map((d) => (
        <li key={d.name} className="text-center">
          <p className={`${large ? 'text-lg' : 'text-[15px]'} font-sans uppercase tracking-[0.15em] text-black`}>{d.name}</p>
          <p className="text-sm font-karla leading-snug text-zinc-600">{d.description}</p>
          {d.note && <p className="text-[13px] font-karla italic text-zinc-500">{d.note}</p>}
        </li>
      ))}
    </ul>
  )
}

function DotList({ label, items }: { label?: string; items: string[] }) {
  return (
    <p className="text-center text-sm font-karla leading-relaxed text-zinc-700">
      {label && <span className="mr-1.5 text-[11px] uppercase tracking-widest text-zinc-400">{label}</span>}
      {items.join(' · ')}
    </p>
  )
}

export default function DrinksMenu() {
  return (
    <div>
      <JumpLinks />
      <div className="mx-auto max-w-md space-y-8">
        <Section id="signature" title="Signature Cocktails">
          <DrinkList drinks={SIGNATURES} large />
        </Section>

        <Section id="mexican" title="Mexican Favorites">
          <DrinkList drinks={MEXICAN} />
        </Section>

        <Section id="classics" title="Classics">
          <DrinkList drinks={CLASSICS} />
          <p className="mt-3 text-center text-[13px] font-karla italic text-zinc-500">and all your favorite mixed drinks, from a gin &amp; tonic to a rum &amp; Coke</p>
        </Section>

        <Section id="beer" title="Cerveza">
          <DotList items={BEERS} />
          <div className="mt-3">
            <DrinkList drinks={BEER_STYLES} />
          </div>
        </Section>

        <Section id="wine" title="Wine">
          <DrinkList drinks={WINES} />
        </Section>

        <Section id="spirits" title="Spirits">
          <div className="space-y-3">
            {SPIRITS.map((s) => (
              <div key={s.category} className="text-center">
                <p className="text-[15px] font-sans uppercase tracking-[0.15em] text-black">{s.category}</p>
                {s.note && <p className="text-[13px] font-karla italic leading-snug text-zinc-500">{s.note}</p>}
                {s.featured?.map((f) => (
                  <div key={f.name} className="mt-2">
                    <p className="text-sm font-sans text-black">{f.name}</p>
                    {f.styles && <p className="text-[13px] font-karla text-zinc-700">{f.styles}</p>}
                    <p className="text-[13px] font-karla italic leading-snug text-zinc-500">{f.about}</p>
                  </div>
                ))}
                {s.bottles.length > 0 && (
                  <p className="text-sm font-karla text-zinc-700">
                    {s.bottles.map((b) => (b.detail ? `${b.name} (${b.detail.replaceAll(' · ', ', ')})` : b.name)).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section id="soft-drinks" title="Juices & Soft Drinks">
          <div className="space-y-1">
            <DotList label="Soft drinks" items={SOFT_DRINKS} />
            <DotList label="Juices" items={JUICES} />
          </div>
        </Section>
      </div>
    </div>
  )
}
