import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Place bets on Yoshinobu Yamamoto winning World Series MVP
 *
 * Usage:
 * 1. Add to .env:
 *    YOSHINOBU_YAMAMOTO_CONDITION_ID="0x..."
 *    YOSHINOBU_YAMAMOTO_YES_BET="0"   # Amount for YES (0 to skip)
 *    YOSHINOBU_YAMAMOTO_NO_BET="25"   # Amount for NO (0 to skip)
 *
 * 2. Run:
 *    yarn market:bet:yamamoto
 *
 * Examples:
 *    # Bet 100 USDC on YES
 *    YOSHINOBU_YAMAMOTO_YES_BET=100 YOSHINOBU_YAMAMOTO_NO_BET=0
 *
 *    # Bet 25 USDC on NO (hedge)
 *    YOSHINOBU_YAMAMOTO_YES_BET=0 YOSHINOBU_YAMAMOTO_NO_BET=25
 *
 *    # Bet on both sides
 *    YOSHINOBU_YAMAMOTO_YES_BET=100 YOSHINOBU_YAMAMOTO_NO_BET=25
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n💰 Placing bets on Yoshinobu Yamamoto MVP Market...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get parameters from environment
  const conditionId = process.env.YOSHINOBU_YAMAMOTO_CONDITION_ID;
  const yesBetAmount = parseInt(process.env.YOSHINOBU_YAMAMOTO_YES_BET || "0");
  const noBetAmount = parseInt(process.env.YOSHINOBU_YAMAMOTO_NO_BET || "0");

  if (!conditionId) {
    throw new Error("YOSHINOBU_YAMAMOTO_CONDITION_ID environment variable is required");
  }

  if (yesBetAmount === 0 && noBetAmount === 0) {
    console.log(`\n⚠️  No bets configured. Set YOSHINOBU_YAMAMOTO_YES_BET and/or YOSHINOBU_YAMAMOTO_NO_BET in .env`);
    return;
  }

  console.log(`\n📊 Bet Configuration:`);
  console.log(`Player: Yoshinobu Yamamoto`);
  console.log(`Condition ID: ${conditionId}`);
  console.log(`YES bet: ${yesBetAmount} USDC ${yesBetAmount > 0 ? "✅" : "⊘"}`);
  console.log(`NO bet:  ${noBetAmount} USDC ${noBetAmount > 0 ? "✅" : "⊘"}`);
  console.log(`Total:   ${yesBetAmount + noBetAmount} USDC`);

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
  console.log(
    `Status: ${market.status === 0 ? "Active" : market.status === 1 ? "Resolved" : "Other"}`
  );

  // Calculate YES token positions
  const yesCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    1 // indexSet for YES (outcome 0)
  );
  const yesPositionId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    yesCollectionId
  );

  // Calculate NO token positions
  const noCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    2 // indexSet for NO (outcome 1)
  );
  const noPositionId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    noCollectionId
  );

  // Place YES bet
  if (yesBetAmount > 0) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`💚 PLACING YES BET: ${yesBetAmount} USDC`);
    console.log(`${"═".repeat(70)}`);

    const yesBetWei = ethers.parseUnits(yesBetAmount.toString(), 6);

    // Check USDC balance
    const usdcBalance = await mockUSDC.balanceOf(deployer.address);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

    if (usdcBalance < yesBetWei) {
      console.log(`\n⚠️  Insufficient USDC. Minting ${yesBetAmount} USDC...`);
      const mintTx = await mockUSDC.mint(deployer.address, yesBetWei);
      await mintTx.wait();
      console.log(`✅ Minted ${yesBetAmount} USDC`);
    }

    // Approve
    console.log(`\n📝 Approving ConditionalTokens...`);
    const approveTx = await mockUSDC.approve(
      deployment.contracts.ConditionalTokens,
      yesBetWei
    );
    await approveTx.wait();
    console.log(`✅ Approval confirmed`);

    // Split position
    console.log(`\n🎲 Splitting position...`);
    const partition = [1, 2]; // indexSet: 1=YES, 2=NO (creates separate positions)

    const splitTx = await conditionalTokens.splitPosition(
      deployment.contracts.MockUSDC,
      ethers.ZeroHash,
      conditionId,
      partition,
      yesBetWei
    );

    console.log(`Transaction: ${splitTx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await splitTx.wait();
    console.log(`✅ Transaction confirmed! Gas: ${receipt?.gasUsed.toString()}`);
  }

  // Place NO bet
  if (noBetAmount > 0) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`🔴 PLACING NO BET: ${noBetAmount} USDC`);
    console.log(`${"═".repeat(70)}`);

    const noBetWei = ethers.parseUnits(noBetAmount.toString(), 6);

    // Check USDC balance
    const usdcBalance = await mockUSDC.balanceOf(deployer.address);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

    if (usdcBalance < noBetWei) {
      console.log(`\n⚠️  Insufficient USDC. Minting ${noBetAmount} USDC...`);
      const mintTx = await mockUSDC.mint(deployer.address, noBetWei);
      await mintTx.wait();
      console.log(`✅ Minted ${noBetAmount} USDC`);
    }

    // Approve
    console.log(`\n📝 Approving ConditionalTokens...`);
    const approveTx = await mockUSDC.approve(
      deployment.contracts.ConditionalTokens,
      noBetWei
    );
    await approveTx.wait();
    console.log(`✅ Approval confirmed`);

    // Split position
    console.log(`\n🎲 Splitting position...`);
    const partition = [1, 2]; // indexSet: 1=YES, 2=NO (creates separate positions)

    const splitTx = await conditionalTokens.splitPosition(
      deployment.contracts.MockUSDC,
      ethers.ZeroHash,
      conditionId,
      partition,
      noBetWei
    );

    console.log(`Transaction: ${splitTx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await splitTx.wait();
    console.log(`✅ Transaction confirmed! Gas: ${receipt?.gasUsed.toString()}`);
  }

  // Get final balances
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesPositionId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noPositionId);

  console.log(`\n${"═".repeat(70)}`);
  console.log(`🎉 BETTING COMPLETE - Yoshinobu Yamamoto`);
  console.log(`${"═".repeat(70)}`);
  console.log(`\n💼 Your Final Token Holdings:`);
  console.log(`  YES tokens: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`  NO tokens:  ${ethers.formatUnits(noBalance, 6)}`);
  console.log(`\n💰 Position Breakdown:`);
  console.log(`  Total spent: ${yesBetAmount + noBetAmount} USDC`);
  console.log(`  YES position: ${yesBetAmount} USDC (from splitting)`);
  console.log(`  NO position:  ${noBetAmount} USDC (from splitting)`);
  console.log(`  Net holdings: YES=${ethers.formatUnits(yesBalance, 6)} + NO=${ethers.formatUnits(noBalance, 6)}`);

  console.log(`\n💡 Trading Strategy:`);
  if (yesBetAmount > 0 && noBetAmount === 0) {
    console.log(`  You bet on YES (Yamamoto wins)`);
    console.log(`  You received ${yesBetAmount} YES + ${yesBetAmount} NO tokens from splitting`);
    console.log(`  → Sell ${yesBetAmount} NO tokens on exchange to keep pure YES position`);
  } else if (noBetAmount > 0 && yesBetAmount === 0) {
    console.log(`  You bet on NO (Yamamoto doesn't win)`);
    console.log(`  You received ${noBetAmount} YES + ${noBetAmount} NO tokens from splitting`);
    console.log(`  → Sell ${noBetAmount} YES tokens on exchange to keep pure NO position`);
  } else {
    console.log(`  You bet on BOTH sides`);
    console.log(`  This strategy is used for:`);
    console.log(`  • Providing liquidity (earn trading fees)`);
    console.log(`  • Arbitrage opportunities`);
    console.log(`  • Hedging other positions`);
  }

  console.log(`\n🔄 Next Steps:`);
  console.log(`1. Check prices: yarn market:prices`);
  console.log(`2. (Optional) Trade on exchange to adjust position`);
  console.log(`3. Wait for World Series to end`);
  console.log(`4. Resolve market: yarn market:resolve`);
  console.log(`5. Redeem winnings: yarn market:redeem`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
