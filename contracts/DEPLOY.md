# AlphaStake Deployment Guide
_Last updated: 2026-06-10_

## Live Deployment (Polygon Mainnet)

| Contract | Address |
|----------|---------|
| AlphaYieldStrategy | `0x222F505B3f7af753df10Fccf103F99C40c548673` |
| AlphaStake | `0x25785a4be7B8Af8966189BFfa7d3D68D02C82b33` |
| Owner | `0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63` |

Both contracts are verified on Polygonscan.

Whitelist users stake on-chain via Polygonscan (user website stays at capacity).

## Prerequisites

- Node.js installed
- MATIC in your executor wallet (for gas — ~0.1 MATIC is enough)
- Your `executor/.env` or `contracts/.env` file with:

```
PRIVATE_KEY=your_private_key_without_0x
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

Get a free Polygonscan API key at: https://polygonscan.com/myapikey

---

## Step 1 — Pull latest code

```bash
git pull origin main
cd contracts
npm install
```

---

## Step 2 — Compile (verify no errors)

```bash
npx hardhat compile
```

Expected output: `Compiled 4 Solidity files successfully`

---

## Step 3 — Deploy to Polygon Mainnet

```bash
npx hardhat run scripts/deploy-alphastake.js --network polygon
```

Note the contract address printed in the output. You will need it for Steps 4 and 5.

---

## Step 4 — Verify on Polygonscan (makes contract code public)

```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS> 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
```

Replace `<CONTRACT_ADDRESS>` with the address from Step 3.

After verification, anyone can read the contract code on Polygonscan — this is what builds user trust.

---

## Step 5 — Update frontend with contract address

In `g:\polnation\.env.local`, add:

```
NEXT_PUBLIC_ALPHASTAKE_ADDRESS=<CONTRACT_ADDRESS>
```

Then redeploy the frontend (Vercel will auto-deploy on git push).

---

## Contract Details

| Parameter | Value |
|-----------|-------|
| Network | Polygon Mainnet (Chain ID: 137) |
| Token | Native USDC — `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Min Stake | $50 USDC |
| Early Unstake Penalty | 15% of principal |
| Instant Withdrawal Limit | < $50,000 USDC (owner only) |
| Large Withdrawal Timelock | ≥ $50,000 USDC — 48 hour delay |
| Tiers | 15d/1.0% · 30d/1.1% · 60d/1.2% · 150d/1.3% · 300d/1.5% per day |

---

## Owner Operations (executor wallet)

### Withdraw funds for trading (< $50k, instant)
Call `ownerWithdrawInstant(address to, uint256 amount)` directly from the executor wallet.

### Withdraw funds for trading (≥ $50k, timelocked)
1. Call `queueWithdrawal(address to, uint256 amount)` — starts 48h timer, visible on Polygonscan
2. After 48 hours, call `executeWithdrawal(uint256 withdrawalId)`

### Pause in emergency
Call `pause()` — freezes all user stake/withdraw operations.

### Withdraw accumulated penalties
Call `withdrawPenalties(address to)` — sends the 15% penalty pool to your wallet.
