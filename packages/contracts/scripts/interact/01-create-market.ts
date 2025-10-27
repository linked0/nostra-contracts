import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Create a test prediction market
 *
 * Usage:
 * npx hardhat run scripts/interact/01-create-market.ts --network bscTestnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`\n📊 Creating market on ${networkName}...`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

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

  // Market parameters
  const questionId = ethers.id("Will BNB reach $1000 by end of 2025?");
  const question = "Will BNB reach $1000 by end of 2025?";
  const description = "This market resolves to YES if BNB reaches or exceeds $1000 USD by December 31, 2025 23:59:59 UTC";
  const category = "Crypto";

  // Set times (30 days from now for end, 31 days for resolution)
  const endTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  const resolutionTime = Math.floor(Date.now() / 1000) + (31 * 24 * 60 * 60);

  console.log("\n🎯 Market Details:");
  console.log(`Question: ${question}`);
  console.log(`Category: ${category}`);
  console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`Resolution Time: ${new Date(resolutionTime * 1000).toLocaleString()}`);

  // Create the market
  console.log("\n📝 Creating market...");
  const tx = await marketFactory.createBinaryMarket(
    questionId,
    question,
    description,
    category,
    endTime,
    resolutionTime
  );

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");

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

    console.log("\n🎉 Market Created Successfully!");
    console.log("─".repeat(60));
    console.log(`Condition ID: ${conditionId}`);
    console.log(`YES Token ID: ${tokenIds[0]}`);
    console.log(`NO Token ID:  ${tokenIds[1]}`);
    console.log("─".repeat(60));

    // Save these for next scripts
    console.log("\n💾 Save these values for betting:");
    console.log(`export CONDITION_ID="${conditionId}"`);
    console.log(`export YES_TOKEN_ID="${tokenIds[0]}"`);
    console.log(`export NO_TOKEN_ID="${tokenIds[1]}"`);

    // Get market details
    const market = await marketFactory.getMarket(conditionId);
    console.log("\n📊 Market Info:");
    console.log(`Status: ${market.status === 0 ? 'Active' : 'Other'}`);
    console.log(`Creator: ${market.creator}`);
    console.log(`Outcomes: ${market.outcomeSlotCount}`);
  }

  console.log("\n✅ Done! Now you can run 02-place-bet.ts to bet on this market");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
