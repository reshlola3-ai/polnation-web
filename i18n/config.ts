export const locales = ['en', 'zh', 'fr', 'id', 'vi', 'hi', 'ar', 'ur'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: 'Chinese',
  fr: 'French',
  id: 'Indonesia',
  vi: 'Vietnamese',
  hi: 'Hindi',
  ar: 'Arabic',
  ur: 'Urdu',
}

export const localeFlags: Record<Locale, string> = {
  en: 'EN',
  zh: 'ZH',
  fr: 'FR',
  id: 'ID',
  vi: 'VI',
  hi: 'HI',
  ar: 'AR',
  ur: 'UR',
}
