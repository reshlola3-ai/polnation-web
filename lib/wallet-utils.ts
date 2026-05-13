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

// Detect whether the page is open inside ANY mobile wallet's in-app DApp
// browser. We force these users out to Chrome / a regular mobile browser
// where the WC + universal-link path delivers a consistent sign UX —
// avoiding per-wallet quirks in DApp-browser Permit simulators (SafePal's
// "Unlimited approval" scary card being the worst, but Trust/Bitget/OKX
// each have their own surprises too).
//
// Heuristic: mobile UA AND a window.ethereum injection.
//   - Mobile Chrome / Safari (no wallet) → ethereum not injected → not blocked
//   - Desktop Chrome with wallet extension → mobile UA fails → not blocked
//   - Any mobile wallet's DApp browser (Trust / Bitget / SafePal / OKX /
//     imToken / TokenPocket / MetaMask Mobile / etc.) → both true → blocked
//
// The companion sniffer-style "window.isSafePal", "isTrust" flags etc. are
// intentionally NOT used as triggers here — they'd false-positive on
// desktop extensions. The (mobile-UA + ethereum-injected) tuple is the
// reliable shape of an in-app DApp browser.
export function isInMobileDAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator === 'undefined') return false
  const isMobile =
    /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent,
    )
  const hasEthereum = Boolean(
    (window as unknown as { ethereum?: unknown }).ethereum,
  )
  return isMobile && hasEthereum
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
