'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, TrendingUp, Users, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: Home },
    { href: '/tasks', label: t('tasks'), icon: ClipboardList },
    { href: '/earnings', label: t('earnings'), icon: TrendingUp },
    { href: '/team', label: t('team'), icon: Users },
    { href: '/profile', label: t('profile'), icon: User },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--kraken-panel)] border-t border-[var(--kraken-border)] pb-safe">
      <div className="flex justify-around items-center h-16 px-1.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 px-2 py-1.5 min-w-[56px] relative
                transition-all active:scale-95
                ${isActive ? 'text-white bg-white/[0.04]' : 'text-[var(--kraken-muted)]'}
              `}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--kraken-purple)]" />
              )}
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[var(--kraken-muted)]'}`} />
              <span
                className={`text-[10px] uppercase leading-none ${isActive ? 'text-white' : 'text-[var(--kraken-muted)]'}`}
                style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.12em' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
