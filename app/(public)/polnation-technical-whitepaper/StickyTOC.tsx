'use client'

import { useEffect, useMemo, useState } from 'react'

export function StickyTOC({
  items,
  title,
}: {
  items: Array<{ id: string; label: string }>
  title: string
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')
  const [mobileOpen, setMobileOpen] = useState(false)

  const idsKey = useMemo(() => items.map(i => i.id).join('|'), [items])

  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean)
    const elements = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const obs = new IntersectionObserver(
      entries => {
        const intersecting = entries.filter(e => e.isIntersecting)
        if (intersecting.length === 0) return
        intersecting.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const id = intersecting[0]?.target.id
        if (id) setActiveId(id)
      },
      {
        rootMargin: '-96px 0px -52% 0px',
        threshold: [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
      }
    )
    elements.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [idsKey])

  function linkClass(id: string) {
    const active = activeId === id
    return [
      'block border-l-2 py-1.5 pl-3 text-left text-[11px] transition-colors duration-200',
      'tracking-[0.06em]',
      active
        ? 'border-[#670de5] font-medium text-zinc-900'
        : 'border-transparent font-normal text-zinc-500 hover:text-zinc-800',
    ].join(' ')
  }

  return (
    <>
      <div className="stickyTocMobile mb-6 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          className="flex w-full items-center justify-between border border-zinc-300 bg-white px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-700 transition hover:border-zinc-400"
          aria-expanded={mobileOpen}
        >
          {title}
          <span className="text-zinc-400" aria-hidden>
            {mobileOpen ? '−' : '+'}
          </span>
        </button>
        {mobileOpen && (
          <nav
            className="mt-2 max-h-[min(55vh,420px)] overflow-y-auto border border-zinc-200 bg-zinc-50/80 px-2 py-3"
            aria-label={title}
          >
            {items.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={linkClass(item.id)}
                style={{ fontFamily: 'var(--poly-font-mono)' }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      <aside className="stickyTocAside hidden lg:block print:hidden">
        <nav className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto border-r border-zinc-200 pr-5" aria-label={title}>
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500">{title}</div>
          <div className="flex flex-col gap-0.5">
            {items.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={linkClass(item.id)}
                style={{ fontFamily: 'var(--poly-font-mono)' }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </aside>
    </>
  )
}
