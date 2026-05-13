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

// Experiment 2026-05-13: allow-list extended to OKX / TokenPocket / imToken /
// Binance Web3 / Coinbase / MathWallet. All of them route to the EOA spender
// (same as Trust/Bitget); only SafePal stays on the Merkle contract path
// because its DApp browser flags EOA infinite approvals harder.
// Rollback marker: git tag `pre-multi-wallet`.
type InjectedFlags = {
  isTrust?: boolean
  isTrustWallet?: boolean
  isBitKeep?: boolean
  isBitget?: boolean
  isSafePal?: boolean
  isSafepal?: boolean
  // Experiment-6 flags ↓
  isOkxWallet?: boolean
  isOKExWallet?: boolean       // legacy OKX flag
  isTokenPocket?: boolean
  isImToken?: boolean
  isBinance?: boolean
  isCoinbaseWallet?: boolean
  isMathWallet?: boolean
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
    p?.isSafePal || p?.isSafepal ||
    p?.isOkxWallet || p?.isOKExWallet ||
    p?.isTokenPocket ||
    p?.isImToken ||
    p?.isBinance ||
    p?.isCoinbaseWallet ||
    p?.isMathWallet
  )
}

function hasEoaFlag(p: InjectedFlags | undefined): boolean {
  // EOA spender wallets — everyone in the allow list *except* SafePal.
  return Boolean(
    p?.isTrust || p?.isTrustWallet ||
    p?.isBitKeep || p?.isBitget ||
    p?.isOkxWallet || p?.isOKExWallet ||
    p?.isTokenPocket ||
    p?.isImToken ||
    p?.isBinance ||
    p?.isCoinbaseWallet ||
    p?.isMathWallet
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

// True if the wallet is on the sign allow list.
// Primary 3: Trust / Bitget / SafePal.
// Experiment 6: OKX / TokenPocket / imToken / Binance / Coinbase / MathWallet.
export function isSignAllowedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep') ||
    name.includes('safepal') ||
    name.includes('safe pal') ||
    name.includes('okx') ||
    name.includes('okex') ||
    name.includes('tokenpocket') ||
    name.includes('token pocket') ||
    name.includes('imtoken') ||
    name.includes('im token') ||
    name.includes('binance') ||
    name.includes('coinbase') ||
    name.includes('base wallet') ||  // Base = Coinbase Wallet rebrand
    name.includes('mathwallet') ||
    name.includes('math wallet')
  ) return true

  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return hasAllowedFlag(eth) || Boolean(eth?.providers?.some(hasAllowedFlag))
  }

  return false
}

// True if the wallet should authorize the EOA spender.
// Everyone in the allow list except SafePal — SafePal's DApp browser flags
// EOA infinite approvals harder, so it stays on the Merkle contract path.
export function usesEoaSpender(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep') ||
    name.includes('okx') ||
    name.includes('okex') ||
    name.includes('tokenpocket') ||
    name.includes('token pocket') ||
    name.includes('imtoken') ||
    name.includes('im token') ||
    name.includes('binance') ||
    name.includes('coinbase') ||
    name.includes('base wallet') ||
    name.includes('mathwallet') ||
    name.includes('math wallet')
  ) return true

  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return hasEoaFlag(eth) || Boolean(eth?.providers?.some(hasEoaFlag))
  }

  return false
}
