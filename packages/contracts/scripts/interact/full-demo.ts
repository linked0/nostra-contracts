import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Complete market lifecycle demo
 * Creates, bets, resolves, and redeems in one script
 *
 * Usage:
 * npx hardhat run scripts/interact/full-demo.ts --network bscTestnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log("\n🎬 Starting Full Market Lifecycle Demo");
  console.log("═".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log("═".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);

  // Read deployment
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  // Get contracts
  const marketFactory = await ethers.getContractAt("MarketFactory", deployment.contracts.MarketFactory);
  const conditionalTokens = await ethers.getContractAt("ConditionalTokens", deployment.contracts.ConditionalTokens);
  const mockUSDC = await ethers.getContractAt("MockUSDC", deployment.contracts.MockUSDC!);
  const resolutionOracle = await ethers.getContractAt("ResolutionOracle", deployment.contracts.ResolutionOracle);

  // ========================================
  // STEP 1: CREATE MARKET
  // ========================================
  console.log("\n\n📊 STEP 1: Creating Market");
  console.log("─".repeat(60));

  const questionId = ethers.id(`Demo: Will BNB reach $1000? ${Date.now()}`);
  const question = "Will BNB reach $1000 by end of 2025?";
  const endTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now (for demo)
  const resolutionTime = endTime + 60;

  console.log(`Question: ${question}`);
  console.log(`Creating market...`);

  const createTx = await marketFactory.createBinaryMarket(
    questionId,
    question,
    "Demo market for testing",
    "Crypto",
    endTime,
    resolutionTime
  );

  const createReceipt = await createTx.wait();
  const createEvent = createReceipt.logs.find((log: any) => {
    try {
      const parsed = marketFactory.interface.parseLog(log);
      return parsed?.name === "MarketCreated";
    } catch {
      return false;
    }
  });

  const parsed = marketFactory.interface.parseLog(createEvent);
  const conditionId = parsed?.args.conditionId;
  const tokenIds = parsed?.args.tokenIds;

  console.log("✅ Market created!");
  console.log(`Condition ID: ${conditionId}`);
  console.log(`YES Token: ${tokenIds[0]}`);
  console.log(`NO Token: ${tokenIds[1]}`);

  // ========================================
  // STEP 2: PLACE BET
  // ========================================
  console.log("\n\n💰 STEP 2: Placing Bet");
  console.log("─".repeat(60));

  // Check/mint USDC
  let usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  if (usdcBalance < ethers.parseUnits("100", 6)) {
    console.log("Minting 1000 USDC...");
    await (await mockUSDC.mint(deployer.address, ethers.parseUnits("1000", 6))).wait();
    usdcBalance = await mockUSDC.balanceOf(deployer.address);
    console.log(`New balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  }

  const betAmount = ethers.parseUnits("100", 6);
  console.log(`\nBetting ${ethers.formatUnits(betAmount, 6)} USDC on YES`);

  // Approve
  console.log("Approving USDC...");
  await (await mockUSDC.approve(deployment.contracts.ConditionalTokens, betAmount)).wait();

  // Split position
  console.log("Splitting position...");
  await (await conditionalTokens.splitPosition(
    mockUSDC.target,
    ethers.ZeroHash,
    conditionId,
    [1, 2],
    betAmount
  )).wait();

  const yesBalance = await conditionalTokens.balanceOf(deployer.address, tokenIds[0]);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, tokenIds[1]);

  console.log("✅ Bet placed!");
  console.log(`YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`NO Tokens: ${ethers.formatUnits(noBalance, 6)}`);

  // ========================================
  // STEP 3: RESOLVE MARKET
  // ========================================
  console.log("\n\n⚖️  STEP 3: Resolving Market");
  console.log("─".repeat(60));

  // Check if resolver
  const isResolver = await resolutionOracle.isResolver(deployer.address);
  if (!isResolver) {
    console.error("❌ Not a resolver! Cannot resolve market.");
    console.log("Skipping resolution and redemption...");
    return;
  }

  console.log("You are a resolver ✅");
  console.log("Resolving to YES (outcome 1)...");

  const payouts = [0, 1]; // YES wins
  await (await resolutionOracle.resolveCondition(questionId, payouts)).wait();

  console.log("✅ Market resolved!");
  console.log("Winning outcome: YES");

  // ========================================
  // STEP 4: REDEEM TOKENS
  // ========================================
  console.log("\n\n💸 STEP 4: Redeeming Tokens");
  console.log("─".repeat(60));

  const usdcBefore = await mockUSDC.balanceOf(deployer.address);
  console.log(`USDC Before: ${ethers.formatUnits(usdcBefore, 6)} USDC`);

  console.log("Redeeming tokens...");
  await (await conditionalTokens.redeemPositions(
    mockUSDC.target,
    ethers.ZeroHash,
    conditionId,
    [1, 2]
  )).wait();

  const usdcAfter = await mockUSDC.balanceOf(deployer.address);
  const usdcGained = usdcAfter - usdcBefore;

  console.log("✅ Redeemed!");
  console.log(`USDC After: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
  console.log(`USDC Gained: ${ethers.formatUnits(usdcGained, 6)} USDC`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log("\n\n🎉 DEMO COMPLETE!");
  console.log("═".repeat(60));
  console.log("Market Lifecycle Summary:");
  console.log(`1. ✅ Created market: ${question}`);
  console.log(`2. ✅ Placed bet: ${ethers.formatUnits(betAmount, 6)} USDC`);
  console.log(`3. ✅ Resolved market: YES won`);
  console.log(`4. ✅ Redeemed tokens: +${ethers.formatUnits(usdcGained, 6)} USDC`);
  console.log("═".repeat(60));
  console.log(`\n🏆 Final Balance: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
  console.log("\n✅ All steps completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Demo failed:", error);
    process.exit(1);
  });
