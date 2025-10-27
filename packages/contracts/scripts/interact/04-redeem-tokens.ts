import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Redeem winning tokens for collateral (USDC)
 *
 * Usage:
 * export CONDITION_ID="0x..."
 * npx hardhat run scripts/interact/04-redeem-tokens.ts --network bscTestnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`\n💸 Redeeming tokens on ${networkName}...`);

  // Get condition ID from environment
  const conditionId = process.env.CONDITION_ID;
  if (!conditionId) {
    console.error("❌ Please set CONDITION_ID environment variable");
    process.exit(1);
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log("\n📋 Contract Addresses:");
  console.log(`ConditionalTokens: ${deployment.contracts.ConditionalTokens}`);
  console.log(`MockUSDC: ${deployment.contracts.MockUSDC}`);

  // Get contracts
  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  const mockUSDC = await ethers.getContractAt(
    "MockUSDC",
    deployment.contracts.MockUSDC!
  );

  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  console.log("\n🎯 Redeeming from Market:");
  console.log(`Condition ID: ${conditionId}`);

  // Get market details
  const market = await marketFactory.getMarket(conditionId);
  console.log(`Market Question: ${market.question}`);

  // Check if market is resolved
  const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
  if (payoutDenominator === 0n) {
    console.error("\n❌ Market not resolved yet!");
    console.log("Run 03-resolve-market.ts first");
    process.exit(1);
  }

  console.log("✅ Market is resolved");

  // Check token balances before redemption
  const yesTokenId = market.tokenIds[0];
  const noTokenId = market.tokenIds[1];

  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);

  console.log("\n📊 Your Token Balances:");
  console.log(`YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`NO Tokens:  ${ethers.formatUnits(noBalance, 6)}`);

  if (yesBalance === 0n && noBalance === 0n) {
    console.log("\n⚠️  You don't have any tokens to redeem!");
    process.exit(0);
  }

  // Get USDC balance before redemption
  const usdcBefore = await mockUSDC.balanceOf(deployer.address);
  console.log(`\n💵 USDC Before: ${ethers.formatUnits(usdcBefore, 6)} USDC`);

  // Redeem tokens
  console.log("\n🔄 Redeeming tokens...");

  const indexSets = [1, 2]; // Binary market: [YES, NO]
  const redeemTx = await conditionalTokens.redeemPositions(
    mockUSDC.target,
    ethers.ZeroHash, // No parent collection
    conditionId,
    indexSets
  );

  console.log("Transaction sent:", redeemTx.hash);
  const receipt = await redeemTx.wait();
  console.log("✅ Transaction confirmed!");

  // Check USDC balance after redemption
  const usdcAfter = await mockUSDC.balanceOf(deployer.address);
  const usdcGained = usdcAfter - usdcBefore;

  // Check token balances after redemption
  const yesBalanceAfter = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalanceAfter = await conditionalTokens.balanceOf(deployer.address, noTokenId);

  console.log("\n🎉 Redemption Complete!");
  console.log("─".repeat(60));
  console.log(`USDC Before:  ${ethers.formatUnits(usdcBefore, 6)} USDC`);
  console.log(`USDC After:   ${ethers.formatUnits(usdcAfter, 6)} USDC`);
  console.log(`USDC Gained:  ${ethers.formatUnits(usdcGained, 6)} USDC`);
  console.log("─".repeat(60));
  console.log(`YES Tokens Remaining: ${ethers.formatUnits(yesBalanceAfter, 6)}`);
  console.log(`NO Tokens Remaining:  ${ethers.formatUnits(noBalanceAfter, 6)}`);
  console.log("─".repeat(60));

  if (usdcGained > 0n) {
    console.log("\n🎊 Congratulations! You won!");
    console.log(`You received ${ethers.formatUnits(usdcGained, 6)} USDC`);
  } else {
    console.log("\n😔 You didn't win this time");
    console.log("Better luck on the next market!");
  }

  console.log("\n✅ Done! Your winnings have been paid out");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
