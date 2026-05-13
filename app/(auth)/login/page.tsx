import { redirect } from 'next/navigation'

// /login is preserved as a permanent alias to /auth?mode=signin so external
// links and bookmarks keep working. The real page lives at /auth.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams({ mode: 'signin' })
  const r = params.redirect
  const ref = params.ref
  if (typeof r === 'string') qs.set('redirect', r)
  if (typeof ref === 'string') qs.set('ref', ref)
  redirect(`/auth?${qs.toString()}`)
}
