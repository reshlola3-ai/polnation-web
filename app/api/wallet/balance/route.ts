import { NextRequest, NextResponse } from 'next/server'

// Alchemy RPC URL (same as chain-stats)
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'EPSkgE2Y0OHmmJnMwU8KX'}`

// Native USDC on Polygon
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'

// ERC20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = '0x70a08231'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    // Pad address to 32 bytes for balanceOf call
    const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0')
    const data = `${BALANCE_OF_SELECTOR}${paddedAddress}`

    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          { to: USDC_ADDRESS, data },
          'latest',
        ],
      }),
    })

    const result = await response.json()

    if (result.error) {
      console.error('[wallet/balance] RPC error:', result.error)
      return NextResponse.json({ balance: 0, error: result.error.message }, { status: 200 })
    }

    // USDC has 6 decimals
    const rawBalance = BigInt(result.result || '0x0')
    const balance = Number(rawBalance) / 1e6

    return NextResponse.json(
      { balance, address },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('[wallet/balance] Error:', error)
    return NextResponse.json({ balance: 0, error: 'Failed to fetch balance' }, { status: 200 })
  }
}
