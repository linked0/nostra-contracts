import { ethers, network as hreNetwork } from "hardhat";
import { readNetworkDeployment } from "../../utils/deployment-manager";

/**
 * Simulate trading activity to create price fluctuations
 *
 * This script creates fake orders and executes trades at different prices
 * to simulate market activity and watch price movement.
 *
 * Current simulation: Bullish trend on Ohtani
 * - Trade 1: $0.52 (initial buying interest)
 * - Trade 2: $0.55 (growing confidence)
 * - Trade 3: $0.58 (strong momentum)
 *
 * Usage:
 *   yarn market:simulate-trading
 *
 * Requirements:
 *   - Must have operator role on CTFExchange
 *   - Markets must exist and have split positions (tokens available)
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = hreNetwork.name;

  console.log(`\n📈 Simulating Trading Activity...`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();

  // Get trader account from TRADER_PRIVATE_KEY in .env
  let trader;
  if (process.env.TRADER_PRIVATE_KEY) {
    trader = new ethers.Wallet(process.env.TRADER_PRIVATE_KEY, ethers.provider);
    console.log(`\n✅ Using separate accounts for realistic trading:`);
    console.log(`Deployer (maker): ${deployer.address}`);
    console.log(`Trader (taker): ${trader.address}`);

    // Check trader has gas
    const traderBalance = await ethers.provider.getBalance(trader.address);
    console.log(`Trader BNB balance: ${ethers.formatEther(traderBalance)} BNB`);

    if (traderBalance === 0n) {
      console.log(`\n⚠️  WARNING: Trader has no BNB for gas!`);
      console.log(`Send some testnet BNB to: ${trader.address}`);
      console.log(`Get from: https://testnet.bnbchain.org/faucet-smart`);
      throw new Error("Trader needs BNB for gas");
    }
  } else {
    console.log(`\n⚠️  TRADER_PRIVATE_KEY not found in .env`);
    console.log(`Will attempt self-trading (may not work)`);
    console.log(`Deployer: ${deployer.address}`);
  }

  // Read deployed contract addresses
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  // Get contracts
  const ctfExchange = await ethers.getContractAt(
    "CTFExchange",
    deployment.contracts.CTFExchange
  );

  const conditionalTokens = await ethers.getContractAt(
    "ConditionalTokens",
    deployment.contracts.ConditionalTokens
  );

  const marketFactory = await ethers.getContractAt(
    "MarketFactory",
    deployment.contracts.MarketFactory
  );

  // Get Ohtani market condition ID
  const conditionId = process.env.SHOHEI_OHTANI_CONDITION_ID;
  if (!conditionId) {
    throw new Error("SHOHEI_OHTANI_CONDITION_ID not set in .env");
  }

  // Get market info
  const market = await marketFactory.getMarket(conditionId);
  console.log(`\n📝 Market: ${market.question}`);

  // Calculate token IDs
  const yesCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    1 // indexSet for YES
  );
  const yesTokenId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    yesCollectionId
  );

  const noCollectionId = await conditionalTokens.getCollectionId(
    ethers.ZeroHash,
    conditionId,
    2 // indexSet for NO
  );
  const noTokenId = await conditionalTokens.getPositionId(
    deployment.contracts.MockUSDC,
    noCollectionId
  );

  console.log(`\n🎫 Token IDs:`);
  console.log(`YES: ${yesTokenId}`);
  console.log(`NO:  ${noTokenId}`);

  // Check balances
  const yesBalance = await conditionalTokens.balanceOf(deployer.address, yesTokenId);
  const noBalance = await conditionalTokens.balanceOf(deployer.address, noTokenId);

  console.log(`\n💼 Your Balances:`);
  console.log(`YES: ${ethers.formatUnits(yesBalance, 6)}`);
  console.log(`NO:  ${ethers.formatUnits(noBalance, 6)}`);

  if (yesBalance === 0n || noBalance === 0n) {
    console.log(`\n⚠️  You need tokens to simulate trading!`);
    console.log(`Run: yarn market:bet:ohtani first`);
    return;
  }

  // Check if deployer has operator role (using Auth mixin, not AccessControl)
  const isDeployerOperator = await ctfExchange.isOperator(deployer.address);

  if (!isDeployerOperator) {
    console.log(`\n📝 Adding deployer as operator...`);
    const addOperatorTx = await ctfExchange.addOperator(deployer.address);
    await addOperatorTx.wait();
    console.log(`✅ Deployer operator role granted`);
  } else {
    console.log(`\n✅ Deployer already has operator role`);
  }

  // If using separate trader account, trader also needs operator role to call fillOrder()
  if (trader) {
    const isTraderOperator = await ctfExchange.isOperator(trader.address);
    if (!isTraderOperator) {
      console.log(`\n📝 Adding trader as operator...`);
      const addTraderOperatorTx = await ctfExchange.addOperator(trader.address);
      await addTraderOperatorTx.wait();
      console.log(`✅ Trader operator role granted`);
    } else {
      console.log(`✅ Trader already has operator role`);
    }
  }

  // Approve CTFExchange to spend tokens
  console.log(`\n📝 Approving CTFExchange...`);
  const approveTx = await conditionalTokens.setApprovalForAll(
    deployment.contracts.CTFExchange,
    true
  );
  await approveTx.wait();
  console.log(`✅ Approval confirmed`);

  // Domain separator for EIP-712 signing
  const domain = {
    name: "Nostra CTF Exchange",
    version: "1",
    chainId: network.chainId,
    verifyingContract: deployment.contracts.CTFExchange,
  };

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" },
    ],
  };

  // Get USDC contract for buying tokens
  const mockUSDC = await ethers.getContractAt(
    "MockUSDC",
    deployment.contracts.MockUSDC
  );

  // The account that fills orders (taker) needs USDC to buy tokens
  const takerAccount = trader || deployer;
  const usdcBalance = await mockUSDC.balanceOf(takerAccount.address);
  console.log(`\n💵 ${trader ? 'Trader' : 'Deployer'} USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  // Mint USDC if needed (need ~17 USDC for 3 trades of 10 tokens at $0.52, $0.55, $0.58)
  const requiredUSDC = ethers.parseUnits("50", 6); // 50 USDC buffer
  if (usdcBalance < requiredUSDC) {
    console.log(`\n💰 Minting 50 USDC to ${trader ? 'trader' : 'deployer'} for trade execution...`);
    const mintTx = await mockUSDC.mint(takerAccount.address, requiredUSDC);
    await mintTx.wait();
    console.log(`✅ Minted 50 USDC`);
  }

  // Approve CTFExchange to spend USDC (for buying tokens)
  console.log(`\n📝 Approving CTFExchange to spend ${trader ? 'trader' : 'deployer'} USDC...`);
  const mockUSDCForApproval = mockUSDC.connect(takerAccount);
  const approveUSDCTx = await mockUSDCForApproval.approve(
    deployment.contracts.CTFExchange,
    ethers.MaxUint256
  );
  await approveUSDCTx.wait();
  console.log(`✅ USDC approval confirmed`);

  // DEPOSIT USDC INTO EXCHANGE (Required for Taker)
  console.log(`\n💰 Checking Exchange Balance for Taker...`);
  const takerExchangeBalance = await ctfExchange.balances(takerAccount.address);
  console.log(`   Exchange Balance: ${ethers.formatUnits(takerExchangeBalance, 6)} USDC`);

  if (takerExchangeBalance < requiredUSDC) {
    console.log(`   Balance low. Depositing ${ethers.formatUnits(requiredUSDC, 6)} USDC...`);
    const ctfExchangeForDeposit = ctfExchange.connect(takerAccount);
    const depositTx = await ctfExchangeForDeposit.deposit(requiredUSDC);
    await depositTx.wait();
    console.log(`   ✅ Deposited ${ethers.formatUnits(requiredUSDC, 6)} USDC`);
  }

  // Get current nonce for the account and track it locally
  let currentNonce = await ctfExchange.nonces(deployer.address);
  console.log(`\n📊 Starting nonce: ${currentNonce}`);

  // Simulate 3 trades at different prices to create price movement
  // Steady bullish trend: consistent buying pressure pushing price upward
  const trades = [
    { price: 0.52, description: "Initial buying interest (YES at $0.52)" },
    { price: 0.55, description: "Growing confidence (YES at $0.55)" },
    { price: 0.58, description: "Strong bullish momentum (YES at $0.58)" },
  ];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    console.log(`\n${"═".repeat(70)}`);
    console.log(`💹 Trade ${i + 1}/3: ${trade.description}`);
    console.log(`${"═".repeat(70)}`);

    // Create a SELL order for YES tokens at the specified price
    // Price = takerAmount / makerAmount
    // If selling 10 YES at $0.52, we want 5.20 USDC
    const tokenCount = 10;
    const makerAmount = ethers.parseUnits(tokenCount.toString(), 6); // 10 YES tokens (smaller size)

    // Calculate total USDC amount: tokenCount × price
    // Example: 10 tokens × $0.52 = $5.20
    const totalUSDC = tokenCount * trade.price;
    const takerAmount = ethers.parseUnits(totalUSDC.toFixed(2), 6);

    const order = {
      salt: BigInt(Date.now() + i), // Unique salt
      maker: deployer.address,
      signer: deployer.address,
      taker: ethers.ZeroAddress, // Public order
      tokenId: yesTokenId,
      makerAmount: makerAmount,
      takerAmount: takerAmount,
      expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      nonce: currentNonce, // Use current nonce (will increment after each successful trade)
      feeRateBps: 0n, // No fees for simulation
      side: 1, // SELL
      signatureType: 0, // EOA
    };

    // Sign the order
    console.log(`\n🔏 Signing order...`);
    const signature = await deployer.signTypedData(domain, types, order);
    const orderWithSig = { ...order, signature };

    console.log(`Order details:`);
    console.log(`  Selling: ${ethers.formatUnits(makerAmount, 6)} YES tokens`);
    console.log(`  For: ${totalUSDC.toFixed(2)} USDC`);
    console.log(`  Price: $${trade.price.toFixed(2)} per YES token`);

    // Execute the trade
    console.log(`\n⚡ Executing trade...`);
    const fillAmount = makerAmount; // Fill the entire order

    try {
      // Use trader account if available, otherwise self-trade (may not work properly)
      const exchangeForFilling = trader ? ctfExchange.connect(trader) : ctfExchange;

      if (!trader) {
        console.log(`⚠️  Warning: Self-trading (maker == taker). This may not work as expected!`);
        console.log(`   Add TRADER_PRIVATE_KEY to .env for realistic two-party trading`);
      }

      const fillTx = await exchangeForFilling.fillOrder(orderWithSig, fillAmount);
      const receipt = await fillTx.wait();

      console.log(`✅ Trade executed!`);
      console.log(`Transaction: ${fillTx.hash}`);
      console.log(`Gas used: ${receipt?.gasUsed.toString()}`);

      // Find OrderFilled event
      const orderFilledEvent = receipt?.logs.find(
        (log: any) => log.topics[0] === ethers.id("OrderFilled(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)")
      );

      if (orderFilledEvent) {
        console.log(`📊 Trade recorded onchain with price: $${trade.price.toFixed(2)}`);
      }

      // Query actual on-chain nonce after successful trade
      currentNonce = await ctfExchange.nonces(deployer.address);
      console.log(`✅ Nonce after trade: ${currentNonce}`);
    } catch (error: any) {
      console.log(`⚠️  Trade failed: ${error.message}`);
      console.log(`Note: You need operator role on CTFExchange to execute trades`);
    }

    // Wait 2 seconds between trades
    if (i < trades.length - 1) {
      console.log(`\n⏳ Waiting 2 seconds before next trade...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`🎉 TRADING SIMULATION COMPLETE`);
  console.log(`${"═".repeat(70)}`);
  console.log(`\n💡 Next steps:`);
  console.log(`1. Check prices: yarn market:prices`);
  console.log(`2. View will show last traded price from OrderFilled events`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
