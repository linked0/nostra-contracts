import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Place a bet on a prediction market
 *
 * Usage:
 * Set these environment variables first (from 01-create-market.ts output):
 * export CONDITION_ID="0x..."
 * export YES_TOKEN_ID="123..."
 * export NO_TOKEN_ID="456..."
 *
 * npx hardhat run scripts/interact/02-place-bet.ts --network bscTestnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`\n💰 Placing bet on ${networkName}...`);

  // Get condition ID from environment or use default
  const conditionId = process.env.CONDITION_ID;
  if (!conditionId) {
    console.error("❌ Please set CONDITION_ID environment variable");
    console.log("Get this from the output of 01-create-market.ts");
    process.exit(1);
  }

  const yesTokenId = process.env.YES_TOKEN_ID;
  const noTokenId = process.env.NO_TOKEN_ID;

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

  console.log("\n🎯 Betting on Market:");
  console.log(`Condition ID: ${conditionId}`);
  console.log(`YES Token ID: ${yesTokenId}`);
  console.log(`NO Token ID: ${noTokenId}`);

  // Check USDC balance
  const usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`\n💵 USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  if (usdcBalance === 0n) {
    console.log("\n❌ No USDC! Minting 1000 USDC...");
    const mintTx = await mockUSDC.mint(deployer.address, ethers.parseUnits("1000", 6));
    await mintTx.wait();
    console.log("✅ Minted 1000 USDC");
  }

  // Bet amount (100 USDC)
  const betAmount = ethers.parseUnits("100", 6);
  console.log(`\n📊 Betting ${ethers.formatUnits(betAmount, 6)} USDC on YES`);

  // Approve ConditionalTokens to spend USDC
  console.log("\n🔓 Approving USDC...");
  const approveTx = await mockUSDC.approve(
    deployment.contracts.ConditionalTokens,
    betAmount
  );
  await approveTx.wait();
  console.log("✅ Approved");

  // Split collateral to get outcome tokens
  console.log("\n🔀 Splitting collateral into outcome tokens...");
  const partition = [1, 2]; // Binary market: [YES, NO]
  const splitTx = await conditionalTokens.splitPosition(
    mockUSDC.target,
    ethers.ZeroHash, // No parent collection
    conditionId,
    partition,
    betAmount
  );
  await splitTx.wait();
  console.log("✅ Position split!");

  // Check token balances
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);

  console.log("\n🎉 Bet Placed Successfully!");
  console.log("─".repeat(60));
  console.log(`YES Tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`NO Tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log("─".repeat(60));

  console.log("\n💡 What you can do now:");
  console.log("1. Keep your tokens and wait for market resolution");
  console.log("2. Sell your YES tokens to someone who thinks NO will win");
  console.log("3. Wait for 03-resolve-market.ts to resolve the market");

  console.log("\n✅ Done! Next step: Run 03-resolve-market.ts when market ends");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
