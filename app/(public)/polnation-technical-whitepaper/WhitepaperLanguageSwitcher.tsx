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

function starPoints(cx: number, cy: number, outer: number, inner = outer * 0.42) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    const radius = index % 2 === 0 ? outer : inner
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
  }).join(' ')
}

function Star({ cx, cy, r, fill = '#fff' }: { cx: number; cy: number; r: number; fill?: string }) {
  return <polygon points={starPoints(cx, cy, r)} fill={fill} />
}

function FlagIcon({ locale }: { locale: Locale }) {
  const baseClass = 'h-4 w-6 shrink-0 overflow-hidden border border-white/25 shadow-[0_0_14px_rgba(168,85,247,0.28)]'

  if (locale === 'en') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="40" fill="#fff" />
        {Array.from({ length: 7 }, (_, index) => (
          <rect key={index} y={index * 6} width="60" height="3.1" fill="#b22234" />
        ))}
        <rect width="26" height="21" fill="#3c3b6e" />
        {Array.from({ length: 12 }, (_, index) => (
          <circle key={index} cx={4 + (index % 4) * 6} cy={4 + Math.floor(index / 4) * 6} r="1" fill="#fff" />
        ))}
      </svg>
    )
  }

  if (locale === 'zh') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="40" fill="#de2910" />
        <Star cx={12} cy={10} r={6} fill="#ffde00" />
        <Star cx={24} cy={5} r={2.2} fill="#ffde00" />
        <Star cx={29} cy={10} r={2.2} fill="#ffde00" />
        <Star cx={29} cy={17} r={2.2} fill="#ffde00" />
        <Star cx={24} cy={22} r={2.2} fill="#ffde00" />
      </svg>
    )
  }

  if (locale === 'id') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="20" fill="#ce1126" />
        <rect y="20" width="60" height="20" fill="#fff" />
      </svg>
    )
  }

  if (locale === 'vi') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="40" fill="#da251d" />
        <Star cx={30} cy={20} r={9} fill="#ffde00" />
      </svg>
    )
  }

  if (locale === 'fr') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="20" height="40" fill="#0055a4" />
        <rect x="20" width="20" height="40" fill="#fff" />
        <rect x="40" width="20" height="40" fill="#ef4135" />
      </svg>
    )
  }

  if (locale === 'hi') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="13.34" fill="#ff9933" />
        <rect y="13.34" width="60" height="13.34" fill="#fff" />
        <rect y="26.68" width="60" height="13.32" fill="#138808" />
        <circle cx="30" cy="20" r="5" fill="none" stroke="#000080" strokeWidth="1.2" />
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            x1="30"
            y1="20"
            x2={30 + Math.cos((index * Math.PI) / 6) * 5}
            y2={20 + Math.sin((index * Math.PI) / 6) * 5}
            stroke="#000080"
            strokeWidth="0.45"
          />
        ))}
      </svg>
    )
  }

  if (locale === 'ar') {
    return (
      <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
        <rect width="60" height="40" fill="#006c35" />
        <path d="M14 24h32" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 29h23" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M22 14h16M18 18h24" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 60 40" className={baseClass} aria-hidden="true">
      <rect width="60" height="40" fill="#fff" />
      <rect x="15" width="45" height="40" fill="#01411c" />
      <circle cx="37" cy="19" r="9" fill="#fff" />
      <circle cx="41" cy="17" r="9" fill="#01411c" />
      <Star cx={45} cy={12} r={3.2} fill="#fff" />
    </svg>
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
