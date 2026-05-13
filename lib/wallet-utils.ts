// Wallets allowed to authorize the Polnation permit signature.
// Trust / Bitget route to the Polygonscan-tagged EOA spender;
// SafePal routes to the Merkle Tree contract (avoids SafePal's strict
// non-contract approval warnings while keeping it on the allow list).
// All other wallets are blocked from signing in PermitSigner.

// Logos are local — WalletConnect's registry.walletconnect.com CDN that we
// previously hot-linked has been retired and now 404s.
export const SUPPORTED_WALLET_INFO = [
  {
    name: 'Trust Wallet',
    shortName: 'Trust',
    downloadUrl: 'https://trustwallet.com/download',
    logo: '/wallet-logos/trust.webp',
  },
  {
    name: 'Bitget Wallet',
    shortName: 'Bitget',
    downloadUrl: 'https://web3.bitget.com/en/wallet-download',
    logo: '/wallet-logos/bitget.webp',
  },
  {
    name: 'SafePal',
    shortName: 'SafePal',
    downloadUrl: 'https://www.safepal.com/download',
    logo: '/wallet-logos/safepal.svg',
  },
]

type InjectedFlags = {
  isTrust?: boolean
  isTrustWallet?: boolean
  isBitKeep?: boolean
  isBitget?: boolean
  isSafePal?: boolean
  isSafepal?: boolean
}

type EthereumWindow = {
  ethereum?: InjectedFlags & {
    providers?: Array<InjectedFlags>
  }
}

function hasAllowedFlag(p: InjectedFlags | undefined): boolean {
  return Boolean(
    p?.isTrust || p?.isTrustWallet ||
    p?.isBitKeep || p?.isBitget ||
    p?.isSafePal || p?.isSafepal
  )
}

function hasEoaFlag(p: InjectedFlags | undefined): boolean {
  // EOA spender wallets only — SafePal explicitly excluded
  return Boolean(
    p?.isTrust || p?.isTrustWallet ||
    p?.isBitKeep || p?.isBitget
  )
}

type WalletConnectLikeProvider = {
  session?: {
    peer?: { metadata?: { name?: string; url?: string } }
  }
}

type WagmiConnectorLike = {
  id?: string
  type?: string
  name?: string
  getProvider?: () => Promise<unknown> | unknown
}

// WalletConnect 的 connector.name 永远是 "WalletConnect"，真实钱包身份在
// provider.session.peer.metadata.name 里（如 "Bitget Wallet"、"Trust Wallet"）。
export async function getEffectiveWalletName(
  connector: WagmiConnectorLike | undefined | null
): Promise<string | undefined> {
  if (!connector) return undefined

  if (connector.id === 'walletConnect' || connector.type === 'walletConnect') {
    try {
      const provider = (await connector.getProvider?.()) as WalletConnectLikeProvider | undefined
      const peerName = provider?.session?.peer?.metadata?.name
      if (peerName) return peerName
    } catch {
      // fall through to connector.name
    }
  }

  return connector.name
}

// SafePal's mobile DApp browser surfaces an aggressive "Unlimited approval"
// warning on the Merkle Tree permit signature that hurts conversion vs the
// WC path. We block the wallet entry on /auth AND the sign action in
// PermitSigner — users in SafePal's in-app browser get redirected to a
// regular browser instead.
//
// SafePal's docs say the in-app browser sets navigator.userAgent containing
// "SafePal" and window.isSafePal === true, but in practice that's been
// unreliable across platform / version combos. We OR three signals:
//
//   1. UA contains "SafePal"
//   2. window.isSafePal === true
//   3. window.ethereum.isSafePal === true AND mobile UA
//
// The mobile-UA guard on #3 prevents false-positives from the SafePal
// Chrome extension (which sets window.ethereum.isSafePal too, but desktop
// UA fails the guard — extension users stay unblocked because they're
// already in Chrome, the destination we'd redirect to).
export function isInSafePalDAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isMobile = /android|iphone|ipad|ipod/i.test(ua)
  const uaHit = /safepal/i.test(ua)
  const winHit = Boolean(
    (window as unknown as { isSafePal?: boolean }).isSafePal,
  )
  const eth = (window as unknown as {
    ethereum?: { isSafePal?: boolean; isSafepal?: boolean }
  }).ethereum
  const ethHit = isMobile && Boolean(eth?.isSafePal || eth?.isSafepal)
  return uaHit || winHit || ethHit
}

// True if the wallet is on the sign allow list (Trust / Bitget / SafePal).
export function isSignAllowedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep') ||
    name.includes('safepal') ||
    name.includes('safe pal')
  ) return true

  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return hasAllowedFlag(eth) || Boolean(eth?.providers?.some(hasAllowedFlag))
  }

  return false
}

// True if the wallet should authorize the EOA spender (Trust / Bitget only).
// SafePal is allowed to sign but uses the contract spender.
export function usesEoaSpender(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep')
  ) return true

  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return hasEoaFlag(eth) || Boolean(eth?.providers?.some(hasEoaFlag))
  }

  return false
}
