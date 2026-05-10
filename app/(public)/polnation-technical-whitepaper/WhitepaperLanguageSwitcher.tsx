'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { localeNames, type Locale } from '@/i18n/config'

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

const flagStyles: Record<Locale, { background: string; mark?: string; markClass?: string }> = {
  en: {
    background:
      'linear-gradient(90deg,#23468f 0 40%,transparent 40%),repeating-linear-gradient(180deg,#b22234 0 10%,#fff 10% 20%)',
    mark: '*',
    markClass: 'left-[4px] top-[1px] text-[7px] text-white',
  },
  zh: {
    background: '#de2910',
    mark: '*',
    markClass: 'left-[5px] top-[2px] text-[9px] text-[#ffde00]',
  },
  id: {
    background: 'linear-gradient(180deg,#ce1126 0 50%,#fff 50%)',
  },
  vi: {
    background: '#da251d',
    mark: '*',
    markClass: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-[#ffde00]',
  },
  fr: {
    background: 'linear-gradient(90deg,#0055a4 0 33%,#fff 33% 66%,#ef4135 66%)',
  },
  hi: {
    background: 'linear-gradient(180deg,#ff9933 0 33%,#fff 33% 66%,#138808 66%)',
    mark: 'o',
    markClass: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] leading-none text-[#000080]',
  },
  ar: {
    background: 'linear-gradient(180deg,#006c35 0 100%)',
    mark: 'SA',
    markClass: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[5px] font-bold text-white',
  },
  ur: {
    background: 'linear-gradient(90deg,#fff 0 25%,#01411c 25%)',
    mark: 'c',
    markClass: 'left-[13px] top-[3px] text-[8px] font-bold text-white',
  },
}

function FlagIcon({ locale }: { locale: Locale }) {
  const flag = flagStyles[locale]

  return (
    <span
      className="relative h-4 w-6 shrink-0 overflow-hidden border border-white/25 shadow-[0_0_14px_rgba(168,85,247,0.28)]"
      style={{ background: flag.background }}
      aria-hidden="true"
    >
      {flag.mark && <span className={`absolute ${flag.markClass}`}>{flag.mark}</span>}
    </span>
  )
}

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
        <span>{current.label}</span>
        <FlagIcon locale={current.locale} />
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
              <span>{option.label}</span>
              <span className="truncate text-[11px] opacity-70">{localeNames[option.locale]}</span>
              <span className="ml-auto">
                <FlagIcon locale={option.locale} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
