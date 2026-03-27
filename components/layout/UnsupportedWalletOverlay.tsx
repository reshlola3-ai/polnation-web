'use client'

// All wallets are now supported via dual-spender strategy:
// - Trust / Bitget: EOA spender (PLATFORM_WALLET)
// - All other wallets: contract spender (PolnationMerkleTree)
export function UnsupportedWalletOverlay() {
  return null
}
