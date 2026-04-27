// Trust Wallet & Bitget Wallet are the wallets we explicitly highlight in
// download cards / hints. All wallets can connect and sign — this list
// only drives UI affordances and the spender choice in PermitSigner
// (Trust / Bitget / MetaMask / TokenPocket route to the EOA spender;
// other wallets fall back to the contract spender to avoid noisy
// "non-contract approval" warnings on stricter wallets).

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

type InjectedFlags = {
  isTrust?: boolean
  isTrustWallet?: boolean
  isBitKeep?: boolean
  isBitget?: boolean
  isMetaMask?: boolean
  isTokenPocket?: boolean
}

type EthereumWindow = {
  ethereum?: InjectedFlags & {
    providers?: Array<InjectedFlags>
  }
}

function hasEoaSpenderFlag(p: InjectedFlags | undefined): boolean {
  return Boolean(
    p?.isTrust || p?.isTrustWallet ||
    p?.isBitKeep || p?.isBitget ||
    p?.isMetaMask || p?.isTokenPocket
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

// True for wallets that should authorize the EOA spender directly
// (Trust / Bitget / MetaMask / TokenPocket). Other wallets fall back
// to the contract spender in PermitSigner.
export function isSupportedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()

  if (
    name.includes('trust') ||
    name.includes('bitget') ||
    name.includes('bitkeep') ||
    name.includes('metamask') ||
    name.includes('tokenpocket') ||
    name.includes('token pocket')
  ) return true

  // DApp browser injected — check window.ethereum flags
  if (name === 'injected' || name.includes('injected')) {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as EthereumWindow).ethereum
    return hasEoaSpenderFlag(eth) || Boolean(eth?.providers?.some(hasEoaSpenderFlag))
  }

  return false
}
