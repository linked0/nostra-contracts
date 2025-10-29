import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Place a bet on World Series MVP binary market (Polymarket-style)
 *
 * Usage:
 * export CONDITION_ID="0x..."
 * export BET_SIDE="YES"  # YES or NO
 * export BET_AMOUNT="100"   # Amount in USDC (with 6 decimals)
 * yarn market:bet
 *
 * Example: Bet YES on Ohtani winning MVP
 * export CONDITION_ID="0xabc..."  # From Ohtani market
 * export BET_SIDE="YES"
 * export BET_AMOUNT="100"
 * yarn market:bet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n💰 Placing bet on World Series MVP Binary Market...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get parameters from environment
  const conditionId = process.env.CONDITION_ID;
  const betSide = (process.env.BET_SIDE || "YES").toUpperCase();
  const betAmount = process.env.BET_AMOUNT || "100";

  if (!conditionId) {
    throw new Error("CONDITION_ID environment variable is required");
  }

  if (betSide !== "YES" && betSide !== "NO") {
    throw new Error("BET_SIDE must be 'YES' or 'NO'");
  }

  // YES = outcome 0, NO = outcome 1 in binary markets
  const outcomeIndex = betSide === "YES" ? 0 : 1;

  console.log(`\n📊 Bet Details:`);
  console.log(`Condition ID: ${conditionId}`);
  console.log(`Betting: ${betSide}`);
  console.log(`Amount: ${betAmount} USDC`);

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

  // Get market info
  const market = await marketFactory.getMarket(conditionId);
  console.log(`\n📝 Market Info:`);
  console.log(`Question: ${market.question}`);
  console.log(`Status: ${market.status === 0 ? 'Active' : market.status === 1 ? 'Resolved' : 'Other'}`);

  // Check USDC balance
  const usdcBalance = await mockUSDC.balanceOf(deployer.address);
  console.log(`\nUSDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  const betAmountWei = ethers.parseUnits(betAmount, 6);

  if (usdcBalance < betAmountWei) {
    console.log(`\n⚠️  Insufficient USDC balance. Minting ${betAmount} USDC...`);
    const mintTx = await mockUSDC.mint(deployer.address, betAmountWei);
    await mintTx.wait();
    console.log(`✅ Minted ${betAmount} USDC`);
  }

  // Approve ConditionalTokens to spend USDC
  console.log(`\n📝 Approving ConditionalTokens to spend USDC...`);
  const approveTx = await mockUSDC.approve(
    deployment.contracts.ConditionalTokens,
    betAmountWei
  );
  await approveTx.wait();
  console.log(`✅ Approval confirmed`);

  // Split position to get both YES and NO tokens
  // In practice, users would then sell the unwanted side on an exchange
  // For this demo, we'll split into both and show the balances
  console.log(`\n🎲 Splitting position into ${betSide} and ${betSide === "YES" ? "NO" : "YES"} tokens...`);
  console.log(`Note: You receive BOTH tokens when splitting. In production, you'd sell the unwanted side.`);

  // Partition [1, 2] = both outcomes (YES and NO)
  const partition = [1, 2];

  const splitTx = await conditionalTokens.splitPosition(
    deployment.contracts.MockUSDC,
    ethers.ZeroHash,
    conditionId,
    partition,
    betAmountWei
  );

  console.log(`Transaction sent: ${splitTx.hash}`);
  console.log(`⏳ Waiting for confirmation...`);

  const receipt = await splitTx.wait();
  console.log(`✅ Transaction confirmed!`);
  console.log(`Gas used: ${receipt?.gasUsed.toString()}`);

  // Get YES token balance (outcome 0)
  const yesCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    1 // indexSet for YES (outcome 0)
  );

  const yesPositionId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    yesCollectionId
  );

  const yesBalance = await conditionalTokens.balanceOf(
    deployer.address,
    yesPositionId
  );

  // Get NO token balance (outcome 1)
  const noCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    2 // indexSet for NO (outcome 1)
  );

  const noPositionId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    noCollectionId
  );

  const noBalance = await conditionalTokens.balanceOf(
    deployer.address,
    noPositionId
  );

  console.log(`\n🎉 Bet Placed Successfully!`);
  console.log(`═`.repeat(70));
  console.log(`Your Token Holdings:`);
  console.log(`  YES tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`    Position ID: ${yesPositionId}`);
  console.log(`  NO tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log(`    Position ID: ${noPositionId}`);
  console.log(`═`.repeat(70));

  console.log(`\n✅ Done! You now hold ${betAmount} ${betSide} tokens + ${betAmount} ${betSide === "YES" ? "NO" : "YES"} tokens.`);
  console.log(`\n💡 Polymarket-Style Trading Flow:`);
  console.log(`1. You wanted: ${betSide} exposure`);
  console.log(`2. You received: ${betAmount} YES + ${betAmount} NO tokens`);
  console.log(`3. Next step (on exchange): Sell ${betAmount} ${betSide === "YES" ? "NO" : "YES"} tokens`);
  console.log(`4. Result: You keep ${betAmount} ${betSide} tokens (your bet!)`);

  console.log(`\n🔄 Next Steps:`);
  console.log(`1. (Optional) Trade unwanted ${betSide === "YES" ? "NO" : "YES"} tokens on exchange`);
  console.log(`2. Wait for the World Series to end`);
  console.log(`3. Run 03-resolve-market.ts to resolve all markets`);
  console.log(`4. Run 04-redeem-tokens.ts to claim USDC from winning tokens`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
