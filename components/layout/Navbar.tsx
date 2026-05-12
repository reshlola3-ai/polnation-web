'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
const ChevronDown = dynamic(() => import('lucide-react').then((m) => m.ChevronDown), { ssr: false })
const Crosshair = dynamic(() => import('lucide-react').then((m) => m.Crosshair), { ssr: false })

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Close the user dropdown when clicking outside.
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Initial for the user-menu avatar (first letter of email, fallback ·)
  const userInitial = user?.email?.[0]?.toUpperCase() || '·'

  const navLinks = [
    { href: '/dashboard', label: t('dashboard'), icon: Wallet },
    { href: '/tasks', label: t('tasks'), icon: ClipboardList },
    { href: '/earnings', label: t('earnings'), icon: TrendingUp },
    { href: '/team', label: t('team'), icon: Users },
    { href: '/alpha', label: t('alpha'), icon: Crosshair },
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
                  className="p-2 text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] rounded-xl transition-all"
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
  // Layout: 3 clipped slabs floating over the page background
  // [ Logo + links (white-ish panel, right-side notch cut) ] ... [ REWARDS HUB (gray, left bevel) ][ JOIN POLNATION (purple, left bevel + right arrow) ]
  const slabH = 'h-14'
  // Trapezoid for the left logo+links slab: cut a wedge out of the bottom-right corner
  const leftSlabClip = { clipPath: 'polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)' }
  // Right-side gray slab: bevel on the left edge
  const grayClip = { clipPath: 'polygon(20px 0, 100% 0, 100% 100%, 0 100%)' }
  // Right-side purple CTA: bevel on the left + arrow pointing right
  const purpleClip = { clipPath: 'polygon(20px 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 20px 100%, 0 50%)' }

  return (
    <nav className="sticky top-0 z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2">
        <div className={`relative flex items-stretch justify-between ${slabH} gap-3`}>
          {/* Left slab: logo + links, with right-side notch */}
          <div
            style={leftSlabClip}
            className="flex items-stretch bg-[var(--kraken-panel)] border border-[var(--kraken-border)] pl-4 pr-10"
          >
            <Link href="/" className="flex items-center gap-3 group pr-4">
              <Image
                src="/logo.svg"
                alt="Polnation"
                width={32}
                height={32}
                className="transition-all duration-300"
              />
              <span className="text-lg font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-[var(--kraken-green)]">
                Polnation
              </span>
            </Link>

            {user && (
              <div className="hidden md:flex items-center gap-1 pl-2">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const isActive = pathname === link.href
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-all duration-200
                        ${isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06]'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--kraken-purple)]" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right side: language + clipped CTAs */}
          <div className="flex items-stretch gap-0">
            {/* Language switcher floats next to the slabs (no clip, plain pill) */}
            <div className="flex items-center pr-2">
              <LanguageSwitcher currentLocale={locale} />
            </div>

            {user ? (
              <>
                {/* Gray slab: rewards hub / user menu trigger */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    style={grayClip}
                    className="h-full flex items-center gap-2 pl-7 pr-5 bg-[#1a1822] text-white text-[11px] font-semibold tracking-widest uppercase hover:bg-[#2a2238] transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-[var(--kraken-purple)] text-white flex items-center justify-center text-[10px] font-bold">
                      {userInitial}
                    </span>
                    Rewards Hub
                    <ChevronDown className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#13121a] border border-[var(--kraken-border)] shadow-xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-[var(--kraken-border)]">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--kraken-muted)]">Signed in as</p>
                        <p className="text-xs text-white truncate mt-0.5">{user.email}</p>
                      </div>

                      <Link
                        href="/academy"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        Academy
                      </Link>
                      <a
                        href="/polnation-earning-guide.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <GraduationCap className="w-4 h-4" />
                        Earning Guide
                      </a>

                      <div className="border-t border-[var(--kraken-border)]" />

                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false)
                          handleSignOut()
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('signOut')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Purple slab: Join Polnation arrow CTA */}
                <Link
                  href="/dashboard"
                  style={purpleClip}
                  className="h-full flex items-center pl-7 pr-9 bg-[var(--kraken-purple)] hover:bg-[var(--kraken-purple-soft)] text-white text-[11px] font-bold tracking-widest uppercase transition-colors -ml-2"
                >
                  Join Polnation
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={grayClip}
                  className="h-full flex items-center pl-7 pr-5 bg-[#1a1822] text-white text-[11px] font-semibold tracking-widest uppercase hover:bg-[#2a2238] transition-colors"
                >
                  {t('signIn')}
                </Link>
                <Link
                  href="/register"
                  style={purpleClip}
                  className="h-full flex items-center pl-7 pr-9 bg-[var(--kraken-purple)] hover:bg-[var(--kraken-purple-soft)] text-white text-[11px] font-bold tracking-widest uppercase transition-colors -ml-2"
                >
                  Join Polnation
                </Link>
              </>
            )}

            {/* Mobile menu button - only for non-dashboard pages */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 ml-2 rounded-xl text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] transition-all"
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
                        ? 'bg-white/[0.08] text-white border-[var(--kraken-purple)]'
                        : 'text-[var(--kraken-muted)] border-transparent hover:text-white hover:bg-white/[0.06]'
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
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[var(--kraken-muted)] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
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
