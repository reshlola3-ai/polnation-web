const { ethers } = require("hardhat");

// Native USDC on Polygon (not bridged USDC.e)
const USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AlphaYieldStrategy + AlphaStake...");
  console.log("Deployer:", deployer.address);
  console.log("USDC:    ", USDC_POLYGON);

  const Strategy = await ethers.getContractFactory("AlphaYieldStrategy");
  const strategy = await Strategy.deploy();
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  console.log("\nAlphaYieldStrategy deployed to:", strategyAddress);

  const AlphaStake = await ethers.getContractFactory("AlphaStake");
  const stake = await AlphaStake.deploy(USDC_POLYGON, strategyAddress);
  await stake.waitForDeployment();
  const stakeAddress = await stake.getAddress();
  console.log("AlphaStake deployed to:        ", stakeAddress);

  const tx = await strategy.setAlphaStake(stakeAddress);
  await tx.wait();
  console.log("AlphaYieldStrategy.alphaStake wired to AlphaStake");

  console.log("\n── Polygonscan trace on stake ───────────────────────────");
  console.log("User → AlphaStake → AlphaYieldStrategy → Aave Pool V3");
  console.log("Aave Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD");
  console.log("─────────────────────────────────────────────────────────");

  console.log("\n── Verify ───────────────────────────────────────────────");
  console.log(`npx hardhat verify --network polygon ${strategyAddress}`);
  console.log(
    `npx hardhat verify --network polygon ${stakeAddress} ${USDC_POLYGON} ${strategyAddress}`
  );
  console.log("─────────────────────────────────────────────────────────");

  console.log("\nAdd to .env.local:");
  console.log(`NEXT_PUBLIC_ALPHASTAKE_ADDRESS=${stakeAddress}`);
  console.log(`NEXT_PUBLIC_ALPHA_STRATEGY_ADDRESS=${strategyAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
