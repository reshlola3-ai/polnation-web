// WalletConnect session 健康处理，多个签名流程共用（staking 现在用；PermitSigner 待统一）。
// 背景：用户久未登录后回来，WC relay session 可能已死——签名请求要么秒抛 session 错误，
// 要么发到死链路上永远挂着。此处集中：① 判断错误是否为 session 失效 ② 给签名加超时
// ③ 手机端把钱包 app 唤到前台（否则用户看不到弹窗，超时无法区分"没切过去"与"session 死"）
// ④ 主动检测 WC session 是否正式过期（只认正式过期，绝不误伤活 session）。

import type { Connector } from 'wagmi'

export function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

// 手机端唤起钱包 app 的 universal link（与 PermitSigner 的 WC_OPEN_LINK 保持一致）。
const WC_OPEN_LINK: Record<string, string> = {
  bitget: 'https://bkcode.vip',
  bitkeep: 'https://bkcode.vip',
  trust: 'https://link.trustwallet.com',
}

export function getWalletOpenLink(walletName: string | undefined): string | null {
  if (!walletName) return null
  const lower = walletName.toLowerCase()
  for (const key of Object.keys(WC_OPEN_LINK)) {
    if (lower.includes(key)) return WC_OPEN_LINK[key]
  }
  return null
}

/** 手机端把钱包 app 唤到前台，让 WC 的待处理签名请求自动弹出。返回是否成功发起。 */
export function bringWalletToForeground(walletName: string | undefined): boolean {
  const href = getWalletOpenLink(walletName)
  if (!href) return false
  try {
    window.open(href, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}

export class SignTimeoutError extends Error {
  constructor() {
    super('sign_timeout')
    this.name = 'SignTimeoutError'
  }
}

/** 给签名/交易 promise 加超时。超时抛 SignTimeoutError（可用 isSignTimeout 识别）。 */
export async function withSignTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SignTimeoutError()), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function isSignTimeout(err: unknown): boolean {
  return err instanceof SignTimeoutError || (err as { name?: string })?.name === 'SignTimeoutError'
}

// WC v2 session 失效时常见的错误片段（全部小写匹配）。
const SESSION_ERROR_FRAGMENTS = [
  'session topic',
  'no matching key',
  'no matching session',
  'missing or invalid',
  'session expired',
  'record was recently deleted',
  'pairing',
  'session request expired',
  'proposal expired',
  'invalid session',
  'session disconnected',
]

export function isSessionError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  if (!msg) return false
  return SESSION_ERROR_FRAGMENTS.some((f) => msg.includes(f))
}

// 从 localStorage 恢复的死 session 会造出一个"残缺 connector"（缺 getChainId/getAccounts）。
// wagmi 的 getConnectorClient 会调 connection.connector.getChainId()，于是抛
// "getChainId is not a function"。这不是 session 字符串错误，但恢复动作相同：断开重连。
const CONNECTOR_UNAVAILABLE_FRAGMENTS = [
  'getchainid is not a function',
  'getaccounts is not a function',
  'connectorunavailable',
  'connector unavailable',
  'connector is not connected',
  'connectornotconnected',
]

export function isConnectorUnavailable(err: unknown): boolean {
  const name = (err as { name?: string })?.name?.toLowerCase() ?? ''
  if (name.includes('connectorunavailable') || name.includes('connectornotconnected')) return true
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  if (!msg) return false
  return CONNECTOR_UNAVAILABLE_FRAGMENTS.some((f) => msg.includes(f))
}

/** 签名失败后是否应提示用户"重连钱包"：超时 / session 失效 / connector 残缺 都算。 */
export function shouldOfferReconnect(err: unknown): boolean {
  return isSignTimeout(err) || isSessionError(err) || isConnectorUnavailable(err)
}

/**
 * 主动探测：connector 是否残缺（缺 getChainId）。从 localStorage 恢复的死 session
 * 会造出这种半成品 connector，一签名就抛错。进页面时探到就断开，回到"连接钱包"。
 * 保守：只有确凿缺方法才返回 true；正常 connector 一律 false，绝不误伤。
 */
export function isConnectorBroken(connector: Connector | null | undefined): boolean {
  if (!connector) return false
  const c = connector as unknown as { getChainId?: unknown; getAccounts?: unknown }
  return typeof c.getChainId !== 'function' || typeof c.getAccounts !== 'function'
}

/**
 * 主动检测 WC session 是否"正式过期"（session.expiry 已过）。
 * 保守：只有能确凿读到已过期才返回 true，其余一律 false，绝不误伤活 session。
 */
export async function isWcSessionExpired(connector: Connector | null | undefined): Promise<boolean> {
  try {
    if (!connector) return false
    const id = (connector.id || '').toLowerCase()
    const type = (connector.type || '').toLowerCase()
    if (!id.includes('walletconnect') && !type.includes('walletconnect')) return false
    const provider = (await connector.getProvider?.()) as { session?: { expiry?: number } } | undefined
    const expiry = provider?.session?.expiry
    if (!expiry || !Number.isFinite(Number(expiry))) return false
    return Date.now() / 1000 > Number(expiry)
  } catch {
    return false
  }
}
