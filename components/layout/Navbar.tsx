'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'
import { type Locale } from '@/i18n/config'

const Menu = dynamic(() => import('lucide-react').then((m) => m.Menu), { ssr: false })
const X = dynamic(() => import('lucide-react').then((m) => m.X), { ssr: false })
const UserIcon = dynamic(() => import('lucide-react').then((m) => m.User), { ssr: false })
const Users = dynamic(() => import('lucide-react').then((m) => m.Users), { ssr: false })
const LogOut = dynamic(() => import('lucide-react').then((m) => m.LogOut), { ssr: false })
const Wallet = dynamic(() => import('lucide-react').then((m) => m.Wallet), { ssr: false })
const TrendingUp = dynamic(() => import('lucide-react').then((m) => m.TrendingUp), { ssr: false })
const ClipboardList = dynamic(() => import('lucide-react').then((m) => m.ClipboardList), { ssr: false })
const BookOpen = dynamic(() => import('lucide-react').then((m) => m.BookOpen), { ssr: false })
const GraduationCap = dynamic(() => import('lucide-react').then((m) => m.GraduationCap), { ssr: false })

interface NavbarProps {
  user: User | null
  locale: Locale
  isMobile?: boolean
}

export function Navbar({ user, locale, isMobile = false }: NavbarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/dashboard', label: t('dashboard'), icon: Wallet },
    { href: '/tasks', label: t('tasks'), icon: ClipboardList },
    { href: '/earnings', label: t('earnings'), icon: TrendingUp },
    { href: '/team', label: t('team'), icon: Users },
    { href: '/profile', label: t('profile'), icon: UserIcon },
  ]

  // Mobile header - simplified version
  if (isMobile) {
    return (
      <nav className="bg-[var(--kraken-panel)] border-b border-[var(--kraken-border)] sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="Polnation"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-semibold tracking-tight text-white">Polnation</span>
            </Link>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher currentLocale={locale} />
              {user && (
                <button
                  onClick={handleSignOut}
                  className="p-2 text-[var(--kraken-muted)] hover:text-white hover:bg-[var(--kraken-panel-2)] rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  // Desktop navigation - full version
  return (
    <nav className="bg-[var(--kraken-panel)] border-b border-[var(--kraken-border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/logo.svg"
                alt="Polnation"
                width={36}
                height={36}
                className="transition-all duration-300"
              />
              <span className="text-xl font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-[var(--kraken-green)]">Polnation</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 border
                      ${isActive
                        ? 'bg-[var(--kraken-panel-2)] text-white border-[var(--kraken-purple)]'
                        : 'text-[var(--kraken-muted)] border-transparent hover:text-white hover:bg-[var(--kraken-panel-2)] hover:border-[var(--kraken-border)]'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <LanguageSwitcher currentLocale={locale} />

            {/* Academy Link - visible to all */}
            <Link
              href="/academy"
              className={`
                hidden sm:flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-200 border
                ${pathname === '/academy'
                  ? 'bg-[var(--kraken-panel-2)] text-white border-[var(--kraken-purple)]'
                  : 'text-[var(--kraken-muted)] border-transparent hover:text-white hover:bg-[var(--kraken-panel-2)] hover:border-[var(--kraken-border)]'
                }
              `}
            >
              <BookOpen className="w-4 h-4" />
              Academy
            </Link>

            {/* Earning Guide - static HTML in public/ */}
            <a
              href="/polnation-earning-guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold text-[var(--kraken-muted)] hover:text-white hover:bg-[var(--kraken-panel-2)] border border-transparent hover:border-[var(--kraken-border)] transition-all duration-200"
            >
              <GraduationCap className="w-4 h-4" />
              Earning Guide
            </a>

            {user ? (
              <>
                <span className="hidden lg:block text-xs text-[var(--kraken-muted)] truncate max-w-[120px]">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--kraken-muted)] hover:text-white hover:bg-[var(--kraken-panel-2)] rounded-full transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('signOut')}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-2 text-xs font-semibold text-[var(--kraken-muted)] hover:text-white transition-all"
                >
                  {t('signIn')}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center rounded-full bg-[var(--kraken-purple)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--kraken-purple-soft)]"
                >
                  {t('getStarted')}
                </Link>
              </div>
            )}

            {/* Mobile menu button - only for non-dashboard pages */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-[var(--kraken-muted)] hover:text-white hover:bg-[var(--kraken-panel-2)] transition-all"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {user && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--kraken-border)]">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 border
                      ${isActive
                        ? 'bg-[var(--kraken-panel-2)] text-white border-[var(--kraken-purple)]'
                        : 'text-[var(--kraken-muted)] border-transparent hover:text-white hover:bg-[var(--kraken-panel-2)]'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                )
              })}

              <a
                href="/polnation-earning-guide.html"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[var(--kraken-muted)] hover:text-white hover:bg-[var(--kraken-panel-2)] transition-all duration-200"
              >
                <GraduationCap className="w-5 h-5" />
                Earning Guide
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
