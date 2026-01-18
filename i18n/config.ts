export const locales = ['en', 'fr', 'id', 'vi'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  id: 'Indonesia',
  vi: 'Tiếng Việt',
}

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  id: '🇮🇩',
  vi: '🇻🇳',
}
