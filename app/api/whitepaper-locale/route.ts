import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/i18n/config'

export function GET(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get('locale')
  const locale = locales.includes(localeParam as never) ? localeParam! : defaultLocale
  const redirect = new URL('/polnation-technical-whitepaper', request.url)
  const response = NextResponse.redirect(redirect)
  response.cookies.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}
