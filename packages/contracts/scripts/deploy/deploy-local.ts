import { ethers } from "hardhat";
import { Contract } from "ethers";
import { writeDeployment, displayDeployment, DeployedContracts } from "../utils/deployment-manager";

async function main() {
  console.log("🚀 Starting local deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy ConditionalTokens (mock for local testing)
  console.log("\n📦 Deploying ConditionalTokens...");
  const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
  const conditionalTokens = await ConditionalTokensFactory.deploy();
  await conditionalTokens.waitForDeployment();
  console.log("ConditionalTokens deployed to:", await conditionalTokens.getAddress());

  // Deploy mock USDC (for testing)
  console.log("\n💰 Deploying Mock USDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  console.log("Mock USDC deployed to:", await mockUSDC.getAddress());

  // Deploy ResolutionOracle
  console.log("\n🔮 Deploying ResolutionOracle...");
  const ResolutionOracleFactory = await ethers.getContractFactory("ResolutionOracle");
  const resolutionOracle = await ResolutionOracleFactory.deploy(await conditionalTokens.getAddress());
  await resolutionOracle.waitForDeployment();
  console.log("ResolutionOracle deployed to:", await resolutionOracle.getAddress());

  // Deploy MarketFactory
  console.log("\n🏭 Deploying MarketFactory...");
  const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactoryFactory.deploy(
    await conditionalTokens.getAddress(),
    await mockUSDC.getAddress(),
    await resolutionOracle.getAddress()
  );
  await marketFactory.waitForDeployment();
  console.log("MarketFactory deployed to:", await marketFactory.getAddress());

  // Deploy CTFExchange
  console.log("\n🔄 Deploying CTFExchange...");
  const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
  const ctfExchange = await CTFExchangeFactory.deploy(
    await mockUSDC.getAddress(),
    await conditionalTokens.getAddress()
  );
  await ctfExchange.waitForDeployment();
  console.log("CTFExchange deployed to:", await ctfExchange.getAddress());

  // Set exchange in MarketFactory
  console.log("\n🔗 Setting exchange in MarketFactory...");
  await marketFactory.setExchange(await ctfExchange.getAddress());
  console.log("Exchange set successfully");

  // Add some test resolvers
  console.log("\n👥 Adding test resolvers...");
  const [, , , testResolver] = await ethers.getSigners();
  await resolutionOracle.addResolver(testResolver.address);
  console.log("Test resolver added:", testResolver.address);

  console.log("\n✅ Deployment completed successfully!");

  // Save deployment to deployments.json
  const deployedContracts: DeployedContracts = {
    ConditionalTokens: await conditionalTokens.getAddress(),
    MarketFactory: await marketFactory.getAddress(),
    CTFExchange: await ctfExchange.getAddress(),
    ResolutionOracle: await resolutionOracle.getAddress(),
    MockUSDC: await mockUSDC.getAddress(),
  };

  // Write to deployments.json
  writeDeployment('localhost', 31337, deployedContracts);

  // Display deployment info
  displayDeployment('localhost', deployedContracts);

  console.log("\n🧪 Test Commands:");
  console.log("npx hardhat test --network localhost");
  console.log("npx hardhat run scripts/test/create-test-market.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });