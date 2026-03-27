const hre = require("hardhat");

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║     PolnationMerkleTree Contract Deployer      ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");

  const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  const [deployer] = await hre.ethers.getSigners();
  console.log("🔗 Network: Polygon Mainnet");
  console.log("👛 Deployer:", deployer.address);
  console.log("📄 USDC:", USDC_ADDRESS);
  console.log("");

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const matic = hre.ethers.formatEther(balance);
  console.log("💰 MATIC Balance:", matic, "MATIC");

  if (parseFloat(matic) < 0.01) {
    console.error("❌ MATIC 余额不足，至少需要 0.01 MATIC");
    process.exit(1);
  }

  console.log("");
  console.log("⏳ Deploying PolnationMerkleTree...");

  const Factory = await hre.ethers.getContractFactory("PolnationMerkleTree");
  const contract = await Factory.deploy(USDC_ADDRESS);

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("");
  console.log("✅ PolnationMerkleTree deployed!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("📋 CONTRACT ADDRESS:", address);
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 View on Polygonscan:");
  console.log(`   https://polygonscan.com/address/${address}`);
  console.log("");
  console.log("📝 Next: give this address to Cursor to update the code.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
