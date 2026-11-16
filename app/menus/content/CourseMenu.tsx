import MenuSection from './MenuSection'

export type Diet = 'GF' | 'DF' | 'VG'
export type Dish = { name: string; diet?: Diet[] }
export type Course = { title: string; dishes: Dish[] }

const DIET_LABELS: Record<Diet, string> = { GF: 'gluten-free', DF: 'dairy-free', VG: 'vegan' }

function DietTags({ diet }: { diet: Diet[] }) {
  return (
    <span className="ml-1.5 whitespace-nowrap text-[10px] font-sans tracking-wider text-sage">
      {diet.map((d) => (
        <abbr key={d} title={DIET_LABELS[d]} className="ml-1 no-underline first:ml-0">
          {d}
        </abbr>
      ))}
    </span>
  )
}

// A food menu: one section per course, one line per dish, with a key for the diet tags
export default function CourseMenu({ courses }: { courses: Course[] }) {
  return (
    <div className="mx-auto max-w-md space-y-8">
      {courses.map((course) => (
        <MenuSection key={course.title} title={course.title}>
          <ul className="space-y-2.5">
            {course.dishes.map((dish) => (
              <li key={dish.name} className="text-center text-[15px] font-karla leading-snug text-zinc-700">
                {dish.name}
                {dish.diet && <DietTags diet={dish.diet} />}
              </li>
            ))}
          </ul>
        </MenuSection>
      ))}

      <p className="text-center text-[11px] font-karla tracking-wide text-zinc-400">
        {(Object.keys(DIET_LABELS) as Diet[]).map((d, i) => (
          <span key={d}>
            {i > 0 && ' · '}
            <span className="font-sans text-sage">{d}</span> {DIET_LABELS[d]}
          </span>
        ))}
      </p>
    </div>
  )
}
