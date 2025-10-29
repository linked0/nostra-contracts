import { ethers } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Verify if the simulated trades actually executed
 * Checks OrderFilled events from the last 2000 blocks
 */

async function main() {
  const networkName = "bscTestnet";

  console.log(`\n🔍 Verifying Trade Execution...`);

  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  const ctfExchange = await ethers.getContractAt(
    "CTFExchange",
    deployment.contracts.CTFExchange
  );

  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  // Get Ohtani market
  const conditionId = process.env.SHOHEI_OHTANI_CONDITION_ID;
  if (!conditionId) {
    throw new Error("SHOHEI_OHTANI_CONDITION_ID not set");
  }

  // Calculate token IDs
  const yesCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    1
  );
  const yesTokenId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    yesCollectionId
  );

  console.log(`\nOhtani YES Token ID: ${yesTokenId}`);

  // Query recent OrderFilled events
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 2000; // Last ~1.5 hours on BSC

  console.log(`\nQuerying OrderFilled events from block ${fromBlock} to ${currentBlock}...`);

  const filter = ctfExchange.filters.OrderFilled();
  const events = await ctfExchange.queryFilter(filter, fromBlock, currentBlock);

  console.log(`\n📊 Found ${events.length} total OrderFilled events`);

  // Filter for our token
  const ohtaniTrades = events.filter(event => {
    const makerAssetId = event.args.makerAssetId;
    const takerAssetId = event.args.takerAssetId;
    return makerAssetId === yesTokenId || takerAssetId === yesTokenId;
  });

  console.log(`🎯 Found ${ohtaniTrades.length} trades for Ohtani YES token\n`);

  if (ohtaniTrades.length === 0) {
    console.log(`❌ NO TRADES FOUND!`);
    console.log(`\nPossible reasons:`);
    console.log(`1. Self-trading (maker == taker) was rejected by CTFExchange`);
    console.log(`2. Trades failed silently (check transaction receipts)`);
    console.log(`3. Trades are in older blocks (increase block range)`);
    console.log(`\nCheck your transaction hashes on BSCScan:`);
    console.log(`https://testnet.bscscan.com/tx/YOUR_TX_HASH`);
    return;
  }

  // Display each trade
  ohtaniTrades.forEach((event, idx) => {
    const makerAssetId = event.args.makerAssetId;
    const takerAssetId = event.args.takerAssetId;
    const makingAmount = event.args.makingAmount;  // Correct field name
    const takingAmount = event.args.takingAmount;  // Correct field name

    // Calculate price
    let price: number;
    if (makerAssetId === yesTokenId) {
      // Selling YES tokens for USDC
      price = parseFloat(ethers.formatUnits(takingAmount, 6)) /
              parseFloat(ethers.formatUnits(makingAmount, 6));
    } else {
      // Buying YES tokens with USDC
      price = parseFloat(ethers.formatUnits(makingAmount, 6)) /
              parseFloat(ethers.formatUnits(takingAmount, 6));
    }

    console.log(`Trade ${idx + 1}:`);
    console.log(`  Block: ${event.blockNumber}`);
    console.log(`  Tx: ${event.transactionHash}`);
    console.log(`  Maker: ${event.args.maker}`);
    console.log(`  Taker: ${event.args.taker}`);
    console.log(`  Price: $${price.toFixed(4)}`);
    console.log(`  Amount: ${ethers.formatUnits(makingAmount, 6)} tokens`);
    console.log(``);
  });

  // Get last trade price
  const lastTrade = ohtaniTrades[ohtaniTrades.length - 1];
  const makerAssetId = lastTrade.args.makerAssetId;
  const takerAssetId = lastTrade.args.takerAssetId;
  const makingAmount = lastTrade.args.makingAmount;  // Correct field name
  const takingAmount = lastTrade.args.takingAmount;  // Correct field name

  let lastPrice: number;
  if (makerAssetId === yesTokenId) {
    lastPrice = parseFloat(ethers.formatUnits(takingAmount, 6)) /
                parseFloat(ethers.formatUnits(makingAmount, 6));
  } else {
    lastPrice = parseFloat(ethers.formatUnits(makingAmount, 6)) /
                parseFloat(ethers.formatUnits(takingAmount, 6));
  }

  console.log(`\n✅ CURRENT PRICE (from last trade):`);
  console.log(`YES: $${lastPrice.toFixed(4)} (${(lastPrice * 100).toFixed(2)}%)`);
  console.log(`NO:  $${(1 - lastPrice).toFixed(4)} (${((1 - lastPrice) * 100).toFixed(2)}%)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
