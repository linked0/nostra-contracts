import { ethers } from "hardhat";
import { writeDeployment, displayDeployment, DeployedContracts } from "../utils/deployment-manager";

/**
 * Generic deployment script for all networks
 *
 * Usage:
 * npx hardhat run scripts/deploy/deploy.ts --network polygon
 * npx hardhat run scripts/deploy/deploy.ts --network polygonAmoy
 * npx hardhat run scripts/deploy/deploy.ts --network bsc
 * npx hardhat run scripts/deploy/deploy.ts --network bscTestnet
 */

async function main() {
  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`🚀 Starting deployment on ${networkName}...`);
  console.log(`Chain ID: ${network.chainId}`);

  const signers = await ethers.getSigners();

  if (signers.length === 0) {
    throw new Error(
      "No accounts available! Please set PRIVATE_KEY in .env file.\n" +
      "Example: PRIVATE_KEY=0xYourPrivateKeyHere"
    );
  }

  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Determine if this is a testnet (deploy MockUSDC)
  const isTestnet = ['localhost', 'polygonAmoy', 'bscTestnet'].includes(networkName);

  // Deploy ConditionalTokens
  console.log("\n📦 Deploying ConditionalTokens...");
  const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
  const conditionalTokens = await ConditionalTokensFactory.deploy();
  await conditionalTokens.waitForDeployment();
  const conditionalTokensAddress = await conditionalTokens.getAddress();
  console.log("ConditionalTokens deployed to:", conditionalTokensAddress);

  // Deploy collateral token (MockUSDC for testnets, use existing USDC for mainnets)
  let collateralAddress: string;

  if (isTestnet) {
    console.log("\n💰 Deploying Mock USDC (testnet)...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    collateralAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", collateralAddress);
  } else {
    // For mainnets, you should configure the real USDC address
    console.log("\n💰 Using existing USDC (mainnet)...");

    // USDC addresses by network
    const usdcAddresses: { [key: string]: string } = {
      'polygon': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      'bsc': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BSC
    };

    collateralAddress = usdcAddresses[networkName];

    if (!collateralAddress) {
      throw new Error(`USDC address not configured for network: ${networkName}`);
    }

    console.log("Using USDC at:", collateralAddress);
  }

  // Deploy ResolutionOracle
  console.log("\n🔮 Deploying ResolutionOracle...");
  const ResolutionOracleFactory = await ethers.getContractFactory("ResolutionOracle");
  const resolutionOracle = await ResolutionOracleFactory.deploy(conditionalTokensAddress);
  await resolutionOracle.waitForDeployment();
  const resolutionOracleAddress = await resolutionOracle.getAddress();
  console.log("ResolutionOracle deployed to:", resolutionOracleAddress);

  // Deploy MarketFactory
  console.log("\n🏭 Deploying MarketFactory...");
  const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactoryFactory.deploy(
    conditionalTokensAddress,
    collateralAddress,
    resolutionOracleAddress
  );
  await marketFactory.waitForDeployment();
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log("MarketFactory deployed to:", marketFactoryAddress);

  // Deploy CTFExchange
  console.log("\n🔄 Deploying CTFExchange...");
  const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
  const ctfExchange = await CTFExchangeFactory.deploy(
    collateralAddress,
    conditionalTokensAddress
  );
  await ctfExchange.waitForDeployment();
  const ctfExchangeAddress = await ctfExchange.getAddress();
  console.log("CTFExchange deployed to:", ctfExchangeAddress);

  // Set exchange in MarketFactory
  console.log("\n🔗 Setting exchange in MarketFactory...");
  await marketFactory.setExchange(ctfExchangeAddress);
  console.log("Exchange set successfully");

  // For testnets, add deployer as a test resolver
  if (isTestnet) {
    console.log("\n👥 Adding deployer as test resolver...");
    await resolutionOracle.addResolver(deployer.address);
    console.log("Test resolver added:", deployer.address);
  }

  console.log("\n✅ Deployment completed successfully!");

  // Prepare deployment data
  const deployedContracts: DeployedContracts = {
    ConditionalTokens: conditionalTokensAddress,
    MarketFactory: marketFactoryAddress,
    CTFExchange: ctfExchangeAddress,
    ResolutionOracle: resolutionOracleAddress,
    ...(isTestnet && { MockUSDC: collateralAddress }),
  };

  // Write to deployments.json
  writeDeployment(networkName, Number(network.chainId), deployedContracts);

  // Display deployment info
  displayDeployment(networkName, deployedContracts);

  // Contract verification instructions
  if (!isTestnet) {
    console.log("\n📝 Next Steps:");
    console.log("Verify contracts on block explorer:");
    console.log(`\nnpx hardhat verify --network ${networkName} ${conditionalTokensAddress}`);
    console.log(`npx hardhat verify --network ${networkName} ${resolutionOracleAddress} ${conditionalTokensAddress}`);
    console.log(`npx hardhat verify --network ${networkName} ${marketFactoryAddress} ${conditionalTokensAddress} ${collateralAddress} ${resolutionOracleAddress}`);
    console.log(`npx hardhat verify --network ${networkName} ${ctfExchangeAddress} ${collateralAddress} ${conditionalTokensAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
