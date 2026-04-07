import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

function getSecret(): string {
  // Prefer a dedicated secret; fall back to service role key (always set in prod)
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No admin session secret configured')
  return secret
}

/** Generate a signed token: `{randomHex}.{hmac-sha256}` */
export function generateAdminToken(): string {
  const payload = randomBytes(32).toString('hex')
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

    return timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}
