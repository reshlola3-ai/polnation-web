const hre = require("hardhat");

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║     PermitDistributor Contract Deployer        ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");

  const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  const [deployer] = await hre.ethers.getSigners();
  console.log("🔗 Network: Polygon Mainnet");
  console.log("👛 Deployer:", deployer.address);
  console.log("📄 USDC:", USDC_ADDRESS);
  console.log("");

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 MATIC Balance:", hre.ethers.formatEther(balance), "MATIC");
  console.log("");

  console.log("⏳ Deploying PermitDistributor...");
  
  const PermitDistributor = await hre.ethers.getContractFactory("PermitDistributor");
  const distributor = await PermitDistributor.deploy(USDC_ADDRESS);

  await distributor.waitForDeployment();

  const address = await distributor.getAddress();
  
  console.log("");
  console.log("✅ PermitDistributor deployed!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("📋 CONTRACT ADDRESS:", address);
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("🔍 Verify on Polygonscan:");
  console.log(`   https://polygonscan.com/address/${address}`);
  console.log("");
  console.log("📝 Next steps:");
  console.log("   1. Copy the contract address above");
  console.log("   2. Update lib/web3-config.ts PLATFORM_WALLET");
  console.log("   3. Update executor/.env DISTRIBUTOR_CONTRACT");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
