import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Resolve a prediction market
 * Only resolvers can do this
 *
 * Usage:
 * export CONDITION_ID="0x..."
 * npx hardhat run scripts/interact/03-resolve-market.ts --network bscTestnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`\n⚖️  Resolving market on ${networkName}...`);

  // Get condition ID from environment
  const conditionId = process.env.CONDITION_ID;
  if (!conditionId) {
    console.error("❌ Please set CONDITION_ID environment variable");
    process.exit(1);
  }

  // Get deployer account (should be a resolver)
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log("\n📋 Contract Addresses:");
  console.log(`ResolutionOracle: ${deployment.contracts.ResolutionOracle}`);
  console.log(`MarketFactory: ${deployment.contracts.MarketFactory}`);

  // Get contracts
  const resolutionOracle = await ethers.getContractAt(
    "ResolutionOracle",
    deployment.contracts.ResolutionOracle
  );

  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  console.log("\n🎯 Resolving Market:");
  console.log(`Condition ID: ${conditionId}`);

  // Get market details
  const market = await marketFactory.getMarket(conditionId);
  console.log(`\nMarket Question: ${market.question}`);
  console.log(`Outcomes: ${market.outcomeSlotCount}`);

  // Check if user is a resolver
  const isResolver = await resolutionOracle.isResolver(deployer.address);
  if (!isResolver) {
    console.error("\n❌ You are not a resolver!");
    console.log("Only resolvers can resolve markets.");
    process.exit(1);
  }

  console.log("✅ You are a resolver");

  // Ask which outcome won
  console.log("\n📊 Choose the winning outcome:");
  console.log("For binary markets:");
  console.log("  0 = NO");
  console.log("  1 = YES");

  // For demo, let's resolve to YES (outcome 1)
  const winningOutcome = 1;
  console.log(`\n🎲 Resolving to outcome: ${winningOutcome} (YES)`);

  // Create payout array (binary market)
  // If YES wins: [0, 1] means NO gets 0, YES gets 1
  // If NO wins:  [1, 0] means NO gets 1, YES gets 0
  const payouts = winningOutcome === 1 ? [0, 1] : [1, 0];

  console.log("\n⏳ Submitting resolution...");
  const questionId = ethers.keccak256(ethers.toUtf8Bytes(market.question));

  const resolveTx = await resolutionOracle.resolveCondition(
    questionId,
    payouts
  );

  console.log("Transaction sent:", resolveTx.hash);
  const receipt = await resolveTx.wait();
  console.log("✅ Transaction confirmed!");

  // Check resolution status
  const payoutNumerators = await conditionalTokens.payoutNumerators(conditionId, 0);
  const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);

  console.log("\n🎉 Market Resolved Successfully!");
  console.log("─".repeat(60));
  console.log(`Condition ID: ${conditionId}`);
  console.log(`Winning Outcome: ${winningOutcome === 1 ? 'YES' : 'NO'}`);
  console.log(`Payout Structure: ${payouts.join(', ')}`);
  console.log(`Payout Denominator: ${payoutDenominator}`);
  console.log("─".repeat(60));

  console.log("\n💡 What happens now:");
  console.log("- Winners can redeem their tokens for USDC");
  console.log("- Losers' tokens are now worthless");
  console.log("- Run 04-redeem-tokens.ts to claim your winnings");

  console.log("\n✅ Done! Next step: Run 04-redeem-tokens.ts to claim winnings");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
