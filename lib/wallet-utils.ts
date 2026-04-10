// Supported wallets: Trust Wallet and Bitget Wallet only

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
]

type EthereumWindow = {
  ethereum?: {
    isTrust?: boolean
    isTrustWallet?: boolean
    isBitKeep?: boolean
    isBitget?: boolean
    providers?: Array<{
      isTrust?: boolean
      isTrustWallet?: boolean
      isBitKeep?: boolean
      isBitget?: boolean
    }>
  }
}

export function isSupportedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  // Explicit connector name match
  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep')
  ) return true

  // DApp browser injected — check window.ethereum flags
  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return Boolean(
      eth?.isTrust ||
      eth?.isTrustWallet ||
      eth?.isBitKeep ||
      eth?.isBitget ||
      eth?.providers?.some(p => p?.isTrust || p?.isTrustWallet || p?.isBitKeep || p?.isBitget)
    )
  }

  return false
}

export const BLOCKED_WALLET_NAMES = [
  'metamask',
  'tokenpocket',
  'token pocket',
  'binance',
  'bnb',
  'safepal',
  'safe pal',
  'okx',
  'okex',
  'coinbase',
  'rainbow',
]

export function isBlockedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const lower = connectorName.toLowerCase()
  return BLOCKED_WALLET_NAMES.some(b => lower.includes(b))
}
