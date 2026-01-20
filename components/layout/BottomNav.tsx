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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0D0B21]/95 backdrop-blur-xl border-t border-purple-500/20 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl min-w-[60px]
                transition-all duration-300 active:scale-95
                ${isActive 
                  ? 'text-purple-400' 
                  : 'text-zinc-500 hover:text-zinc-300'
                }
              `}
            >
              <div className={`
                relative p-2 rounded-xl transition-all duration-300
                ${isActive ? 'bg-purple-500/20' : ''}
              `}>
                <Icon className={`w-5 h-5 transition-all ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-lg" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-purple-300' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
