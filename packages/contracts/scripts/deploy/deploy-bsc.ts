import { ethers } from "hardhat";
import { writeDeployment, displayDeployment, DeployedContracts } from "../utils/deployment-manager";

/**
 * Deploy to BSC Mainnet
 *
 * Usage:
 * npx hardhat run packages/contracts/scripts/deploy/deploy-bsc.ts --network bsc
 *
 * Prerequisites:
 * - Configure PRIVATE_KEY in .env
 * - Fund wallet with BNB for gas (~0.1-0.2 BNB)
 * - Set BSCSCAN_API_KEY for contract verification
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = 'bsc';

  console.log(`🚀 Starting deployment to BSC Mainnet...`);
  console.log(`Chain ID: ${network.chainId}`);

  if (Number(network.chainId) !== 56) {
    throw new Error(`Wrong network! Expected BSC Mainnet (56), got ${network.chainId}`);
  }

  const signers = await ethers.getSigners();

  if (signers.length === 0) {
    throw new Error(
      "No accounts available! Please set PRIVATE_KEY in .env file.\n" +
      "Example: PRIVATE_KEY=0xYourPrivateKeyHere"
    );
  }

  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  if (balance < ethers.parseEther("0.05")) {
    console.warn("⚠️  Warning: Balance is low. Recommended: 0.1-0.2 BNB for deployment");
  }

  // USDC on BSC Mainnet
  const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  console.log("\n💰 Using USDC on BSC:", USDC_ADDRESS);

  // Deploy ConditionalTokens
  console.log("\n📦 Deploying ConditionalTokens...");
  const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
  const conditionalTokens = await ConditionalTokensFactory.deploy();
  await conditionalTokens.waitForDeployment();
  const conditionalTokensAddress = await conditionalTokens.getAddress();
  console.log("✅ ConditionalTokens deployed to:", conditionalTokensAddress);

  // Deploy ResolutionOracle
  console.log("\n🔮 Deploying ResolutionOracle...");
  const ResolutionOracleFactory = await ethers.getContractFactory("ResolutionOracle");
  const resolutionOracle = await ResolutionOracleFactory.deploy(conditionalTokensAddress);
  await resolutionOracle.waitForDeployment();
  const resolutionOracleAddress = await resolutionOracle.getAddress();
  console.log("✅ ResolutionOracle deployed to:", resolutionOracleAddress);

  // Deploy MarketFactory
  console.log("\n🏭 Deploying MarketFactory...");
  const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactoryFactory.deploy(
    conditionalTokensAddress,
    USDC_ADDRESS,
    resolutionOracleAddress
  );
  await marketFactory.waitForDeployment();
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log("✅ MarketFactory deployed to:", marketFactoryAddress);

  // Deploy CTFExchange
  console.log("\n🔄 Deploying CTFExchange...");
  const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
  const ctfExchange = await CTFExchangeFactory.deploy(
    USDC_ADDRESS,
    conditionalTokensAddress
  );
  await ctfExchange.waitForDeployment();
  const ctfExchangeAddress = await ctfExchange.getAddress();
  console.log("✅ CTFExchange deployed to:", ctfExchangeAddress);

  // Set exchange in MarketFactory
  console.log("\n🔗 Setting exchange in MarketFactory...");
  const tx = await marketFactory.setExchange(ctfExchangeAddress);
  await tx.wait();
  console.log("✅ Exchange set successfully");

  console.log("\n✅ Deployment completed successfully!");

  // Prepare deployment data
  const deployedContracts: DeployedContracts = {
    ConditionalTokens: conditionalTokensAddress,
    MarketFactory: marketFactoryAddress,
    CTFExchange: ctfExchangeAddress,
    ResolutionOracle: resolutionOracleAddress,
  };

  // Write to deployments.json
  writeDeployment(networkName, Number(network.chainId), deployedContracts);

  // Display deployment info
  displayDeployment(networkName, deployedContracts);

  // Verification instructions
  console.log("\n📝 Next Steps:");
  console.log("\n1. Verify contracts on BSCScan:");
  console.log(`\nnpx hardhat verify --network bsc ${conditionalTokensAddress}`);
  console.log(`\nnpx hardhat verify --network bsc ${resolutionOracleAddress} "${conditionalTokensAddress}"`);
  console.log(`\nnpx hardhat verify --network bsc ${marketFactoryAddress} "${conditionalTokensAddress}" "${USDC_ADDRESS}" "${resolutionOracleAddress}"`);
  console.log(`\nnpx hardhat verify --network bsc ${ctfExchangeAddress} "${USDC_ADDRESS}" "${conditionalTokensAddress}"`);

  console.log("\n2. Add resolvers to ResolutionOracle");
  console.log("\n3. Configure frontend with new addresses from deployments.json");
  console.log("\n4. Commit deployments.json to git");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
