import { ethers } from "hardhat";
import { writeDeployment, displayDeployment, DeployedContracts } from "../utils/deployment-manager";

/**
 * Deploy to BSC Testnet
 *
 * Usage:
 * npx hardhat run packages/contracts/scripts/deploy/deploy-bsc-testnet.ts --network bscTestnet
 *
 * Prerequisites:
 * - Configure PRIVATE_KEY in .env
 * - Get testnet BNB from: https://testnet.bnbchain.org/faucet-smart
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = 'bscTestnet';

  console.log(`🚀 Starting deployment to BSC Testnet...`);
  console.log(`Chain ID: ${network.chainId}`);

  if (Number(network.chainId) !== 97) {
    throw new Error(`Wrong network! Expected BSC Testnet (97), got ${network.chainId}`);
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
  console.log("Account balance:", ethers.formatEther(balance), "tBNB");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance! Get testnet BNB from: https://testnet.bnbchain.org/faucet-smart");
  }

  // Deploy ConditionalTokens
  console.log("\n📦 Deploying ConditionalTokens...");
  const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
  const conditionalTokens = await ConditionalTokensFactory.deploy();
  await conditionalTokens.waitForDeployment();
  const conditionalTokensAddress = await conditionalTokens.getAddress();
  console.log("✅ ConditionalTokens deployed to:", conditionalTokensAddress);

  // Deploy Mock USDC (testnet only)
  console.log("\n💰 Deploying Mock USDC (testnet)...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", mockUSDCAddress);

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
    mockUSDCAddress,
    resolutionOracleAddress
  );
  await marketFactory.waitForDeployment();
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log("✅ MarketFactory deployed to:", marketFactoryAddress);

  // Deploy CTFExchange
  console.log("\n🔄 Deploying CTFExchange...");
  const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
  const ctfExchange = await CTFExchangeFactory.deploy(
    mockUSDCAddress,
    conditionalTokensAddress
  );
  await ctfExchange.waitForDeployment();
  const ctfExchangeAddress = await ctfExchange.getAddress();
  console.log("✅ CTFExchange deployed to:", ctfExchangeAddress);

  // Set exchange in MarketFactory
  console.log("\n🔗 Setting exchange in MarketFactory...");
  const setExchangeTx = await marketFactory.setExchange(ctfExchangeAddress);
  await setExchangeTx.wait();
  console.log("✅ Exchange set successfully");

  // Add MarketFactory as admin of CTFExchange
  console.log("\n🔐 Adding MarketFactory as admin of CTFExchange...");
  const addAdminTx = await ctfExchange.addAdmin(marketFactoryAddress);
  await addAdminTx.wait();
  console.log("✅ MarketFactory added as admin");

  // Add deployer as test resolver
  console.log("\n👥 Adding deployer as test resolver...");
  const addResolverTx = await resolutionOracle.addResolver(deployer.address);
  await addResolverTx.wait();
  console.log("✅ Test resolver added:", deployer.address);

  // Mint some test USDC to deployer
  console.log("\n💵 Minting test USDC to deployer...");
  const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  const mintTx = await mockUSDC.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("✅ Minted", ethers.formatUnits(mintAmount, 6), "USDC to deployer");

  console.log("\n✅ Deployment completed successfully!");

  // Prepare deployment data
  const deployedContracts: DeployedContracts = {
    ConditionalTokens: conditionalTokensAddress,
    MarketFactory: marketFactoryAddress,
    CTFExchange: ctfExchangeAddress,
    ResolutionOracle: resolutionOracleAddress,
    MockUSDC: mockUSDCAddress,
  };

  // Write to deployments.json
  writeDeployment(networkName, Number(network.chainId), deployedContracts);

  // Display deployment info
  displayDeployment(networkName, deployedContracts);

  // Next steps
  console.log("\n🎯 Next Steps:");
  console.log("\n1. Test the deployment:");
  console.log("   - Create a test market");
  console.log("   - Trade on the test market");
  console.log("   - Resolve the market");

  console.log("\n2. Optional - Verify contracts on BSCScan Testnet:");
  console.log(`\nnpx hardhat verify --network bscTestnet ${conditionalTokensAddress}`);
  console.log(`\nnpx hardhat verify --network bscTestnet ${mockUSDCAddress}`);
  console.log(`\nnpx hardhat verify --network bscTestnet ${resolutionOracleAddress} "${conditionalTokensAddress}"`);
  console.log(`\nnpx hardhat verify --network bscTestnet ${marketFactoryAddress} "${conditionalTokensAddress}" "${mockUSDCAddress}" "${resolutionOracleAddress}"`);
  console.log(`\nnpx hardhat verify --network bscTestnet ${ctfExchangeAddress} "${mockUSDCAddress}" "${conditionalTokensAddress}"`);

  console.log("\n3. Commit deployments.json to git");

  console.log("\n📚 Useful Links:");
  console.log("   BSC Testnet Explorer: https://testnet.bscscan.com");
  console.log("   BSC Testnet Faucet: https://testnet.bnbchain.org/faucet-smart");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
