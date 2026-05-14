const { ethers } = require("hardhat");

// Native USDC on Polygon (not bridged USDC.e)
const USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AlphaStake...");
  console.log("Deployer:", deployer.address);
  console.log("USDC:    ", USDC_POLYGON);

  const AlphaStake = await ethers.getContractFactory("AlphaStake");
  const contract   = await AlphaStake.deploy(USDC_POLYGON);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nAlphaStake deployed to:", address);

  console.log("\n── Next Steps ───────────────────────────────────────────");
  console.log("1. Verify on Polygonscan:");
  console.log(`   npx hardhat verify --network polygon ${address} ${USDC_POLYGON}`);
  console.log("");
  console.log("2. Transfer ownership to your Gnosis Safe:");
  console.log("   In Remix or Hardhat console:");
  console.log(`   const c = await ethers.getContractAt("AlphaStake", "${address}")`);
  console.log('   await c.transferOwnership("<YOUR_GNOSIS_SAFE_ADDRESS>")');
  console.log("");
  console.log("3. Confirm ownership transferred:");
  console.log("   await c.owner()  // should return your Safe address");
  console.log("─────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
