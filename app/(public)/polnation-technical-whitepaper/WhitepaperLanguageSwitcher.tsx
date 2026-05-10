'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { localeFlags, localeNames, type Locale } from '@/i18n/config'

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
  const [selectedLocale, setSelectedLocale] = useState<Locale>(
    OPTIONS.some(option => option.locale === currentLocale) ? (currentLocale as Locale) : 'en'
  )
  const router = useRouter()
  const current = OPTIONS.find(option => option.locale === selectedLocale) ?? OPTIONS[0]

  async function selectLocale(locale: Locale) {
    setSelectedLocale(locale)
    setOpen(false)
    await fetch(`/api/whitepaper-locale?locale=${locale}&redirect=false`, {
      credentials: 'same-origin',
    })
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 px-3 py-2 font-mono text-xs font-semibold text-zinc-400 transition hover:text-white"
        aria-label={`Language: ${localeNames[current.locale]}`}
      >
        <span className="text-base leading-none">{localeFlags[current.locale]}</span>
        <span>{current.label}</span>
        <span>v</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 border border-white/10 bg-[#120d2a] shadow-xl">
          {OPTIONS.map(option => (
            <button
              key={option.locale}
              type="button"
              onClick={() => selectLocale(option.locale)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left font-mono text-xs transition ${
                option.locale === current.locale
                  ? 'bg-purple-500/20 text-purple-200'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{localeFlags[option.locale]}</span>
              <span>{option.label}</span>
              <span className="truncate text-[11px] opacity-70">{localeNames[option.locale]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
