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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] relative
                transition-colors active:scale-95
                ${isActive ? 'text-[#16A34A]' : 'text-gray-400'}
              `}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#16A34A] rounded-full" />
              )}
              <Icon className={`w-6 h-6 ${isActive ? 'text-[#16A34A]' : 'text-gray-400'}`} />
              <span className={`text-xs ${isActive ? 'text-[#16A34A] font-medium' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
