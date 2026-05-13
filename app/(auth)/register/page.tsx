import { redirect } from 'next/navigation'

// /register is preserved as a permanent alias to /auth?mode=signup. The real
// page lives at /auth. Email verification still goes to /register/verify.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams({ mode: 'signup' })
  const r = params.redirect
  const ref = params.ref
  if (typeof r === 'string') qs.set('redirect', r)
  if (typeof ref === 'string') qs.set('ref', ref)
  redirect(`/auth?${qs.toString()}`)
}
