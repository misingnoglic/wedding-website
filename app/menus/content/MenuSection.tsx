import { ReactNode } from 'react'

// Section heading shared by every menu: small sage capitals between two hairlines
export default function MenuSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
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
