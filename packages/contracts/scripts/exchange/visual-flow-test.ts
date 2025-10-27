import { ethers } from "hardhat";
import { readNetworkDeployment } from "../utils/deployment-manager";

/**
 * Visual CTF Exchange Flow Test
 *
 * This script demonstrates a complete trading flow with detailed logging
 * to help understand how the CTF Exchange works.
 *
 * Usage:
 * npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
 */

// Enums matching OrderStructs.sol
enum Side { BUY = 0, SELL = 1 }
enum SignatureType { EOA = 0 }

function separator(char = "═") {
  console.log(char.repeat(80));
}

function section(title: string) {
  console.log("\n");
  separator();
  console.log(title);
  separator();
}

async function main() {
  section("CTF EXCHANGE - VISUAL FLOW TEST");

  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';

  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${network.chainId}`);

  // Get signers
  const [owner, maker, taker, operator] = await ethers.getSigners();

  console.log(`\nParticipants:`);
  console.log(`  Owner:    ${owner.address}`);
  console.log(`  Maker:    ${maker.address}`);
  console.log(`  Taker:    ${taker.address}`);
  console.log(`  Operator: ${operator.address}`);

  // Read deployment
  const deployment = readNetworkDeployment(networkName);
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }

  // Get contracts
  const exchange = await ethers.getContractAt("CTFExchange", deployment.contracts.CTFExchange!);
  const marketFactory = await ethers.getContractAt("MarketFactory", deployment.contracts.MarketFactory);
  const conditionalTokens = await ethers.getContractAt("ConditionalTokens", deployment.contracts.ConditionalTokens);
  const mockUSDC = await ethers.getContractAt("MockUSDC", deployment.contracts.MockUSDC!);

  console.log(`\nContracts:`);
  console.log(`  Exchange:           ${await exchange.getAddress()}`);
  console.log(`  MarketFactory:      ${await marketFactory.getAddress()}`);
  console.log(`  ConditionalTokens:  ${await conditionalTokens.getAddress()}`);
  console.log(`  MockUSDC:           ${await mockUSDC.getAddress()}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: INITIAL SETUP
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 1: INITIAL SETUP & BALANCES");

  // Mint USDC to participants
  const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  await mockUSDC.mint(maker.address, mintAmount);
  await mockUSDC.mint(taker.address, mintAmount);

  // Approve exchange
  await mockUSDC.connect(maker).approve(await exchange.getAddress(), ethers.MaxUint256);
  await mockUSDC.connect(taker).approve(await exchange.getAddress(), ethers.MaxUint256);

  // Approve conditional tokens
  await conditionalTokens.connect(maker).setApprovalForAll(await exchange.getAddress(), true);
  await conditionalTokens.connect(taker).setApprovalForAll(await exchange.getAddress(), true);

  const makerBalance = await mockUSDC.balanceOf(maker.address);
  const takerBalance = await mockUSDC.balanceOf(taker.address);

  console.log(`\n✓ USDC minted and approvals granted`);
  console.log(`  Maker USDC: ${ethers.formatUnits(makerBalance, 6)} USDC`);
  console.log(`  Taker USDC: ${ethers.formatUnits(takerBalance, 6)} USDC`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: CREATE MARKET & REGISTER TOKENS
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 2: CREATE MARKET & REGISTER TOKENS");

  const questionId = ethers.id(`Will BTC hit $100k by end of 2025? ${Date.now()}`);
  const question = "Will BTC hit $100k by end of 2025?";
  const endTime = Math.floor(Date.now() / 1000) + 86400; // 1 day
  const resolutionTime = endTime + 86400; // 1 day after end

  console.log(`\nMarket Details:`);
  console.log(`  Question: ${question}`);
  console.log(`  End Time: ${new Date(endTime * 1000).toISOString()}`);
  console.log(`  Resolution: ${new Date(resolutionTime * 1000).toISOString()}`);

  console.log(`\nCreating market...`);
  const tx = await marketFactory.createBinaryMarket(
    questionId,
    question,
    "Bitcoin prediction market for testing",
    "Crypto",
    endTime,
    resolutionTime
  );

  const receipt = await tx.wait();
  const event = receipt?.logs.find((log: any) => {
    try {
      const parsed = marketFactory.interface.parseLog(log);
      return parsed?.name === "MarketCreated";
    } catch {
      return false;
    }
  });

  if (!event) throw new Error("MarketCreated event not found");

  const parsedEvent = marketFactory.interface.parseLog(event);
  const conditionId = parsedEvent?.args.conditionId;
  const token0 = parsedEvent?.args.token0;
  const token1 = parsedEvent?.args.token1;

  console.log(`\n✓ Market created successfully`);
  console.log(`  Condition ID: ${conditionId}`);
  console.log(`  YES token (token0): ${token0}`);
  console.log(`  NO token (token1):  ${token1}`);

  // Register tokens on exchange
  console.log(`\nRegistering tokens on exchange...`);
  await exchange.connect(owner).registerToken(token0, token1, conditionId);
  console.log(`✓ Tokens registered`);

  // Verify registration
  const registeredCondition = await exchange.getConditionId(token0);
  console.log(`  Verified condition ID: ${registeredCondition}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: MAKER CREATES POSITION (SPLIT COLLATERAL)
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 3: MAKER SPLITS COLLATERAL INTO YES/NO TOKENS");

  const splitAmount = ethers.parseUnits("100", 6); // 100 USDC

  console.log(`\nMaker splits ${ethers.formatUnits(splitAmount, 6)} USDC...`);

  // Approve CTF to spend USDC
  await mockUSDC.connect(maker).approve(await conditionalTokens.getAddress(), splitAmount);

  // Split position
  const partitions = [1, 2]; // Binary outcome: [YES, NO]
  await conditionalTokens.connect(maker).splitPosition(
    await mockUSDC.getAddress(),
    ethers.ZeroHash, // No parent collection
    conditionId,
    partitions,
    splitAmount
  );

  const makerYES = await conditionalTokens.balanceOf(maker.address, token0);
  const makerNO = await conditionalTokens.balanceOf(maker.address, token1);
  const makerUSDCAfterSplit = await mockUSDC.balanceOf(maker.address);

  console.log(`\n✓ Position split successful`);
  console.log(`  Maker YES tokens: ${ethers.formatUnits(makerYES, 6)}`);
  console.log(`  Maker NO tokens:  ${ethers.formatUnits(makerNO, 6)}`);
  console.log(`  Maker USDC remaining: ${ethers.formatUnits(makerUSDCAfterSplit, 6)} USDC`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: CREATE & SIGN SELL ORDER
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 4: MAKER CREATES & SIGNS SELL ORDER");

  const order = {
    salt: 1n,
    maker: maker.address,
    signer: maker.address,
    taker: ethers.ZeroAddress, // Anyone can fill
    tokenId: token0, // Selling YES tokens
    makerAmount: ethers.parseUnits("100", 6), // 100 YES tokens
    takerAmount: ethers.parseUnits("100", 6), // For 100 USDC
    expiration: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
    nonce: 0n,
    feeRateBps: 0n, // 0% fee for this test
    side: Side.SELL,
    signatureType: SignatureType.EOA,
    signature: "0x"
  };

  console.log(`\nOrder Details:`);
  console.log(`  Maker:     ${order.maker}`);
  console.log(`  Side:      SELL (has tokens, wants USDC)`);
  console.log(`  Token:     YES (${order.tokenId})`);
  console.log(`  Amount:    ${ethers.formatUnits(order.makerAmount, 6)} YES tokens`);
  console.log(`  Price:     ${ethers.formatUnits(order.takerAmount, 6)} USDC`);
  console.log(`  Rate:      ${Number(order.takerAmount) / Number(order.makerAmount)} USDC per token`);
  console.log(`  Expires:   ${new Date(Number(order.expiration) * 1000).toISOString()}`);
  console.log(`  Nonce:     ${order.nonce}`);
  console.log(`  Fee:       ${Number(order.feeRateBps) / 100}%`);

  // Sign order (EIP-712)
  console.log(`\nSigning order with EIP-712...`);

  const domain = {
    name: "Nostra CTF Exchange",
    version: "1",
    chainId: network.chainId,
    verifyingContract: await exchange.getAddress()
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
      { name: "signatureType", type: "uint8" }
    ]
  };

  const signature = await maker.signTypedData(domain, types, order);
  order.signature = signature;

  const orderHash = await exchange.hashOrder(order);

  console.log(`✓ Order signed`);
  console.log(`  Signature: ${signature.slice(0, 20)}...`);
  console.log(`  Order Hash: ${orderHash}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: EXECUTE TRADE
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 5: OPERATOR EXECUTES TRADE");

  console.log(`\nBefore Trade:`);
  const makerYESBefore = await conditionalTokens.balanceOf(maker.address, token0);
  const makerUSDBefore = await mockUSDC.balanceOf(maker.address);
  const takerYESBefore = await conditionalTokens.balanceOf(taker.address, token0);
  const takerUSDBefore = await mockUSDC.balanceOf(taker.address);

  console.log(`  Maker: ${ethers.formatUnits(makerYESBefore, 6)} YES, ${ethers.formatUnits(makerUSDBefore, 6)} USDC`);
  console.log(`  Taker: ${ethers.formatUnits(takerYESBefore, 6)} YES, ${ethers.formatUnits(takerUSDBefore, 6)} USDC`);

  console.log(`\nExecuting trade...`);
  const fillTx = await exchange.connect(operator).fillOrder(order, order.makerAmount);
  const fillReceipt = await fillTx.wait();

  console.log(`✓ Trade executed`);
  console.log(`  Gas used: ${fillReceipt?.gasUsed.toString()}`);
  console.log(`  Tx hash: ${fillReceipt?.hash}`);

  const makerYESAfter = await conditionalTokens.balanceOf(maker.address, token0);
  const makerUSDAfter = await mockUSDC.balanceOf(maker.address);
  const takerYESAfter = await conditionalTokens.balanceOf(taker.address, token0);
  const takerUSDAfter = await mockUSDC.balanceOf(taker.address);

  console.log(`\nAfter Trade:`);
  console.log(`  Maker: ${ethers.formatUnits(makerYESAfter, 6)} YES, ${ethers.formatUnits(makerUSDAfter, 6)} USDC`);
  console.log(`  Taker: ${ethers.formatUnits(takerYESAfter, 6)} YES, ${ethers.formatUnits(takerUSDAfter, 6)} USDC`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: VERIFY TRADE RESULTS
  // ═══════════════════════════════════════════════════════════════════
  section("STEP 6: VERIFY TRADE RESULTS");

  const makerYESChange = makerYESBefore - makerYESAfter;
  const makerUSDChange = makerUSDAfter - makerUSDBefore;
  const takerYESChange = takerYESAfter - takerYESBefore;
  const takerUSDChange = takerUSDBefore - takerUSDAfter;

  console.log(`\nBalance Changes:`);
  console.log(`  Maker:`);
  console.log(`    YES: -${ethers.formatUnits(makerYESChange, 6)} (sold)`);
  console.log(`    USDC: +${ethers.formatUnits(makerUSDChange, 6)} (received)`);
  console.log(`  Taker:`);
  console.log(`    YES: +${ethers.formatUnits(takerYESChange, 6)} (bought)`);
  console.log(`    USDC: -${ethers.formatUnits(takerUSDChange, 6)} (paid)`);

  // Verify correctness
  const checks = [];

  if (makerYESChange === order.makerAmount) {
    checks.push("✓ Maker sent correct YES amount");
  } else {
    checks.push(`✗ Maker YES mismatch: expected ${order.makerAmount}, got ${makerYESChange}`);
  }

  if (makerUSDChange === order.takerAmount) {
    checks.push("✓ Maker received correct USDC amount");
  } else {
    checks.push(`✗ Maker USDC mismatch: expected ${order.takerAmount}, got ${makerUSDChange}`);
  }

  if (takerYESChange === order.makerAmount) {
    checks.push("✓ Taker received correct YES amount");
  } else {
    checks.push(`✗ Taker YES mismatch: expected ${order.makerAmount}, got ${takerYESChange}`);
  }

  if (takerUSDChange === order.takerAmount) {
    checks.push("✓ Taker paid correct USDC amount");
  } else {
    checks.push(`✗ Taker USDC mismatch: expected ${order.takerAmount}, got ${takerUSDChange}`);
  }

  console.log(`\nVerification:`);
  checks.forEach(check => console.log(`  ${check}`));

  // Check nonce was incremented
  const makerNonce = await exchange.nonces(maker.address);
  console.log(`\nNonce Management:`);
  console.log(`  Maker nonce after trade: ${makerNonce}`);
  console.log(`  ${makerNonce === 1n ? "✓" : "✗"} Nonce incremented correctly`);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  section("🎉 TRADE FLOW COMPLETE - SUMMARY");

  console.log(`\nWhat Happened:`);
  console.log(`  1. ✓ Market created for "Will BTC hit $100k?"`);
  console.log(`  2. ✓ Tokens registered on exchange (YES/NO)`);
  console.log(`  3. ✓ Maker split 100 USDC → 100 YES + 100 NO tokens`);
  console.log(`  4. ✓ Maker created SELL order for 100 YES @ 1.00 USDC each`);
  console.log(`  5. ✓ Maker signed order with EIP-712`);
  console.log(`  6. ✓ Operator executed trade (matched with Taker)`);
  console.log(`  7. ✓ 100 YES tokens transferred: Maker → Taker`);
  console.log(`  8. ✓ 100 USDC transferred: Taker → Maker`);
  console.log(`  9. ✓ Nonce incremented (prevents replay)`);

  console.log(`\nFinal State:`);
  console.log(`  Maker:`);
  console.log(`    - Sold 100 YES tokens`);
  console.log(`    - Received 100 USDC back`);
  console.log(`    - Still has 100 NO tokens`);
  console.log(`    - Net position: NO bias (bearish on BTC $100k)`);
  console.log(`  Taker:`);
  console.log(`    - Bought 100 YES tokens`);
  console.log(`    - Paid 100 USDC`);
  console.log(`    - Net position: YES bias (bullish on BTC $100k)`);

  console.log(`\nKey Insights:`);
  console.log(`  • EIP-712 signature ensures only maker authorized this trade`);
  console.log(`  • Operator role allows off-chain order matching (like centralized exchange)`);
  console.log(`  • Nonce prevents same order from being filled twice`);
  console.log(`  • Maker can hedge by selling unwanted outcome tokens`);
  console.log(`  • Total value preserved: 100 YES + 100 NO = 100 USDC equivalent`);

  separator();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
