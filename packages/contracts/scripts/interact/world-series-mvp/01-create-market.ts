import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Create World Series MVP prediction markets (Polymarket-style grouped binary markets)
 * Creates 3 separate binary markets, one for each player:
 *   1. "Will Shohei Ohtani win MVP?" → [YES, NO]
 *   2. "Will Vladimir Guerrero Jr. win MVP?" → [YES, NO]
 *   3. "Will Yoshinobu Yamamoto win MVP?" → [YES, NO]
 *
 * Usage:
 * yarn market:create
 *
 * Or with custom resolution time:
 * RESOLUTION_TIME="2025-11-01" yarn market:create
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n⚾ Creating World Series MVP Markets (Polymarket-Style) on ${networkName}...`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BNB`);

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log("\n📋 Using deployed contracts:");
  console.log(`MarketFactory: ${deployment.contracts.MarketFactory}`);
  console.log(`ConditionalTokens: ${deployment.contracts.ConditionalTokens}`);
  console.log(`ResolutionOracle: ${deployment.contracts.ResolutionOracle}`);

  // Get MarketFactory contract
  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  // Player information
  const players = [
    { name: "Shohei Ohtani", description: "Two-way superstar, MVP candidate" },
    { name: "Vladimir Guerrero Jr.", description: "Power hitter, Toronto Blue Jays star" },
    { name: "Yoshinobu Yamamoto", description: "Elite Japanese pitcher" }
  ];

  const category = "Sports";

  // Parse resolution time from environment or use default (World Series typically ends early November)
  let resolutionDate: Date;
  if (process.env.RESOLUTION_TIME) {
    resolutionDate = new Date(process.env.RESOLUTION_TIME);
  } else {
    // Default: November 1, 2025
    resolutionDate = new Date('2025-11-01T23:59:59Z');
  }

  const resolutionTime = Math.floor(resolutionDate.getTime() / 1000);

  // End time: 1 day before resolution
  const endTime = resolutionTime - (24 * 60 * 60);

  // Generate unique market group identifier
  const marketGroupId = Date.now();

  console.log("\n🎯 Market Group Details:");
  console.log(`Market Group ID: ${marketGroupId}`);
  console.log(`Category: ${category}`);
  console.log(`Players: ${players.map(p => p.name).join(' | ')}`);
  console.log(`Markets to Create: ${players.length} binary markets`);
  console.log(`End Time: ${new Date(endTime * 1000).toISOString()}`);
  console.log(`Resolution Time: ${new Date(resolutionTime * 1000).toISOString()}`);

  // Confirm before creating
  console.log("\n⚠️  This will create 3 markets on-chain. Gas fees will be required.");
  console.log("Press Ctrl+C within 5 seconds to cancel...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Create binary markets for each player
  const markets = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const question = `Will ${player.name} win the World Series MVP award?`;
    const questionId = ethers.id(`${question}-${i}-${marketGroupId}`); // Add timestamp for uniqueness
    const description = `${player.description}. This binary market predicts whether ${player.name} will win the World Series MVP award.`;

    console.log(`\n📝 Creating binary market ${i + 1}/3: ${player.name}...`);

    const tx = await marketFactory.createBinaryMarket(
      questionId,
      question,
      description,
      category,
      endTime,
      resolutionTime
    );

    console.log(`Transaction sent: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log(`✅ Market ${i + 1} confirmed! Gas used: ${receipt.gasUsed.toString()}`);

    // Parse event to get condition ID and token IDs
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = marketFactory.interface.parseLog(log);
        return parsed?.name === "MarketCreated";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = marketFactory.interface.parseLog(event);
      const conditionId = parsed?.args.conditionId;
      const tokenIds = parsed?.args.tokenIds;

      markets.push({
        player: player.name,
        question,
        conditionId,
        yesTokenId: tokenIds[0],
        noTokenId: tokenIds[1]
      });
    }
  }

  // Display summary
  console.log("\n🎉 All World Series MVP Markets Created Successfully!");
  console.log("═".repeat(80));

  markets.forEach((market, index) => {
    console.log(`\n[${index + 1}] ${market.player}`);
    console.log(`    Question: ${market.question}`);
    console.log(`    Condition ID: ${market.conditionId}`);
    console.log(`    YES Token ID: ${market.yesTokenId}`);
    console.log(`    NO Token ID:  ${market.noTokenId}`);
  });

  console.log("\n═".repeat(80));

  // Save these for other scripts
  console.log("\n💾 Save these values for betting and resolution:");
  markets.forEach((market, index) => {
    console.log(`\n# ${market.player}`);
    console.log(`export ${market.player.toUpperCase().replace(/\s+/g, '_').replace(/\./g, '')}_CONDITION_ID="${market.conditionId}"`);
    console.log(`export ${market.player.toUpperCase().replace(/\s+/g, '_').replace(/\./g, '')}_YES_TOKEN="${market.yesTokenId}"`);
    console.log(`export ${market.player.toUpperCase().replace(/\s+/g, '_').replace(/\./g, '')}_NO_TOKEN="${market.noTokenId}"`);
  });

  console.log("\n✅ Done! Markets are ready for trading.");
  console.log("\n💡 Next Steps:");
  console.log("1. Users can bet YES or NO on each player's market");
  console.log("2. Example: Buy OHTANI YES if you think he'll win");
  console.log("3. Example: Buy GUERRERO NO if you think he won't win");
  console.log("4. When World Series ends, resolve all 3 markets");
  console.log("5. Winner market resolves to YES, losers resolve to NO");

  console.log("\n📊 Polymarket-Style Benefits:");
  console.log("✅ Each player has independent YES/NO tokens");
  console.log("✅ Can directly hedge: buy YES, sell to NO later");
  console.log("✅ Probabilities can be traded independently");
  console.log("⚠️  Note: Probabilities may sum to >100% (arbitrage opportunity)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
