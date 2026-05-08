// Synthetic email domains we issue to users who sign up without a real email
// (wallet-only or Telegram-only flows). These rows look authenticated to
// Supabase but cannot be used to sign in via email + password until the user
// binds a real address through /api/auth/bind-email.

const PLACEHOLDER_EMAIL_DOMAINS = [
  '@wallet.polnation.com',
  '@telegram.polnation.com',
] as const

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return PLACEHOLDER_EMAIL_DOMAINS.some((d) => email.endsWith(d))
}

// For UI copy that needs to differ between the two flows. Returns null when
// the email is real (i.e. the user has already bound a working address).
export function getPlaceholderType(
  email: string | null | undefined,
): 'wallet' | 'telegram' | null {
  if (!email) return 'wallet' // legacy rows with NULL email behave like wallet users
  if (email.endsWith('@wallet.polnation.com')) return 'wallet'
  if (email.endsWith('@telegram.polnation.com')) return 'telegram'
  return null
}
