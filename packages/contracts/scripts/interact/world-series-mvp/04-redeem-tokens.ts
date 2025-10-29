import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Redeem winning tokens from World Series MVP binary markets (Polymarket-style)
 *
 * Usage:
 * export CONDITION_ID="0x..."
 * export REDEEM_SIDE="YES"  # YES or NO
 * yarn market:redeem
 *
 * Examples:
 * # Redeem YES tokens from Ohtani's market (if Ohtani won)
 * export CONDITION_ID="0xabc..."  # Ohtani market
 * export REDEEM_SIDE="YES"
 * yarn market:redeem
 *
 * # Redeem NO tokens from Guerrero's market (if Guerrero lost)
 * export CONDITION_ID="0xdef..."  # Guerrero market
 * export REDEEM_SIDE="NO"
 * yarn market:redeem
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n💸 Redeeming World Series MVP Binary Market Tokens...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get parameters from environment
  const conditionId = process.env.CONDITION_ID;
  const redeemSide = (process.env.REDEEM_SIDE || "YES").toUpperCase();

  if (!conditionId) {
    throw new Error("CONDITION_ID environment variable is required");
  }

  if (redeemSide !== "YES" && redeemSide !== "NO") {
    throw new Error("REDEEM_SIDE must be 'YES' or 'NO'");
  }

  // YES = outcome 0, NO = outcome 1
  const outcomeIndex = redeemSide === "YES" ? 0 : 1;
  const indexSet = redeemSide === "YES" ? 1 : 2;

  console.log(`\n📊 Redemption Details:`);
  console.log(`Condition ID: ${conditionId}`);
  console.log(`Redeeming: ${redeemSide} tokens`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`\nUsing account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BNB`);

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log(`\n📋 Using deployed contracts:`);
  console.log(`ConditionalTokens: ${deployment.contracts.ConditionalTokens}`);
  console.log(`MockUSDC: ${deployment.contracts.MockUSDC}`);
  console.log(`MarketFactory: ${deployment.contracts.MarketFactory}`);

  // Get contracts
  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  const mockUSDC = await ethers.getContractAt(
    "MockUSDC",
    deployment.contracts.MockUSDC
  );

  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  // Check market status
  const market = await marketFactory.getMarket(conditionId);
  console.log(`\n📝 Market Info:`);
  console.log(`Question: ${market.question}`);
  console.log(`Status: ${market.status === 0 ? 'Active' : market.status === 1 ? 'Resolved' : market.status === 2 ? 'Closed' : 'Canceled'}`);

  if (market.status !== 1) {
    console.log(`\n❌ Market is not resolved yet! Current status: ${market.status === 0 ? 'Active' : 'Other'}`);
    console.log(`Please run 03-resolve-market.ts first.`);
    return;
  }

  console.log(`✅ Market is resolved.`);

  // Check token balance
  const collectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    BigInt(indexSet)
  );

  const positionId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    collectionId
  );

  const tokenBalance = await conditionalTokens.balanceOf(
    deployer.address,
    positionId
  );

  console.log(`\n💰 Token Holdings:`);
  console.log(`${redeemSide} Position ID: ${positionId}`);
  console.log(`${redeemSide} Token Balance: ${ethers.formatUnits(tokenBalance, 6)} tokens`);

  if (tokenBalance === 0n) {
    console.log(`\n⚠️  You don't have any ${redeemSide} tokens to redeem!`);
    return;
  }

  // Check USDC balance before redemption
  const usdcBalanceBefore = await mockUSDC.balanceOf(deployer.address);
  console.log(`\nUSDC Balance (before): ${ethers.formatUnits(usdcBalanceBefore, 6)} USDC`);

  // Confirm before redeeming
  console.log(`\n⚠️  This will redeem ${ethers.formatUnits(tokenBalance, 6)} ${redeemSide} tokens for USDC.`);
  console.log(`Press Ctrl+C within 5 seconds to cancel...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Redeem tokens
  console.log(`\n📝 Redeeming ${redeemSide} tokens...`);

  // Create index sets for redemption
  const indexSets = [BigInt(indexSet)];

  const redeemTx = await conditionalTokens.redeemPositions(
    deployment.contracts.MockUSDC,
    ethers.ZeroHash,
    conditionId,
    indexSets
  );

  console.log(`Transaction sent: ${redeemTx.hash}`);
  console.log(`⏳ Waiting for confirmation...`);

  const receipt = await redeemTx.wait();
  console.log(`✅ Transaction confirmed!`);
  console.log(`Gas used: ${receipt?.gasUsed.toString()}`);

  // Check balances after redemption
  const tokenBalanceAfter = await conditionalTokens.balanceOf(
    deployer.address,
    positionId
  );
  const usdcBalanceAfter = await mockUSDC.balanceOf(deployer.address);

  const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;

  console.log(`\n🎉 Redemption Successful!`);
  console.log(`═`.repeat(70));
  console.log(`Tokens Redeemed: ${ethers.formatUnits(tokenBalance - tokenBalanceAfter, 6)}`);
  console.log(`USDC Received: ${ethers.formatUnits(usdcReceived, 6)} USDC`);
  console.log(`Remaining ${redeemSide} Tokens: ${ethers.formatUnits(tokenBalanceAfter, 6)}`);
  console.log(`New USDC Balance: ${ethers.formatUnits(usdcBalanceAfter, 6)} USDC`);
  console.log(`═`.repeat(70));

  console.log(`\n✅ Done! Your ${redeemSide} tokens have been converted to USDC.`);

  console.log(`\n💡 Polymarket-Style Redemption:`);
  console.log(`- If you redeemed YES from winner's market: You won your bet! 🎉`);
  console.log(`- If you redeemed NO from loser's market: Your hedge paid off!`);
  console.log(`- Winning tokens → 1 USDC each`);
  console.log(`- Losing tokens → Worthless (can't redeem)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
