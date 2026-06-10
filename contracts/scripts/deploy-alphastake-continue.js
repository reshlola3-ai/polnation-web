const { ethers } = require("hardhat");

// Native USDC on Polygon
const USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

// Already deployed in partial run — do not redeploy Strategy
const STRATEGY_ADDRESS = "0x222F505B3f7af753df10Fccf103F99C40c548673";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Strategy:  ", STRATEGY_ADDRESS);

  const AlphaStake = await ethers.getContractFactory("AlphaStake");
  const stake = await AlphaStake.deploy(USDC_POLYGON, STRATEGY_ADDRESS);
  await stake.waitForDeployment();
  const stakeAddress = await stake.getAddress();
  console.log("AlphaStake deployed to:", stakeAddress);

  const strategy = await ethers.getContractAt("AlphaYieldStrategy", STRATEGY_ADDRESS);
  const tx = await strategy.setAlphaStake(stakeAddress);
  await tx.wait();
  console.log("AlphaYieldStrategy.alphaStake wired to AlphaStake");

  console.log("\n── Addresses ────────────────────────────────────────────");
  console.log("AlphaYieldStrategy:", STRATEGY_ADDRESS);
  console.log("AlphaStake:        ", stakeAddress);
  console.log("─────────────────────────────────────────────────────────");
  console.log("\nAdd to .env.local:");
  console.log(`NEXT_PUBLIC_ALPHASTAKE_ADDRESS=${stakeAddress}`);
  console.log(`NEXT_PUBLIC_ALPHA_STRATEGY_ADDRESS=${STRATEGY_ADDRESS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
