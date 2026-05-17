import { createClient } from '@/lib/supabase'

/**
 * Full sign-out used by every logout entry point (profile, navbar, …).
 *
 * Clearing the Supabase session alone is not enough: wagmi/WalletConnect/
 * web3modal persist the last wallet connection in localStorage and
 * `reconnectOnMount` re-establishes it on the next page load, which the
 * WalletAuthFlow auto-login effect then turns straight back into a session.
 * So we also purge that persisted wallet state and set a one-shot
 * `pol_logged_out` flag that WalletAuthFlow consumes to skip the immediate
 * auto-login (covering dApp in-app browsers where the injected provider
 * re-announces via EIP-6963 even after storage is cleared).
 *
 * Performs a hard navigation so the post-signOut request carries cleared
 * cookies (a soft router.push races middleware).
 */
export async function signOutEverywhere(redirectTo: string): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()

  if (typeof window === 'undefined') return

  const prefixes = ['wagmi', 'wc@2:', '@w3m', 'W3M', '@appkit']
  for (const key of Object.keys(localStorage)) {
    if (prefixes.some((p) => key.startsWith(p)) || key === 'WALLETCONNECT_DEEPLINK_CHOICE') {
      localStorage.removeItem(key)
    }
  }
  localStorage.setItem('pol_logged_out', '1')

  window.location.href = redirectTo
}
