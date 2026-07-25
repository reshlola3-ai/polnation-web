/**
 * PolnationAlpha 2.0 — one-shot deploy with LP control wrapper.
 *
 * What this script does, in order:
 *   1. Mint a fresh Uniswap V3 USDC/USDT (0.01%) position from the deployer,
 *      seeded with SEED_USDC + SEED_USDT (a narrow range around $1.00).
 *   2. Deploy PolnationAlphaV2 with that position's tokenId.
 *   3. Deploy AlphaLpController (ops / emergency LP control).
 *   4. Transfer the LP NFT INTO PolnationAlphaV2 (safeTransferFrom).
 *   5. V2.authorizeLpOperator(controller) → setApprovalForAll on NFPM.
 *   6. (Optional) renounce V2 ownership only — controller ownership is kept.
 *
 * After step 5: V2 owns the NFT (user claim/compound paths work as owner).
 * Controller is NFPM operator for V2 → can decrease/collect/reclaim NFT.
 * Controller owner ≡ full LP fund control (prefer a Safe multisig).
 *
 * Run:
 *   npx hardhat run scripts/deploy-polnation-alpha-v2.js --network polygon
 *
 * Required env (contracts/.env):
 *   PRIVATE_KEY=...            (deployer = will be ROOT_WALLET unless ROOT_WALLET set)
 *   POLYGON_RPC_URL=...
 *   POLYGONSCAN_API_KEY=...
 * Optional env:
 *   ROOT_WALLET=0x...          (fee + referral root; defaults to deployer)
 *   CONTROLLER_OWNER=0x...     (AlphaLpController owner; defaults to deployer)
 *   SEED_USDC=1000             (human units; default 1000)
 *   SEED_USDT=1000             (human units; default 1000)
 *   RANGE_BPS=20               (half-width of price range in bps; default 20 = ±0.20%)
 *   RENOUNCE=true              (renounce V2 ownership at the end; default false)
 */
const { ethers } = require("hardhat");

// ─── Polygon mainnet constants ──────────────────────────────────────────────
const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // native USDC (6 dec)
const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // USDT (6 dec)
const NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // NonfungiblePositionManager
const POOL_1BPS = "0x31083a78e11b18e450fd139f9abea98cd53181b7"; // USDC/USDT 0.01%
const FEE = 100; // 0.01%

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function tickSpacing() view returns (int24)",
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)",
];
const NFPM_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 f0,uint256 f1,uint128 owed0,uint128 owed1)",
  "function safeTransferFrom(address,address,uint256)",
  "function isApprovedForAll(address,address) view returns (bool)",
];

function floorToSpacing(tick, spacing) {
  const t = Number(tick);
  const s = Number(spacing);
  return Math.floor(t / s) * s;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const root = process.env.ROOT_WALLET || deployer.address;
  const controllerOwner = process.env.CONTROLLER_OWNER || deployer.address;
  const seedUsdc = ethers.parseUnits(process.env.SEED_USDC || "1000", 6);
  const seedUsdt = ethers.parseUnits(process.env.SEED_USDT || "1000", 6);
  const rangeBps = parseInt(process.env.RANGE_BPS || "20", 10);
  const doRenounce = (process.env.RENOUNCE || "false").toLowerCase() === "true";

  console.log("Deployer:         ", deployer.address);
  console.log("ROOT_WALLET:      ", root);
  console.log("CONTROLLER_OWNER: ", controllerOwner);
  console.log("Seed USDC:        ", ethers.formatUnits(seedUsdc, 6));
  console.log("Seed USDT:        ", ethers.formatUnits(seedUsdt, 6));

  const pool = new ethers.Contract(POOL_1BPS, POOL_ABI, deployer);
  const token0 = (await pool.token0()).toLowerCase();
  const token1 = (await pool.token1()).toLowerCase();
  const spacing = await pool.tickSpacing();
  const slot0 = await pool.slot0();
  const curTick = slot0[1];
  const usdcIsToken0 = token0 === USDC.toLowerCase();
  console.log("\nPool token0:", token0, "token1:", token1);
  console.log("usdcIsToken0:", usdcIsToken0, "| tickSpacing:", spacing.toString(), "| tick:", curTick.toString());

  // Build a symmetric range around current tick. 1 tick ≈ 1bps, so rangeBps ≈ ticks.
  const lower = floorToSpacing(Number(curTick) - rangeBps, spacing);
  const upper = floorToSpacing(Number(curTick) + rangeBps, spacing) + Number(spacing);
  console.log("tickLower:", lower, "tickUpper:", upper);

  // amount0/amount1 in pool token order
  const amount0Desired = usdcIsToken0 ? seedUsdc : seedUsdt;
  const amount1Desired = usdcIsToken0 ? seedUsdt : seedUsdc;

  // Approvals
  const usdc = new ethers.Contract(USDC, ERC20_ABI, deployer);
  const usdt = new ethers.Contract(USDT, ERC20_ABI, deployer);
  console.log("\nApproving USDC + USDT to NFPM...");
  await (await usdc.approve(NFPM, seedUsdc)).wait();
  await (await usdt.approve(NFPM, seedUsdt)).wait();

  // Mint position
  const nfpm = new ethers.Contract(NFPM, NFPM_ABI, deployer);
  console.log("Minting LP position...");
  const mintParams = {
    token0: usdcIsToken0 ? USDC : USDT,
    token1: usdcIsToken0 ? USDT : USDC,
    fee: FEE,
    tickLower: lower,
    tickUpper: upper,
    amount0Desired,
    amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 600,
  };
  const mintTx = await nfpm.mint(mintParams);
  const rc = await mintTx.wait();

  // Parse tokenId from Transfer event (ERC721 mint: from 0x0)
  let tokenId;
  for (const log of rc.logs) {
    if (log.address.toLowerCase() === NFPM.toLowerCase() && log.topics.length === 4) {
      // Transfer(address,address,uint256)
      const from = "0x" + log.topics[1].slice(26);
      if (from === "0x0000000000000000000000000000000000000000") {
        tokenId = BigInt(log.topics[3]);
        break;
      }
    }
  }
  if (tokenId === undefined) throw new Error("Could not parse minted tokenId");
  console.log("Minted LP tokenId:", tokenId.toString());

  const pos = await nfpm.positions(tokenId);
  const liquidity = pos[7];
  console.log("Position liquidity:", liquidity.toString());

  // usdcToLiquidityRate = liquidity * 1e18 / usdcSeeded  (single-sided approximation
  // used by _withdrawFromPool to size decreaseLiquidity). Use the USDC leg.
  const usdcSeeded = usdcIsToken0 ? seedUsdc : seedUsdc; // seedUsdc is the USDC amount
  const usdcToLiquidityRate = (BigInt(liquidity) * 10n ** 18n) / BigInt(usdcSeeded);
  console.log("usdcToLiquidityRate:", usdcToLiquidityRate.toString());

  // Deploy staking contract
  console.log("\nDeploying PolnationAlphaV2...");
  const Factory = await ethers.getContractFactory("PolnationAlphaV2");
  const c = await Factory.deploy(
    USDC,
    NFPM,
    tokenId,
    usdcIsToken0,
    usdcToLiquidityRate,
    root
  );
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("PolnationAlphaV2 deployed to:", addr);

  // Deploy LP controller
  console.log("\nDeploying AlphaLpController...");
  const CtrlFactory = await ethers.getContractFactory("AlphaLpController");
  const ctrl = await CtrlFactory.deploy(NFPM, tokenId, USDC, USDT);
  await ctrl.waitForDeployment();
  const ctrlAddr = await ctrl.getAddress();
  console.log("AlphaLpController deployed to:", ctrlAddr);

  if (controllerOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("Transferring controller ownership to", controllerOwner);
    await (await ctrl.transferOwnership(controllerOwner)).wait();
  }

  // Transfer LP NFT into the staking contract
  console.log("\nTransferring LP NFT into PolnationAlphaV2...");
  await (await nfpm.safeTransferFrom(deployer.address, addr, tokenId)).wait();
  console.log("LP NFT now owned by PolnationAlphaV2.");

  // Authorize controller as NFPM operator for V2 (must be AFTER transfer)
  console.log("\nAuthorizing AlphaLpController as LP operator...");
  await (await c.authorizeLpOperator(ctrlAddr)).wait();
  const approved = await nfpm.isApprovedForAll(addr, ctrlAddr);
  console.log("isApprovedForAll(V2, controller):", approved);
  if (!approved) throw new Error("authorizeLpOperator failed — operator not set");

  if (doRenounce) {
    console.log("\nRenouncing PolnationAlphaV2 ownership (controller ownership kept)...");
    await (await c.renounceOwnership()).wait();
    console.log("V2 ownership renounced. Controller owner still controls the LP.");
  } else {
    console.log("\n(Skipped V2 renounce — owner can still pause()/revokeLpOperator(). Set RENOUNCE=true to renounce V2 only.)");
  }

  console.log("\n── Verify on Polygonscan ────────────────────────────────");
  console.log(
    `npx hardhat verify --network polygon ${addr} ${USDC} ${NFPM} ${tokenId} ${usdcIsToken0} ${usdcToLiquidityRate} ${root}`
  );
  console.log(
    `npx hardhat verify --network polygon ${ctrlAddr} ${NFPM} ${tokenId} ${USDC} ${USDT}`
  );
  console.log("\n── Add to g:\\polnation\\.env.local ──────────────────────");
  console.log(`NEXT_PUBLIC_POLNATION_ALPHA_V2_ADDRESS=${addr}`);
  console.log(`NEXT_PUBLIC_POLNATION_ALPHA_V2_LP_TOKEN_ID=${tokenId}`);
  console.log(`NEXT_PUBLIC_POLNATION_ALPHA_V2_CONTROLLER=${ctrlAddr}`);
  console.log("─────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
