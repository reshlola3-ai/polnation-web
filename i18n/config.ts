export const locales = ['en', 'fr', 'id', 'vi', 'hi', 'ar', 'ur'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  id: 'Indonesia',
  vi: 'Tiếng Việt',
  hi: 'हिन्दी',
  ar: 'العربية',
  ur: 'اردو',
}

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  id: '🇮🇩',
  vi: '🇻🇳',
  hi: '🇮🇳',
  ar: '🇸🇦',
  ur: '🇵🇰',
}
