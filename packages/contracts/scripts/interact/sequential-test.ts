import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Sequential Market Testing
 * Runs all steps in sequence with clear separation and pauses
 *
 * Usage:
 * npx hardhat run scripts/interact/sequential-test.ts --network bscTestnet
 */

// Global state to track between steps
let conditionId: string;
let yesTokenId: string;
let noTokenId: string;
let marketFactory: any;
let conditionalTokens: any;
let mockUSDC: any;
let resolutionOracle: any;
let deployer: any;

function separator() {
  console.log("\n" + "═".repeat(70) + "\n");
}

function pause(message: string = "Press Enter to continue...") {
  console.log(`\n⏸️  ${message}`);
  console.log("   (Script will auto-continue in 3 seconds)\n");
  return new Promise(resolve => setTimeout(resolve, 3000));
}

async function setup() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  separator();
  console.log("🎬 SEQUENTIAL MARKET TESTING");
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);
  separator();

  [deployer] = await ethers.getSigners();
  console.log(`Testing Account: ${deployer.address}`);

  // Read deployment
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log("\n📋 Deployed Contracts:");
  console.log(`  ConditionalTokens: ${deployment.contracts.ConditionalTokens}`);
  console.log(`  MarketFactory:     ${deployment.contracts.MarketFactory}`);
  console.log(`  ResolutionOracle:  ${deployment.contracts.ResolutionOracle}`);
  console.log(`  MockUSDC:          ${deployment.contracts.MockUSDC}`);

  // Get contract instances
  marketFactory = await ethers.getContractAt("MarketFactory", deployment.contracts.MarketFactory);
  conditionalTokens = await ethers.getContractAt("ConditionalTokens", deployment.contracts.ConditionalTokens);
  mockUSDC = await ethers.getContractAt("MockUSDC", deployment.contracts.MockUSDC!);
  resolutionOracle = await ethers.getContractAt("ResolutionOracle", deployment.contracts.ResolutionOracle);

  separator();
  console.log("✅ Setup Complete\n");
  await pause("Ready to start Step 1: Create Market");
}

async function step1_CreateMarket() {
  separator();
  console.log("📊 STEP 1: CREATE MARKET");
  separator();

  const questionId = ethers.id(`Test: Will BNB reach $1000? ${Date.now()}`);
  const question = "Will BNB reach $1000 by end of 2025?";
  const description = "Test market for sequential testing";
  const category = "Crypto";
  const endTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
  const resolutionTime = endTime + (24 * 60 * 60); // 1 day after

  console.log("Market Details:");
  console.log(`  Question: ${question}`);
  console.log(`  Category: ${category}`);
  console.log(`  End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`  Resolution: ${new Date(resolutionTime * 1000).toLocaleString()}`);

  console.log("\n📝 Creating market...");
  const tx = await marketFactory.createBinaryMarket(
    questionId,
    question,
    description,
    category,
    endTime,
    resolutionTime
  );

  console.log(`  Transaction: ${tx.hash}`);
  console.log(`  Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);

  // Parse event
  const event = receipt.logs.find((log: any) => {
    try {
      const parsed = marketFactory.interface.parseLog(log);
      return parsed?.name === "MarketCreated";
    } catch {
      return false;
    }
  });

  const parsed = marketFactory.interface.parseLog(event);
  conditionId = parsed?.args.conditionId;
  const tokenIds = parsed?.args.tokenIds;
  yesTokenId = tokenIds[0];
  noTokenId = tokenIds[1];

  console.log("\n🎉 Market Created Successfully!");
  console.log("─".repeat(70));
  console.log(`  Condition ID: ${conditionId}`);
  console.log(`  YES Token:    ${yesTokenId}`);
  console.log(`  NO Token:     ${noTokenId}`);
  console.log("─".repeat(70));

  // Get market info
  const market = await marketFactory.getMarket(conditionId);
  console.log("\n📊 Market Information:");
  console.log(`  Status: ${market.status === 0 ? 'Active ✅' : 'Other'}`);
  console.log(`  Creator: ${market.creator}`);
  console.log(`  Outcomes: ${market.outcomeSlotCount}`);
  console.log(`  Created: ${new Date(Number(market.createdAt) * 1000).toLocaleString()}`);

  console.log("\n✅ Step 1 Complete");
  await pause("Ready to proceed to Step 2: Place Bet");
}

async function step2_PlaceBet() {
  separator();
  console.log("💰 STEP 2: PLACE BET");
  separator();

  console.log("Market Information:");
  console.log(`  Condition ID: ${conditionId}`);
  console.log(`  YES Token: ${yesTokenId}`);
  console.log(`  NO Token: ${noTokenId}`);

  // Check USDC balance
  let usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`\n💵 Current USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  // Mint if needed
  const minRequired = ethers.parseUnits("100", 6);
  if (usdcBalance < minRequired) {
    console.log("\n💰 Insufficient USDC. Minting 1000 USDC...");
    const mintTx = await mockUSDC.mint(deployer.address, ethers.parseUnits("1000", 6));
    console.log(`  Transaction: ${mintTx.hash}`);
    await mintTx.wait();
    usdcBalance = await mockUSDC.balanceOf(deployer.address);
    console.log(`  ✅ New Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  }

  const betAmount = ethers.parseUnits("100", 6);
  console.log(`\n📊 Betting ${ethers.formatUnits(betAmount, 6)} USDC`);
  console.log("   This will give you:");
  console.log(`   - ${ethers.formatUnits(betAmount, 6)} YES tokens`);
  console.log(`   - ${ethers.formatUnits(betAmount, 6)} NO tokens`);

  // Approve
  console.log("\n🔓 Step 2a: Approving USDC...");
  const approveTx = await mockUSDC.approve(
    await conditionalTokens.getAddress(),
    betAmount
  );
  console.log(`  Transaction: ${approveTx.hash}`);
  await approveTx.wait();
  console.log("  ✅ Approved");

  // Split position
  console.log("\n🔀 Step 2b: Splitting position...");
  const partition = [1, 2]; // Binary: [YES, NO]
  const splitTx = await conditionalTokens.splitPosition(
    await mockUSDC.getAddress(),
    ethers.ZeroHash,
    conditionId,
    partition,
    betAmount
  );
  console.log(`  Transaction: ${splitTx.hash}`);
  await splitTx.wait();
  console.log("  ✅ Position split");

  // Check balances
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);
  const newUsdcBalance = await mockUSDC.balanceOf(deployer.address);

  console.log("\n🎉 Bet Placed Successfully!");
  console.log("─".repeat(70));
  console.log("  Token Balances:");
  console.log(`    YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`    NO Tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log("\n  USDC Balance:");
  console.log(`    Before: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log(`    After:  ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
  console.log(`    Spent:  ${ethers.formatUnits(usdcBalance - newUsdcBalance, 6)} USDC`);
  console.log("─".repeat(70));

  console.log("\n✅ Step 2 Complete");
  await pause("Ready to proceed to Step 3: Resolve Market");
}

async function step3_ResolveMarket() {
  separator();
  console.log("⚖️  STEP 3: RESOLVE MARKET");
  separator();

  console.log("Market Information:");
  console.log(`  Condition ID: ${conditionId}`);

  // Check if resolver
  const isResolver = await resolutionOracle.isResolver(deployer.address);
  console.log(`\n👤 Resolver Status: ${isResolver ? '✅ You are a resolver' : '❌ Not a resolver'}`);

  if (!isResolver) {
    console.error("\n❌ Cannot proceed: You are not authorized to resolve markets");
    console.log("   Only resolvers can resolve markets.");
    console.log("   For testnets, the deployer is usually added as a resolver.");
    throw new Error("Not authorized as resolver");
  }

  // Get market details
  const market = await marketFactory.getMarket(conditionId);
  console.log("\n📊 Market Details:");
  console.log(`  Question: ${market.question}`);
  console.log(`  Status: ${market.status === 0 ? 'Active' : 'Other'}`);
  console.log(`  Outcomes: ${market.outcomeSlotCount}`);

  console.log("\n🎲 Resolution Choice:");
  console.log("  Resolving to: YES (outcome 1)");
  console.log("  Payout Structure: [0, 1] (NO gets 0, YES gets 1)");

  // For YES win
  const winningOutcome = 1;
  const payouts = [0, 1]; // YES wins

  console.log("\n⏳ Submitting resolution...");
  const questionId = ethers.keccak256(ethers.toUtf8Bytes(market.question));
  const resolveTx = await resolutionOracle.resolveCondition(questionId, payouts);
  console.log(`  Transaction: ${resolveTx.hash}`);
  await resolveTx.wait();
  console.log("  ✅ Resolution confirmed");

  // Verify resolution
  const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
  const payout0 = await conditionalTokens.payoutNumerators(conditionId, 0);
  const payout1 = await conditionalTokens.payoutNumerators(conditionId, 1);

  console.log("\n🎉 Market Resolved Successfully!");
  console.log("─".repeat(70));
  console.log(`  Condition ID: ${conditionId}`);
  console.log(`  Winning Outcome: ${winningOutcome === 1 ? 'YES ✅' : 'NO'}`);
  console.log("\n  Payout Structure:");
  console.log(`    NO  payout: ${payout0} / ${payoutDenominator} = ${payout0 === 0n ? '0% (loses)' : '100% (wins)'}`);
  console.log(`    YES payout: ${payout1} / ${payoutDenominator} = ${payout1 === 0n ? '0% (loses)' : '100% (wins)'}`);
  console.log("─".repeat(70));

  console.log("\n💡 What this means:");
  console.log("   • YES token holders can redeem for full collateral");
  console.log("   • NO token holders get nothing");
  console.log("   • Since you have both, you'll get back your original bet");

  console.log("\n✅ Step 3 Complete");
  await pause("Ready to proceed to Step 4: Redeem Tokens");
}

async function step4_RedeemTokens() {
  separator();
  console.log("💸 STEP 4: REDEEM TOKENS");
  separator();

  console.log("Market Information:");
  console.log(`  Condition ID: ${conditionId}`);

  // Check current balances
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);
  const usdcBefore = await mockUSDC.balanceOf(deployer.address);

  console.log("\n📊 Current Balances:");
  console.log("  Outcome Tokens:");
  console.log(`    YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`    NO Tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log(`  USDC: ${ethers.formatUnits(usdcBefore, 6)} USDC`);

  if (yesBalance === 0n && noBalance === 0n) {
    console.log("\n⚠️  No tokens to redeem!");
    return;
  }

  // Verify market is resolved
  const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
  if (payoutDenominator === 0n) {
    console.error("\n❌ Market not resolved yet!");
    throw new Error("Market not resolved");
  }
  console.log(`\n✅ Market is resolved (denominator: ${payoutDenominator})`);

  console.log("\n🔄 Redeeming tokens...");
  const indexSets = [1, 2]; // Binary: [YES, NO]
  const redeemTx = await conditionalTokens.redeemPositions(
    await mockUSDC.getAddress(),
    ethers.ZeroHash,
    conditionId,
    indexSets
  );
  console.log(`  Transaction: ${redeemTx.hash}`);
  await redeemTx.wait();
  console.log("  ✅ Redemption confirmed");

  // Check final balances
  const yesBalanceAfter = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalanceAfter = await conditionalTokens.balanceOf(deployer.address, noTokenId);
  const usdcAfter = await mockUSDC.balanceOf(deployer.address);
  const usdcGained = usdcAfter - usdcBefore;

  console.log("\n🎉 Redemption Complete!");
  console.log("─".repeat(70));
  console.log("  Outcome Tokens:");
  console.log(`    YES: ${ethers.formatUnits(yesBalance, 6)} → ${ethers.formatUnits(yesBalanceAfter, 6)}`);
  console.log(`    NO:  ${ethers.formatUnits(noBalance, 6)} → ${ethers.formatUnits(noBalanceAfter, 6)}`);
  console.log("\n  USDC Balance:");
  console.log(`    Before: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
  console.log(`    After:  ${ethers.formatUnits(usdcAfter, 6)} USDC`);
  console.log(`    Gained: ${ethers.formatUnits(usdcGained, 6)} USDC`);
  console.log("─".repeat(70));

  if (usdcGained > 0n) {
    console.log("\n🎊 Congratulations!");
    console.log(`   You received ${ethers.formatUnits(usdcGained, 6)} USDC from winning tokens`);
  } else {
    console.log("\n   No USDC gained (all tokens were losing positions)");
  }

  console.log("\n✅ Step 4 Complete");
}

async function summary() {
  separator();
  console.log("📊 TESTING SUMMARY");
  separator();

  console.log("✅ All Steps Completed Successfully!\n");
  console.log("Steps Executed:");
  console.log("  1. ✅ Market Created");
  console.log("  2. ✅ Bet Placed (100 USDC → YES/NO tokens)");
  console.log("  3. ✅ Market Resolved (YES won)");
  console.log("  4. ✅ Tokens Redeemed (claimed winnings)");

  console.log("\n📋 Final State:");
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);
  const usdcBalance = await mockUSDC.balanceOf(deployer.address);

  console.log(`  YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`  NO Tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log(`  USDC:       ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  console.log("\n🎉 Sequential Testing Complete!");
  console.log("\n💡 What's Next:");
  console.log("   • Run again to test multiple markets");
  console.log("   • Test with different accounts");
  console.log("   • Build your frontend using these patterns");
  console.log("   • Deploy to mainnet when ready");

  separator();
}

async function main() {
  try {
    await setup();
    await step1_CreateMarket();
    await step2_PlaceBet();
    await step3_ResolveMarket();
    await step4_RedeemTokens();
    await summary();
  } catch (error) {
    console.error("\n❌ Testing Failed:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
