import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Resolve World Series MVP binary markets (Polymarket-style grouped resolution)
 * Resolves all 3 markets:
 * - Winner's market → YES (outcome 0)
 * - Losers' markets → NO (outcome 1)
 *
 * Usage:
 * export WINNER="OHTANI"  # OHTANI, GUERRERO, or YAMAMOTO
 * export OHTANI_CONDITION_ID="0x..."
 * export GUERRERO_CONDITION_ID="0x..."
 * export YAMAMOTO_CONDITION_ID="0x..."
 * yarn market:resolve
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n⚖️  Resolving World Series MVP Binary Markets (Polymarket-Style)...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get parameters from environment
  const winner = (process.env.WINNER || "").toUpperCase();
  const ohtaniConditionId = process.env.OHTANI_CONDITION_ID;
  const guerreroConditionId = process.env.GUERRERO_CONDITION_ID;
  const yamamotoConditionId = process.env.YAMAMOTO_CONDITION_ID;

  if (!winner || !["OHTANI", "GUERRERO", "YAMAMOTO"].includes(winner)) {
    throw new Error("WINNER environment variable must be 'OHTANI', 'GUERRERO', or 'YAMAMOTO'");
  }

  if (!ohtaniConditionId || !guerreroConditionId || !yamamotoConditionId) {
    throw new Error("All three CONDITION_ID variables are required");
  }

  const markets = [
    { name: "OHTANI", fullName: "Shohei Ohtani", conditionId: ohtaniConditionId, isWinner: winner === "OHTANI" },
    { name: "GUERRERO", fullName: "Vladimir Guerrero Jr.", conditionId: guerreroConditionId, isWinner: winner === "GUERRERO" },
    { name: "YAMAMOTO", fullName: "Yoshinobu Yamamoto", conditionId: yamamotoConditionId, isWinner: winner === "YAMAMOTO" }
  ];

  console.log(`\n📊 Resolution Plan:`);
  console.log(`Winner: ${winner}`);
  markets.forEach(market => {
    const outcome = market.isWinner ? "YES (outcome 0)" : "NO (outcome 1)";
    const symbol = market.isWinner ? "✅" : "❌";
    console.log(`  ${symbol} ${market.fullName.padEnd(25)} → ${outcome}`);
  });

  // Get deployer account (must be resolver)
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
  console.log(`MarketFactory: ${deployment.contracts.MarketFactory}`);
  console.log(`ResolutionOracle: ${deployment.contracts.ResolutionOracle}`);

  // Get contracts
  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  const resolutionOracle = await ethers.getContractAt(
    "ResolutionOracle",
    deployment.contracts.ResolutionOracle
  );

  // Confirm before resolving
  console.log(`\n⚠️  This will resolve ALL 3 markets. Winner gets YES, losers get NO.`);
  console.log(`Press Ctrl+C within 5 seconds to cancel...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Resolve each market
  for (const market of markets) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`Resolving: ${market.fullName}`);
    console.log(`${"═".repeat(80)}`);

    // Get market details
    const marketInfo = await marketFactory.getMarket(market.conditionId);
    console.log(`Question: ${marketInfo.question}`);
    console.log(`Status: ${marketInfo.status === 0 ? 'Active' : marketInfo.status === 1 ? 'Resolved' : 'Other'}`);

    // Check if already resolved
    if (marketInfo.status === 1) {
      console.log(`⚠️  Already resolved! Skipping...`);
      continue;
    }

    // Check resolution time
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < marketInfo.resolutionTime) {
      console.log(`⚠️  Cannot resolve yet. Resolution time: ${new Date(marketInfo.resolutionTime * 1000).toISOString()}`);
      continue;
    }

    // Outcome: 0=YES if winner, 1=NO if loser
    const outcome = market.isWinner ? 0 : 1;
    const outcomeLabel = outcome === 0 ? "YES" : "NO";

    console.log(`\n📝 Proposing resolution: ${outcomeLabel}...`);
    const proposeTx = await resolutionOracle.proposeResolution(
      market.conditionId,
      outcome
    );

    console.log(`Transaction sent: ${proposeTx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await proposeTx.wait();
    console.log(`✅ Proposal confirmed! Gas used: ${receipt?.gasUsed.toString()}`);

    // Get resolution details
    const resolution = await resolutionOracle.getResolution(market.conditionId);
    console.log(`\nResolution Status: Proposed`);
    console.log(`Winning Outcome: ${Number(resolution.winningOutcome)} (${outcomeLabel})`);
    console.log(`Dispute Period Ends: ${new Date(Number(resolution.disputePeriodEnd) * 1000).toISOString()}`);

    // If dispute period has already ended, finalize immediately
    if (currentTime >= Number(resolution.disputePeriodEnd)) {
      console.log(`\n✅ Dispute period ended! Finalizing...`);

      const resolveTx = await marketFactory.resolveMarket(market.conditionId);
      console.log(`Transaction sent: ${resolveTx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const resolveReceipt = await resolveTx.wait();
      console.log(`✅ Market resolved! Gas used: ${resolveReceipt?.gasUsed.toString()}`);
    } else {
      const disputeTimeLeft = Number(resolution.disputePeriodEnd) - currentTime;
      console.log(`⏰ Dispute period active. ${Math.floor(disputeTimeLeft / 3600)} hours remaining.`);
    }
  }

  // Summary
  console.log(`\n${"═".repeat(80)}`);
  console.log(`🎉 All Markets Resolution Proposed!`);
  console.log(`${"═".repeat(80)}`);
  console.log(`\nResolution Summary:`);
  markets.forEach(market => {
    const symbol = market.isWinner ? "🏆" : "❌";
    const outcome = market.isWinner ? "YES" : "NO";
    console.log(`  ${symbol} ${market.fullName.padEnd(25)} → ${outcome}`);
  });

  console.log(`\n✅ Done!`);
  console.log(`\n💡 Polymarket-Style Resolution:`);
  console.log(`Winner market: YES tokens are worth 1 USDC, NO tokens are worthless`);
  console.log(`Loser markets: NO tokens are worth 1 USDC, YES tokens are worthless`);

  console.log(`\n🔄 Next Steps:`);
  console.log(`1. Wait for dispute periods to end (if not finalized)`);
  console.log(`2. Run 04-redeem-tokens.ts to claim USDC:`);
  console.log(`   - Winner market: Redeem YES tokens`);
  console.log(`   - Loser markets: Redeem NO tokens`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
