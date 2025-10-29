import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Get current market information and token prices for World Series MVP markets
 *
 * Usage:
 *   yarn market:prices
 *
 * Shows:
 *   - Market details for all 3 players
 *   - YES/NO token prices (implied probability)
 *   - Your token balances
 *   - Position values
 *
 * Price Calculation:
 *   - Initial phase (no trading): YES = 0.5, NO = 0.5 (50% probability each)
 *   - After trading: Prices would reflect market sentiment from order book
 *   - Note: In CTF, YES + NO always equals 1.0 (can redeem pair for 1 USDC)
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n💹 Getting World Series MVP Market Prices...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get condition IDs from environment
  const markets = [
    {
      name: "Shohei Ohtani",
      conditionId: process.env.SHOHEI_OHTANI_CONDITION_ID,
      envVar: "SHOHEI_OHTANI_CONDITION_ID",
    },
    {
      name: "Vladimir Guerrero Jr.",
      conditionId: process.env.VLADIMIR_GUERRERO_JR_CONDITION_ID,
      envVar: "VLADIMIR_GUERRERO_JR_CONDITION_ID",
    },
    {
      name: "Yoshinobu Yamamoto",
      conditionId: process.env.YOSHINOBU_YAMAMOTO_CONDITION_ID,
      envVar: "YOSHINOBU_YAMAMOTO_CONDITION_ID",
    },
  ];

  // Validate environment variables
  const missingVars = markets
    .filter((m) => !m.conditionId)
    .map((m) => m.envVar);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingVars.join(", ")}\n` +
        `Please add these to your .env file.`
    );
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`\nUsing account: ${deployer.address}`);

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  console.log(`\n📋 Using deployed contracts:`);
  console.log(`ConditionalTokens: ${deployment.contracts.ConditionalTokens}`);
  console.log(`MarketFactory: ${deployment.contracts.MarketFactory}`);
  console.log(`CTFExchange: ${deployment.contracts.CTFExchange}`);

  // Get contracts
  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  const ctfExchange = await ethers.getContractAt(
    "CTFExchange",
    deployment.contracts.CTFExchange
  );

  // Helper function to get last traded price from OrderFilled events
  async function getLastTradedPrice(yesTokenId: bigint, noTokenId: bigint): Promise<{ yesPrice: number; noPrice: number }> {
    try {
      // Query OrderFilled events for this token
      // Query last 1000 blocks to catch recent trades
      // BSC public RPC: If you get rate limit errors, reduce to 500 or 100 blocks
      const currentBlock = await ethers.provider.getBlockNumber();
      const fromBlock = currentBlock - 1000; // Last 1000 blocks (~50 minutes on BSC)

      console.log(`\n🔍 Querying events from block ${fromBlock} to ${currentBlock}`);

      const filter = ctfExchange.filters.OrderFilled();
      const events = await ctfExchange.queryFilter(filter, fromBlock, currentBlock);

      console.log(`🔍 Found ${events.length} OrderFilled events`);

      if (events.length === 0) {
        // No trades yet, return initial 50/50 prices
        console.log(`No trades found for this market yet`);
        return { yesPrice: 0.5, noPrice: 0.5 };
      }

      // Find the most recent trade for either YES or NO token
      let lastYesPrice = 0.5;
      let lastNoPrice = 0.5;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        const makerAssetId = (event.args as any).makerAssetId;
        const takerAssetId = (event.args as any).takerAssetId;
        const makingAmount = (event.args as any).makingAmount;
        const takingAmount = (event.args as any).takingAmount;

        // Check if this trade involves our YES token
        if (makerAssetId === yesTokenId || takerAssetId === yesTokenId) {
          // Calculate price: USDC per YES token
          // If YES is maker asset: price = takingAmount / makingAmount
          // If YES is taker asset: price = makingAmount / takingAmount
          if (makerAssetId === yesTokenId) {
            const yesAmount = parseFloat(ethers.formatUnits(makingAmount, 6));
            const usdcAmount = parseFloat(ethers.formatUnits(takingAmount, 6));
            lastYesPrice = usdcAmount / yesAmount;
          } else {
            const yesAmount = parseFloat(ethers.formatUnits(takingAmount, 6));
            const usdcAmount = parseFloat(ethers.formatUnits(makingAmount, 6));
            lastYesPrice = usdcAmount / yesAmount;
          }
          lastNoPrice = 1.0 - lastYesPrice; // NO price is complement
          break;
        }

        // Check if this trade involves our NO token
        if (makerAssetId === noTokenId || takerAssetId === noTokenId) {
          // Calculate price: USDC per NO token
          if (makerAssetId === noTokenId) {
            const noAmount = parseFloat(ethers.formatUnits(makingAmount, 6));
            const usdcAmount = parseFloat(ethers.formatUnits(takingAmount, 6));
            lastNoPrice = usdcAmount / noAmount;
          } else {
            const noAmount = parseFloat(ethers.formatUnits(takingAmount, 6));
            const usdcAmount = parseFloat(ethers.formatUnits(makingAmount, 6));
            lastNoPrice = usdcAmount / noAmount;
          }
          lastYesPrice = 1.0 - lastNoPrice; // YES price is complement
          break;
        }
      }

      return { yesPrice: lastYesPrice, noPrice: lastNoPrice };
    } catch (error: any) {
      console.log(`\n⚠️  Could not fetch trade history: ${error.message}`);
      console.log(`Using default 50/50 prices`);
      return { yesPrice: 0.5, noPrice: 0.5 };
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`WORLD SERIES MVP MARKETS`);
  console.log(`${"=".repeat(80)}`);

  // Process each market
  for (const market of markets) {
    const conditionId = market.conditionId!;

    // Get market info
    const marketInfo = await marketFactory.getMarket(conditionId);

    // Calculate YES token (outcome 0, indexSet = 1)
    const yesCollectionId = await conditionalTokens.getCollectionId(
      ethers.ZeroHash,
      conditionId,
      1 // indexSet for YES (outcome 0)
    );

    const yesPositionId = await conditionalTokens.getPositionId(
      deployment.contracts.MockUSDC,
      yesCollectionId
    );

    // Calculate NO token (outcome 1, indexSet = 2)
    const noCollectionId = await conditionalTokens.getCollectionId(
      ethers.ZeroHash,
      conditionId,
      2 // indexSet for NO (outcome 1)
    );

    const noPositionId = await conditionalTokens.getPositionId(
      deployment.contracts.MockUSDC,
      noCollectionId
    );

    // Get your balances
    const yesBalance = await conditionalTokens.balanceOf(
      deployer.address,
      yesPositionId
    );

    const noBalance = await conditionalTokens.balanceOf(
      deployer.address,
      noPositionId
    );

    // Calculate prices from last traded price (OrderFilled events)
    // If no trades yet: 0.5 each (50% probability initial phase)
    // After trading: Shows last executed trade price
    const prices = await getLastTradedPrice(yesPositionId, noPositionId);
    const yesPrice = prices.yesPrice;
    const noPrice = prices.noPrice;

    // Calculate position values
    const yesBalanceNum = parseFloat(ethers.formatUnits(yesBalance, 6));
    const noBalanceNum = parseFloat(ethers.formatUnits(noBalance, 6));
    const yesValue = yesBalanceNum * yesPrice;
    const noValue = noBalanceNum * noPrice;
    const totalValue = yesValue + noValue;

    // Display market information
    console.log(`\n┌─ ${market.name.toUpperCase()}`);
    console.log(`│`);
    console.log(`│ 📝 Question: ${marketInfo.question}`);
    console.log(
      `│ 📊 Status: ${
        marketInfo.status === 0
          ? "Active"
          : marketInfo.status === 1
          ? "Resolved"
          : "Cancelled"
      }`
    );
    console.log(
      `│ ⏰ End Time: ${new Date(
        Number(marketInfo.endTime) * 1000
      ).toLocaleString()}`
    );
    console.log(`│`);
    console.log(`│ 💹 Current Prices (Implied Probability):`);
    console.log(`│   YES: $${yesPrice.toFixed(2)} (${(yesPrice * 100).toFixed(0)}%)`);
    console.log(`│   NO:  $${noPrice.toFixed(2)} (${(noPrice * 100).toFixed(0)}%)`);
    console.log(`│`);
    console.log(`│ 💼 Your Holdings:`);
    console.log(
      `│   YES: ${yesBalanceNum.toFixed(2)} tokens × $${yesPrice.toFixed(2)} = $${yesValue.toFixed(2)}`
    );
    console.log(
      `│   NO:  ${noBalanceNum.toFixed(2)} tokens × $${noPrice.toFixed(2)} = $${noValue.toFixed(2)}`
    );
    console.log(`│`);

    // Show total position value
    if (yesBalance > 0n || noBalance > 0n) {
      console.log(`│ 💰 Total Position Value: $${totalValue.toFixed(2)}`);

      // Show P&L if user has both YES and NO (from splitting)
      if (yesBalance > 0n && noBalance > 0n) {
        const splitCost = Math.min(yesBalanceNum, noBalanceNum);
        console.log(`│ 📊 Cost Basis (from splitting): $${splitCost.toFixed(2)}`);
        console.log(`│ 💵 Current P&L: $${(totalValue - splitCost).toFixed(2)}`);
      }
      console.log(`│`);
    }

    console.log(`│ 🎫 Token IDs:`);
    console.log(`│   YES: ${yesPositionId}`);
    console.log(`│   NO:  ${noPositionId}`);
    console.log(`└${"─".repeat(78)}`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`\n💡 Understanding Prices:`);
  console.log(`   `);
  console.log(`   📊 Current Prices: YES = $0.50, NO = $0.50 (50% probability each)`);
  console.log(`   `);
  console.log(`   This is the INITIAL PHASE pricing before any trading activity.`);
  console.log(`   In CTF markets, YES + NO always equals $1.00 (can redeem for 1 USDC).`);
  console.log(`   `);
  console.log(`   After trading begins on CTFExchange:`);
  console.log(`   • Prices will shift based on market sentiment`);
  console.log(`   • Example: If traders favor Ohtani → YES rises to $0.65, NO falls to $0.35`);
  console.log(`   • Prices always sum to $1.00 (arbitrage opportunity otherwise)`);
  console.log(`   `);
  console.log(`   To get real-time market prices after trading starts:`);
  console.log(`   1. Query the order book (CTFExchange events)`);
  console.log(`   2. Use an indexer/subgraph (recommended for production)`);
  console.log(`   3. Track last trade prices from fillOrder events`);
  console.log(`   `);
  console.log(`   💰 Your Position Value = Holdings × Current Price`);
  console.log(`   📈 Profit if your outcome wins: Redeem tokens for full $1.00 each`);

  console.log(`\n✅ Market information retrieved successfully!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
