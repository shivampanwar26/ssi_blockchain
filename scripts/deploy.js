import hre from "hardhat";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n🚀 Deploying SSIRegistry Contract...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  const SSIRegistry = await hre.ethers.getContractFactory("SSIRegistry");
  const ssiRegistry = await SSIRegistry.deploy();
  
  await ssiRegistry.waitForDeployment();
  
  const contractAddress = await ssiRegistry.getAddress();
  
  console.log("✅ SSIRegistry deployed to:", contractAddress);
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    transactionHash: ssiRegistry.deploymentTransaction().hash
  };

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '..', 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (err) {
    // Directory might already exist, that's fine
  }

  // Save to blockchain-config.json
  const configPath = path.join(dataDir, 'blockchain-config.json');
  await fs.writeFile(configPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📝 Deployment info saved to:", configPath);
  
  // Verify on Etherscan if not localhost
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations...");
    await ssiRegistry.deploymentTransaction().wait(6); // Wait for 6 confirmations
    
    console.log("\n🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }

  console.log("\n✅ Deployment complete!\n");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("\nYou can now use this contract address in your SSI application.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });