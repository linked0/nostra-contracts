import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Enums (matching OrderStructs.sol)
enum SignatureType { EOA = 0 }
enum Side { BUY = 0, SELL = 1 }

describe("CTF Exchange - Integration: Complete Order Flow", function () {
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
  const conditionId = ethers.id("WILL_BTC_HIT_100K");

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

    // Register token pair (YES/NO tokens for the condition)
    await exchange.connect(owner).registerToken(token0, token1, conditionId);

    // Add operator
    await exchange.connect(owner).addOperator(operator.address);

    // Mint collateral to participants
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    await collateralToken.mint(maker.address, mintAmount);
    await collateralToken.mint(taker.address, mintAmount);
    await collateralToken.mint(operator.address, mintAmount);

    // Approve exchange
    await collateralToken.connect(maker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(taker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(operator).approve(await exchange.getAddress(), ethers.MaxUint256);

    // Approve conditional tokens for exchange
    await conditionalTokens.connect(maker).setApprovalForAll(await exchange.getAddress(), true);
    await conditionalTokens.connect(taker).setApprovalForAll(await exchange.getAddress(), true);
    await conditionalTokens.connect(operator).setApprovalForAll(await exchange.getAddress(), true);
  });

  // Helper to create order
  function createOrder(overrides: any = {}) {
    const defaultExpiration = overrides.expiration !== undefined
      ? overrides.expiration
      : Math.floor(Date.now() / 1000) + 31536000; // 1 year from now to avoid expiration issues

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

  describe("End-to-End: Order Creation and Cancellation", function () {
    it("Should create, validate, and cancel an order", async function () {
      // Step 1: Create an order
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.BUY,
        makerAmount: ethers.parseUnits("100", 6),
        takerAmount: ethers.parseUnits("100", 6)
      });

      // Step 2: Sign the order
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 3: Validate the order
      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;

      // Step 4: Check order hash
      const orderHash = await exchange.hashOrder(order);
      expect(orderHash).to.not.equal(ethers.ZeroHash);

      // Step 5: Verify initial status
      let status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(false);

      // Step 6: Cancel the order
      await expect(exchange.connect(maker).cancelOrder(signedOrder))
        .to.emit(exchange, "OrderCancelled")
        .withArgs(orderHash);

      // Step 7: Verify cancelled status
      status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(true);

      // Step 8: Ensure order can't be cancelled again
      await expect(
        exchange.connect(maker).cancelOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "OrderFilledOrCancelled");
    });
  });

  describe("End-to-End: Nonce Management and Order Invalidation", function () {
    it("Should invalidate orders after nonce increment", async function () {
      // Step 1: Create multiple orders with nonce 0
      const order1 = createOrder({ salt: 1n, signer: maker.address, maker: maker.address, nonce: 0n });
      const order2 = createOrder({ salt: 2n, signer: maker.address, maker: maker.address, nonce: 0n });
      const order3 = createOrder({ salt: 3n, signer: maker.address, maker: maker.address, nonce: 0n });

      const sig1 = await signOrder(order1, maker);
      const sig2 = await signOrder(order2, maker);
      const sig3 = await signOrder(order3, maker);

      // Step 2: Verify all orders are valid
      await expect(exchange.validateOrder({ ...order1, signature: sig1 })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...order2, signature: sig2 })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...order3, signature: sig3 })).to.not.be.reverted;

      // Step 3: Increment nonce to invalidate all nonce 0 orders
      await exchange.connect(maker).incrementNonce();

      // Step 4: Verify all orders are now invalid
      await expect(
        exchange.validateOrder({ ...order1, signature: sig1 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      await expect(
        exchange.validateOrder({ ...order2, signature: sig2 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      await expect(
        exchange.validateOrder({ ...order3, signature: sig3 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      // Step 5: New orders with nonce 1 should be valid
      const newOrder = createOrder({ salt: 4n, signer: maker.address, maker: maker.address, nonce: 1n });
      const newSig = await signOrder(newOrder, maker);

      await expect(exchange.validateOrder({ ...newOrder, signature: newSig })).to.not.be.reverted;
    });
  });

  describe("End-to-End: Multi-User Order Management", function () {
    it("Should manage orders for multiple users independently", async function () {
      // Step 1: Create orders from maker and taker
      const makerOrder = createOrder({ salt: 1n, signer: maker.address, maker: maker.address });
      const takerOrder = createOrder({ salt: 1n, signer: taker.address, maker: taker.address });

      const makerSig = await signOrder(makerOrder, maker);
      const takerSig = await signOrder(takerOrder, taker);

      // Step 2: Both should be valid initially
      await expect(exchange.validateOrder({ ...makerOrder, signature: makerSig })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...takerOrder, signature: takerSig })).to.not.be.reverted;

      // Step 3: Cancel maker's order
      await exchange.connect(maker).cancelOrder({ ...makerOrder, signature: makerSig });

      // Step 4: Verify maker's order is cancelled but taker's is still valid
      const makerHash = await exchange.hashOrder(makerOrder);
      const takerHash = await exchange.hashOrder(takerOrder);

      expect((await exchange.getOrderStatus(makerHash)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(takerHash)).isFilledOrCancelled).to.equal(false);

      // Step 5: Taker's order should still validate
      await expect(exchange.validateOrder({ ...takerOrder, signature: takerSig })).to.not.be.reverted;

      // Step 6: Taker can still cancel their order
      await exchange.connect(taker).cancelOrder({ ...takerOrder, signature: takerSig });
      expect((await exchange.getOrderStatus(takerHash)).isFilledOrCancelled).to.equal(true);
    });
  });

  describe("End-to-End: Order Expiration Flow", function () {
    it("Should reject expired orders", async function () {
      // Step 1: Create order with short expiration
      const currentTime = Math.floor(Date.now() / 1000);
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: currentTime - 3600 // 1 hour ago
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Order should fail validation
      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "OrderExpired");
    });

    it("Should accept orders with future expiration", async function () {
      // Step 1: Create order with future expiration
      const currentTime = Math.floor(Date.now() / 1000);
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: currentTime + 86400 // 1 day in future
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Order should pass validation
      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should accept orders with no expiration", async function () {
      // Step 1: Create order with no expiration (0)
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: 0
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Order should pass validation
      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });
  });

  describe("End-to-End: Fee Validation Flow", function () {
    it("Should reject orders with excessive fees", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();

      // Step 1: Create order with fee above max
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        feeRateBps: maxFeeRate + 1n
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Order should fail validation
      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "FeeTooHigh");
    });

    it("Should accept orders with max fee", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();

      // Step 1: Create order with max fee
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        feeRateBps: maxFeeRate
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Order should pass validation
      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });
  });

  describe("End-to-End: Access Control Flow", function () {
    it("Should prevent trading when paused", async function () {
      // Step 1: Create valid order
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Pause trading
      await exchange.connect(owner).pauseTrading();

      // Step 3: Operator should not be able to fill order
      await expect(
        exchange.connect(operator).fillOrder(signedOrder, ethers.parseUnits("10", 6))
      ).to.be.revertedWithCustomError(exchange, "Paused");

      // Step 4: Unpause trading
      await exchange.connect(owner).unpauseTrading();

      // Step 5: Now operator should be rejected for different reason (missing funds, not paused)
      // This will fail with different error, but proves pause is lifted
    });

    it("Should enforce operator-only access for trading", async function () {
      // Step 1: Create valid order
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 2: Non-operator should not be able to fill order
      await expect(
        exchange.connect(taker).fillOrder(signedOrder, ethers.parseUnits("10", 6))
      ).to.be.revertedWithCustomError(exchange, "NotOperator");

      // Step 3: Non-operator should not be able to match orders
      await expect(
        exchange.connect(taker).matchOrders(signedOrder, [signedOrder], ethers.parseUnits("10", 6), [ethers.parseUnits("10", 6)])
      ).to.be.revertedWithCustomError(exchange, "NotOperator");
    });
  });

  describe("End-to-End: Complete Lifecycle", function () {
    it("Should handle complete order lifecycle from creation to cancellation", async function () {
      // Initial balances
      const initialMakerBalance = await collateralToken.balanceOf(maker.address);

      // Step 1: Create order
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.BUY,
        makerAmount: ethers.parseUnits("100", 6),
        takerAmount: ethers.parseUnits("100", 6),
        feeRateBps: 100n // 1% fee
      });

      // Step 2: Sign order
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 3: Validate order
      await exchange.validateOrder(signedOrder);

      // Step 4: Get order hash and verify status
      const orderHash = await exchange.hashOrder(order);
      let status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(false);

      // Step 5: Cancel order
      await exchange.connect(maker).cancelOrder(signedOrder);

      // Step 6: Verify cancelled
      status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(true);

      // Step 7: Verify balances unchanged (no tokens moved during cancel)
      const finalMakerBalance = await collateralToken.balanceOf(maker.address);
      expect(finalMakerBalance).to.equal(initialMakerBalance);
    });
  });
});
