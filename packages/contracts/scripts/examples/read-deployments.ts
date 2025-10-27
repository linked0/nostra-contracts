/**
 * Example: Reading Contract Addresses from deployments.json
 *
 * This demonstrates two ways to read deployed contract addresses:
 * 1. Using the SDK (recommended for application code)
 * 2. Using deployment-manager utilities (for deployment scripts)
 */

import { ethers } from "hardhat";
import { Network, getContractAddress, getNetworkAddresses, deployments } from "@nostra-dev/sdk";
import { readNetworkDeployment } from "../utils/deployment-manager";

async function main() {
  console.log("📖 Reading Contract Addresses from deployments.json\n");

  // ============================================================================
  // METHOD 1: Using SDK (Recommended for application code)
  // ============================================================================

  console.log("🔹 Method 1: Using @nostra-dev/sdk");
  console.log("─".repeat(80));

  // Get single contract address
  const marketFactoryAddress = getContractAddress(Network.BSC_TESTNET, 'MarketFactory');
  console.log(`MarketFactory on BSC Testnet: ${marketFactoryAddress}`);

  // Get all addresses for a network
  const bscTestnetAddresses = getNetworkAddresses(Network.BSC_TESTNET);
  console.log("\nAll BSC Testnet contracts:");
  console.log(JSON.stringify(bscTestnetAddresses, null, 2));

  // Get contract instances (ready to use!)
  const [signer] = await ethers.getSigners();

  // Option A: Import helper functions
  const { getMarketFactory, getCTFExchange } = await import("@nostra-dev/sdk");

  try {
    const marketFactory = getMarketFactory(Network.BSC_TESTNET, signer);
    console.log(`\n✅ MarketFactory instance created at: ${await marketFactory.getAddress()}`);

    const ctfExchange = getCTFExchange(Network.BSC_TESTNET, signer);
    console.log(`✅ CTFExchange instance created at: ${await ctfExchange.getAddress()}`);
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
  }

  // ============================================================================
  // METHOD 2: Using deployment-manager (for deployment scripts)
  // ============================================================================

  console.log("\n🔹 Method 2: Using deployment-manager utilities");
  console.log("─".repeat(80));

  const deployment = readNetworkDeployment('bscTestnet');
  if (deployment) {
    console.log(`Chain ID: ${deployment.chainId}`);
    console.log("\nContracts:");
    for (const [name, address] of Object.entries(deployment.contracts)) {
      console.log(`  ${name}: ${address}`);
    }
  }

  // ============================================================================
  // METHOD 3: Direct access to all deployments
  // ============================================================================

  console.log("\n🔹 Method 3: Direct access to deployments object");
  console.log("─".repeat(80));

  console.log("\nAvailable networks:");
  for (const [network, data] of Object.entries(deployments)) {
    const hasAllContracts = data.contracts.ConditionalTokens &&
                           data.contracts.MarketFactory &&
                           data.contracts.CTFExchange;
    const status = hasAllContracts ? "✅" : "⚠️";
    console.log(`${status} ${network} (Chain ID: ${data.chainId})`);
  }

  // ============================================================================
  // PRACTICAL EXAMPLE: Create a market
  // ============================================================================

  console.log("\n🔹 Practical Example: Using deployed contracts");
  console.log("─".repeat(80));

  try {
    const { getMarketFactory: getMF } = await import("@nostra-dev/sdk");
    const marketFactory = getMF(Network.BSC_TESTNET, signer);

    // Read contract state
    const owner = await marketFactory.owner();
    console.log(`\nMarketFactory owner: ${owner}`);

    const collateral = await marketFactory.collateralToken();
    console.log(`Collateral token: ${collateral}`);

    console.log("\n✅ Successfully connected to deployed contracts!");
    console.log("   You can now call any contract method!");
  } catch (error: any) {
    console.log(`\n⚠️  Could not connect: ${error.message}`);
    console.log("   Make sure contracts are deployed to BSC Testnet");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
