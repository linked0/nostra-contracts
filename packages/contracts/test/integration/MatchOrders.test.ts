import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Enums (matching OrderStructs.sol)
enum SignatureType { EOA = 0 }
enum Side { BUY = 0, SELL = 1 }

describe("CTF Exchange - Integration: matchOrders Flow", function () {
  let exchange: CTFExchange;
  let owner: SignerWithAddress;
  let maker: SignerWithAddress;
  let taker: SignerWithAddress;
  let operator: SignerWithAddress;
  let conditionalTokens: any;
  let collateralToken: any;

  // Test tokens
  const token0 = BigInt(ethers.id("YES_TOKEN"));
  const token1 = BigInt(ethers.id("NO_TOKEN"));
  const questionId = ethers.id("WILL_BTC_HIT_100K");
  let conditionId: string;

  beforeEach(async function () {
    [owner, maker, taker, operator] = await ethers.getSigners();

    // Deploy mock ConditionalTokens
    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = await ConditionalTokensFactory.deploy();
    await conditionalTokens.waitForDeployment();

    // Deploy mock USDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    collateralToken = await MockUSDCFactory.deploy();
    await collateralToken.waitForDeployment();

    // Deploy CTFExchange
    const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
    exchange = await CTFExchangeFactory.deploy(
      await collateralToken.getAddress(),
      await conditionalTokens.getAddress()
    );
    await exchange.waitForDeployment();

    // Prepare condition for outcome tokens and get the actual conditionId
    await conditionalTokens.prepareCondition(owner.address, questionId, 2);
    conditionId = await conditionalTokens.getConditionId(owner.address, questionId, 2);

    // Register token pair (YES/NO tokens for the condition)
    await exchange.connect(owner).registerToken(token0, token1, conditionId);

    // Add operator
    await exchange.connect(owner).addOperator(operator.address);

    // Mint collateral to participants
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    await collateralToken.mint(maker.address, mintAmount);
    await collateralToken.mint(taker.address, mintAmount);
    await collateralToken.mint(operator.address, mintAmount);

    // Approve collateral for ConditionalTokens (for splitting)
    await collateralToken.connect(maker).approve(await conditionalTokens.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(taker).approve(await conditionalTokens.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(operator).approve(await conditionalTokens.getAddress(), ethers.MaxUint256);

    // Approve exchange for collateral
    await collateralToken.connect(maker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(taker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(operator).approve(await exchange.getAddress(), ethers.MaxUint256);

    // Approve conditional tokens for exchange
    await conditionalTokens.connect(maker).setApprovalForAll(await exchange.getAddress(), true);
    await conditionalTokens.connect(taker).setApprovalForAll(await exchange.getAddress(), true);
    await conditionalTokens.connect(operator).setApprovalForAll(await exchange.getAddress(), true);

    // Deposit collateral into the exchange (required for internal balance system)
    const depositAmount = ethers.parseUnits("5000", 6); // 5,000 USDC each
    await exchange.connect(maker).deposit(depositAmount);
    await exchange.connect(taker).deposit(depositAmount);
    await exchange.connect(operator).deposit(depositAmount);

    // Split collateral into outcome tokens for each participant
    await conditionalTokens.connect(maker).splitPosition(
      await collateralToken.getAddress(),
      ethers.ZeroHash,  // parentCollectionId
      conditionId,
      [1, 2],  // partition (binary outcomes)
      ethers.parseUnits("1000", 6)  // amount
    );

    await conditionalTokens.connect(taker).splitPosition(
      await collateralToken.getAddress(),
      ethers.ZeroHash,
      conditionId,
      [1, 2],
      ethers.parseUnits("1000", 6)
    );

    await conditionalTokens.connect(operator).splitPosition(
      await collateralToken.getAddress(),
      ethers.ZeroHash,
      conditionId,
      [1, 2],
      ethers.parseUnits("1000", 6)
    );
  });

  // Helper to create order
  function createOrder(overrides: any = {}) {
    const defaultExpiration = overrides.expiration !== undefined
      ? overrides.expiration
      : Math.floor(Date.now() / 1000) + 31536000; // 1 year from now

    return {
      salt: overrides.salt || 1n,
      maker: overrides.maker || maker.address,
      signer: overrides.signer || maker.address,
      taker: overrides.taker || ethers.ZeroAddress,
      tokenId: overrides.tokenId || token0,
      makerAmount: overrides.makerAmount || ethers.parseUnits("100", 6),
      takerAmount: overrides.takerAmount || ethers.parseUnits("100", 6),
      expiration: defaultExpiration,
      nonce: overrides.nonce || 0n,
      feeRateBps: overrides.feeRateBps || 0n,
      side: overrides.side !== undefined ? overrides.side : Side.BUY,
      signatureType: overrides.signatureType !== undefined ? overrides.signatureType : SignatureType.EOA,
      signature: overrides.signature || "0x"
    };
  }

  // Helper to sign order
  async function signOrder(order: any, signerWallet: SignerWithAddress) {
    const domain = {
      name: "Nostra CTF Exchange",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
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

    return await signerWallet.signTypedData(domain, types, order);
  }

  describe("Successful matchOrders Scenarios", function () {
    it("Should successfully match a taker order with a single maker order", async function () {
      // Scenario: Alice (taker) wants to buy 100 YES tokens immediately
      //           Bob (maker) has an order to sell 100 YES tokens

      // Step 1: Create maker order (Bob selling 100 YES tokens)
      const makerOrder = createOrder({
        salt: 1n,
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.SELL,
        makerAmount: ethers.parseUnits("100", 6), // Bob gives 100 YES tokens
        takerAmount: ethers.parseUnits("60", 6),  // Bob receives 60 USDC (0.60 per token)
        feeRateBps: 100n, // 1% fee
        nonce: 0n
      });

      const makerSig = await signOrder(makerOrder, maker);
      const signedMakerOrder = { ...makerOrder, signature: makerSig };

      // Step 2: Create taker order (Alice buying 100 YES tokens)
      const takerOrder = createOrder({
        salt: 2n,
        signer: taker.address,
        maker: taker.address,
        tokenId: token0,
        side: Side.BUY,
        makerAmount: ethers.parseUnits("60", 6),  // Alice gives 60 USDC
        takerAmount: ethers.parseUnits("100", 6), // Alice receives 100 YES tokens
        feeRateBps: 100n, // 1% fee
        nonce: 0n
      });

      const takerSig = await signOrder(takerOrder, taker);
      const signedTakerOrder = { ...takerOrder, signature: takerSig };

      // Step 3: Record initial balances
      const takerUSDCBefore = await collateralToken.balanceOf(taker.address);
      const takerYESBefore = await conditionalTokens.balanceOf(taker.address, token0);
      const makerUSDCBefore = await collateralToken.balanceOf(maker.address);
      const makerYESBefore = await conditionalTokens.balanceOf(maker.address, token0);
      const operatorYESBefore = await conditionalTokens.balanceOf(operator.address, token0);

      // Step 4: Operator calls matchOrders
      await expect(
        exchange.connect(operator).matchOrders(
          signedTakerOrder,
          [signedMakerOrder],
          ethers.parseUnits("60", 6),  // Taker fill amount (USDC)
          [ethers.parseUnits("100", 6)] // Maker fill amounts (YES tokens)
        )
      ).to.emit(exchange, "OrdersMatched");

      // Step 5: Verify balance changes
      const takerUSDCAfter = await collateralToken.balanceOf(taker.address);
      const takerYESAfter = await conditionalTokens.balanceOf(taker.address, token0);
      const makerUSDCAfter = await collateralToken.balanceOf(maker.address);
      const makerYESAfter = await conditionalTokens.balanceOf(maker.address, token0);
      const operatorYESAfter = await conditionalTokens.balanceOf(operator.address, token0);

      // Alice (taker) gave 60 USDC, received 99 YES (100 - 1% fee)
      expect(takerUSDCBefore - takerUSDCAfter).to.equal(ethers.parseUnits("60", 6));
      expect(takerYESAfter - takerYESBefore).to.equal(ethers.parseUnits("99", 6));

      // Bob (maker) gave 100 YES, received 60 USDC
      expect(makerYESBefore - makerYESAfter).to.equal(ethers.parseUnits("100", 6));
      expect(makerUSDCAfter - makerUSDCBefore).to.equal(ethers.parseUnits("60", 6));

      // Operator received 1 YES as fee (1% of 100)
      expect(operatorYESAfter - operatorYESBefore).to.equal(ethers.parseUnits("1", 6));

      // Step 6: Verify maker order is marked as filled
      const makerHash = await exchange.hashOrder(makerOrder);
      const makerStatus = await exchange.getOrderStatus(makerHash);
      expect(makerStatus.isFilledOrCancelled).to.equal(true);
    });

    it("Should successfully match a taker order with multiple maker orders", async function () {
      // Scenario: Alice (taker) wants to buy 100 YES tokens
      //           Bob has 40 YES @ 0.60, Carol has 35 YES @ 0.61, Dave has 25 YES @ 0.62

      // Get additional signers for Carol and Dave
      const signers = await ethers.getSigners();
      const maker2 = signers[4]; // Carol
      const maker3 = signers[5]; // Dave

      // Setup additional makers (mint collateral, split into outcome tokens, approve)
      await collateralToken.mint(maker2.address, ethers.parseUnits("10000", 6));
      await collateralToken.mint(maker3.address, ethers.parseUnits("10000", 6));

      await collateralToken.connect(maker2).approve(await conditionalTokens.getAddress(), ethers.MaxUint256);
      await collateralToken.connect(maker3).approve(await conditionalTokens.getAddress(), ethers.MaxUint256);

      await conditionalTokens.connect(maker2).splitPosition(
        await collateralToken.getAddress(),
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        ethers.parseUnits("1000", 6)
      );

      await conditionalTokens.connect(maker3).splitPosition(
        await collateralToken.getAddress(),
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        ethers.parseUnits("1000", 6)
      );

      await collateralToken.connect(maker2).approve(await exchange.getAddress(), ethers.MaxUint256);
      await collateralToken.connect(maker3).approve(await exchange.getAddress(), ethers.MaxUint256);
      await conditionalTokens.connect(maker2).setApprovalForAll(await exchange.getAddress(), true);
      await conditionalTokens.connect(maker3).setApprovalForAll(await exchange.getAddress(), true);

      // Create maker orders
      // Bob's order: Sell 40 YES @ 0.60 each
      const bobOrder = createOrder({
        salt: 1n,
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.SELL,
        makerAmount: ethers.parseUnits("40", 6),  // 40 YES
        takerAmount: ethers.parseUnits("24", 6),  // 24 USDC (0.60 per token)
        feeRateBps: 100n,
        nonce: 0n
      });

      // Carol's order: Sell 35 YES @ 0.61 each
      const carolOrder = createOrder({
        salt: 2n,
        signer: maker2.address,
        maker: maker2.address,
        tokenId: token0,
        side: Side.SELL,
        makerAmount: ethers.parseUnits("35", 6),  // 35 YES
        takerAmount: ethers.parseUnits("21.35", 6), // 21.35 USDC (0.61 per token)
        feeRateBps: 100n,
        nonce: 0n
      });

      // Dave's order: Sell 25 YES @ 0.62 each
      const daveOrder = createOrder({
        salt: 3n,
        signer: maker3.address,
        maker: maker3.address,
        tokenId: token0,
        side: Side.SELL,
        makerAmount: ethers.parseUnits("25", 6),  // 25 YES
        takerAmount: ethers.parseUnits("15.50", 6), // 15.50 USDC (0.62 per token)
        feeRateBps: 100n,
        nonce: 0n
      });

      const bobSig = await signOrder(bobOrder, maker);
      const carolSig = await signOrder(carolOrder, maker2);
      const daveSig = await signOrder(daveOrder, maker3);

      // Create taker order (Alice buying 100 YES)
      const aliceOrder = createOrder({
        salt: 4n,
        signer: taker.address,
        maker: taker.address,
        tokenId: token0,
        side: Side.BUY,
        makerAmount: ethers.parseUnits("61", 6),   // Alice gives 61 USDC (enough for all)
        takerAmount: ethers.parseUnits("100", 6),  // Alice wants 100 YES
        feeRateBps: 100n,
        nonce: 0n
      });

      const aliceSig = await signOrder(aliceOrder, taker);

      // Record initial balances
      const aliceYESBefore = await conditionalTokens.balanceOf(taker.address, token0);
      const bobYESBefore = await conditionalTokens.balanceOf(maker.address, token0);
      const carolYESBefore = await conditionalTokens.balanceOf(maker2.address, token0);
      const daveYESBefore = await conditionalTokens.balanceOf(maker3.address, token0);
      const operatorYESBefore = await conditionalTokens.balanceOf(operator.address, token0);

      // Operator matches orders
      await expect(
        exchange.connect(operator).matchOrders(
          { ...aliceOrder, signature: aliceSig },
          [
            { ...bobOrder, signature: bobSig },
            { ...carolOrder, signature: carolSig },
            { ...daveOrder, signature: daveSig }
          ],
          ethers.parseUnits("61", 6),  // Total USDC Alice spends
          [
            ethers.parseUnits("40", 6),   // Take 40 YES from Bob
            ethers.parseUnits("35", 6),   // Take 35 YES from Carol
            ethers.parseUnits("25", 6)    // Take 25 YES from Dave
          ]
        )
      ).to.emit(exchange, "OrdersMatched");

      // Verify balance changes
      const aliceYESAfter = await conditionalTokens.balanceOf(taker.address, token0);
      const bobYESAfter = await conditionalTokens.balanceOf(maker.address, token0);
      const carolYESAfter = await conditionalTokens.balanceOf(maker2.address, token0);
      const daveYESAfter = await conditionalTokens.balanceOf(maker3.address, token0);
      const operatorYESAfter = await conditionalTokens.balanceOf(operator.address, token0);

      // Alice received 99 YES (100 - 1% fee)
      expect(aliceYESAfter - aliceYESBefore).to.equal(ethers.parseUnits("99", 6));

      // Bob gave 40 YES
      expect(bobYESBefore - bobYESAfter).to.equal(ethers.parseUnits("40", 6));

      // Carol gave 35 YES
      expect(carolYESBefore - carolYESAfter).to.equal(ethers.parseUnits("35", 6));

      // Dave gave 25 YES
      expect(daveYESBefore - daveYESAfter).to.equal(ethers.parseUnits("25", 6));

      // Operator received 1 YES as fee
      expect(operatorYESAfter - operatorYESBefore).to.equal(ethers.parseUnits("1", 6));

      // Verify all maker orders are marked as filled
      const bobHash = await exchange.hashOrder(bobOrder);
      const carolHash = await exchange.hashOrder(carolOrder);
      const daveHash = await exchange.hashOrder(daveOrder);

      expect((await exchange.getOrderStatus(bobHash)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(carolHash)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(daveHash)).isFilledOrCancelled).to.equal(true);
    });
  });

  describe("Validation and Error Scenarios", function () {
    it("Should fail matchOrders if taker order is invalid", async function () {
      // Create valid maker order
      const makerOrder = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.SELL,
        nonce: 0n
      });

      const makerSig = await signOrder(makerOrder, maker);

      // Create taker order with invalid nonce
      const takerOrder = createOrder({
        signer: taker.address,
        maker: taker.address,
        tokenId: token0,
        side: Side.BUY,
        nonce: 999n  // Invalid nonce (current nonce is 0)
      });

      const takerSig = await signOrder(takerOrder, taker);

      // matchOrders should revert due to invalid taker nonce
      await expect(
        exchange.connect(operator).matchOrders(
          { ...takerOrder, signature: takerSig },
          [{ ...makerOrder, signature: makerSig }],
          ethers.parseUnits("100", 6),
          [ethers.parseUnits("100", 6)]
        )
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");
    });

    it("Should fail matchOrders if any maker order is invalid", async function () {
      // Create valid taker order
      const takerOrder = createOrder({
        signer: taker.address,
        maker: taker.address,
        tokenId: token0,
        side: Side.BUY,
        nonce: 0n
      });

      const takerSig = await signOrder(takerOrder, taker);

      // Create maker order with expired timestamp
      const expiredOrder = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.SELL,
        expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        nonce: 0n
      });

      const expiredSig = await signOrder(expiredOrder, maker);

      // matchOrders should revert due to expired maker order
      await expect(
        exchange.connect(operator).matchOrders(
          { ...takerOrder, signature: takerSig },
          [{ ...expiredOrder, signature: expiredSig }],
          ethers.parseUnits("100", 6),
          [ethers.parseUnits("100", 6)]
        )
      ).to.be.revertedWithCustomError(exchange, "OrderExpired");
    });

    it("Should fail matchOrders when called by non-operator", async function () {
      const makerOrder = createOrder({ signer: maker.address, maker: maker.address });
      const takerOrder = createOrder({ signer: taker.address, maker: taker.address });

      const makerSig = await signOrder(makerOrder, maker);
      const takerSig = await signOrder(takerOrder, taker);

      await expect(
        exchange.connect(taker).matchOrders(
          { ...takerOrder, signature: takerSig },
          [{ ...makerOrder, signature: makerSig }],
          ethers.parseUnits("100", 6),
          [ethers.parseUnits("100", 6)]
        )
      ).to.be.revertedWithCustomError(exchange, "NotOperator");
    });
  });
});
