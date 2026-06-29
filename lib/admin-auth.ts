import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

function getSecret(): string {
  // Prefer a dedicated secret; fall back to service role key (always set in prod)
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No admin session secret configured')
  return secret
}

// Server-enforced token lifetime. Tokens older than this are rejected even if
// the cookie is replayed (the cookie maxAge is only a client-side hint).
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

/** Generate a signed token: `{randomHex}.{issuedAtMs}.{hmac-sha256}` */
export function generateAdminToken(): string {
  const payload = `${randomBytes(24).toString('hex')}.${Date.now()}`
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/** Verify the HMAC signature in the admin_session cookie. */
export async function verifyAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_session')?.value
    if (!token) return false

    const dot = token.lastIndexOf('.')
    if (dot === -1) return false

    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    if (!payload || !sig) return false

    const expected = createHmac('sha256', getSecret()).update(payload).digest('hex')

    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expectedBuf.length) return false
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false

    // Reject expired tokens. payload = `{randomHex}.{issuedAtMs}`; legacy tokens
    // without a timestamp parse to NaN/old and are rejected (admin re-logs in once).
    const iat = parseInt(payload.slice(payload.lastIndexOf('.') + 1), 10)
    if (!iat || Date.now() - iat > TOKEN_MAX_AGE_MS) return false

    return true
  } catch {
    return false
  }
}
