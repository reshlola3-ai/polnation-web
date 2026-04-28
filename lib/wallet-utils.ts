// Wallets allowed to authorize the Polnation permit signature.
// Trust / Bitget route to the Polygonscan-tagged EOA spender;
// SafePal routes to the Merkle Tree contract (avoids SafePal's strict
// non-contract approval warnings while keeping it on the allow list).
// All other wallets are blocked from signing in PermitSigner.

export const SUPPORTED_WALLET_INFO = [
  {
    name: 'Trust Wallet',
    shortName: 'Trust',
    downloadUrl: 'https://trustwallet.com/download',
    logo: 'https://registry.walletconnect.com/api/v1/logo/md/4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
  },
  {
    name: 'Bitget Wallet',
    shortName: 'Bitget',
    downloadUrl: 'https://web3.bitget.com/en/wallet-download',
    logo: 'https://registry.walletconnect.com/api/v1/logo/md/38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662',
  },
  {
    name: 'SafePal',
    shortName: 'SafePal',
    downloadUrl: 'https://www.safepal.com/download',
    logo: '/partners/safepal.svg',
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
