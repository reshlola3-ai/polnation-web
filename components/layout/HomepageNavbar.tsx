'use client'

import Link from 'next/link'
import Image from 'next/image'
import { User } from '@supabase/supabase-js'

interface HomepageNavbarProps {
  user: User | null
  signInLabel: string
  getStartedLabel: string
  dashboardLabel: string
}

export function HomepageNavbar({
  user,
  signInLabel,
  getStartedLabel,
  dashboardLabel,
}: HomepageNavbarProps) {
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-[26px] border border-white/10 bg-[rgba(7,10,15,0.74)] px-4 py-3 shadow-[0_18px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Polnation"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div className="leading-none">
            <div className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">Polnation</div>
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-white/45">USDC Rewards</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/academy"
            className="rounded-full px-4 py-2 text-sm text-white/70 transition hover:bg-white/6 hover:text-white"
          >
            Academy
          </Link>
          <a
            href="/polnation-earning-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-4 py-2 text-sm text-white/70 transition hover:bg-white/6 hover:text-white"
          >
            Earning Guide
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/18"
            >
              {dashboardLabel}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-2 text-sm text-white/70 transition hover:bg-white/6 hover:text-white sm:px-4"
              >
                {signInLabel}
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
              >
                {getStartedLabel}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
