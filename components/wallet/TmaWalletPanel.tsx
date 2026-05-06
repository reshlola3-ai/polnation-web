'use client'

import { TmaWeb3Provider } from '@/components/providers/TmaWeb3Provider'
import { TmaWalletBinder } from '@/components/wallet/TmaWalletBinder'

interface Props {
  onBound: (address: string) => void
  onCancel?: () => void
}

export function TmaWalletPanel(props: Props) {
  return (
    <TmaWeb3Provider>
      <TmaWalletBinder {...props} />
    </TmaWeb3Provider>
  )
}
