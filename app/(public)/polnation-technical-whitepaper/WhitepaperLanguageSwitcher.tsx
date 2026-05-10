'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const OPTIONS = [
  { locale: 'en', label: 'EN' },
  { locale: 'zh', label: 'ZH' },
  { locale: 'id', label: 'ID' },
  { locale: 'vi', label: 'VI' },
  { locale: 'fr', label: 'FR' },
  { locale: 'hi', label: 'HI' },
  { locale: 'ar', label: 'AR' },
  { locale: 'ur', label: 'UR' },
] as const

export function WhitepaperLanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const current = OPTIONS.find(option => option.locale === currentLocale) ?? OPTIONS[0]

  function selectLocale(locale: string) {
    setOpen(false)
    router.push(`/api/whitepaper-locale?locale=${locale}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-1 px-3 py-2 font-mono text-xs font-semibold text-zinc-400 transition hover:text-white"
      >
        {current.label} <span>v</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-28 border border-white/10 bg-[#120d2a] shadow-xl">
          {OPTIONS.map(option => (
            <button
              key={option.locale}
              type="button"
              onClick={() => selectLocale(option.locale)}
              className={`block w-full px-4 py-3 text-left font-mono text-xs transition ${
                option.locale === current.locale
                  ? 'bg-purple-500/20 text-purple-200'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
