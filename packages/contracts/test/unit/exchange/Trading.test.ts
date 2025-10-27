import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Enums (matching OrderStructs.sol)
enum SignatureType { EOA = 0 }
enum Side { BUY = 0, SELL = 1 }

describe("CTFExchange - Trading", function () {
  let exchange: CTFExchange;
  let owner: SignerWithAddress;
  let maker: SignerWithAddress;
  let taker: SignerWithAddress;
  let operator: SignerWithAddress;
  let conditionalTokens: any;
  let collateralToken: any;

  // Test token IDs
  const token0 = BigInt(ethers.id("token0"));
  const token1 = BigInt(ethers.id("token1"));
  const conditionId = ethers.id("conditionId");

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

    // Register token pair
    await exchange.connect(owner).registerToken(token0, token1, conditionId);

    // Add operator
    await exchange.connect(owner).addOperator(operator.address);

    // Mint some test tokens to maker and taker
    const mintAmount = ethers.parseUnits("1000", 6);
    await collateralToken.mint(maker.address, mintAmount);
    await collateralToken.mint(taker.address, mintAmount);
    await collateralToken.mint(operator.address, mintAmount);

    // Approve exchange
    await collateralToken.connect(maker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(taker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(operator).approve(await exchange.getAddress(), ethers.MaxUint256);
  });

  // Helper function to create an order
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

  // Helper function to sign an order
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

    const signature = await signerWallet.signTypedData(domain, types, order);
    return signature;
  }

  describe("Order Validation", function () {
    it("Should validate a valid order", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should reject order with expired timestamp", async function () {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: expiredTime
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "OrderExpired");
    });

    it("Should reject order with fee too high", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        feeRateBps: maxFeeRate + 1n
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "FeeTooHigh");
    });

    it("Should reject order with unregistered token", async function () {
      const unregisteredToken = ethers.id("unregistered");
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: unregisteredToken
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");
    });

    it("Should reject order with invalid nonce", async function () {
      // Increment maker's nonce to invalidate nonce 0
      await exchange.connect(maker).incrementNonce();

      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        nonce: 0n // Now invalid
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");
    });

    it("Should reject order with invalid signature", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, taker); // Wrong signer
      const signedOrder = { ...order, signature };

      await expect(
        exchange.validateOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "InvalidSignature");
    });
  });

  describe("Order Cancellation", function () {
    it("Should allow maker to cancel their own order", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      const orderHash = await exchange.hashOrder(order);

      await expect(exchange.connect(maker).cancelOrder(signedOrder))
        .to.emit(exchange, "OrderCancelled")
        .withArgs(orderHash);

      const status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(true);
    });

    it("Should not allow non-maker to cancel order", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.connect(taker).cancelOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "NotOwner");
    });

    it("Should not allow cancelling already cancelled order", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await exchange.connect(maker).cancelOrder(signedOrder);

      await expect(
        exchange.connect(maker).cancelOrder(signedOrder)
      ).to.be.revertedWithCustomError(exchange, "OrderFilledOrCancelled");
    });

    it("Should allow bulk order cancellation", async function () {
      const order1 = createOrder({ salt: 1n, signer: maker.address, maker: maker.address });
      const order2 = createOrder({ salt: 2n, signer: maker.address, maker: maker.address });
      const order3 = createOrder({ salt: 3n, signer: maker.address, maker: maker.address });

      const sig1 = await signOrder(order1, maker);
      const sig2 = await signOrder(order2, maker);
      const sig3 = await signOrder(order3, maker);

      const signedOrders = [
        { ...order1, signature: sig1 },
        { ...order2, signature: sig2 },
        { ...order3, signature: sig3 }
      ];

      await exchange.connect(maker).cancelOrders(signedOrders);

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);
      const hash3 = await exchange.hashOrder(order3);

      expect((await exchange.getOrderStatus(hash1)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(hash2)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(hash3)).isFilledOrCancelled).to.equal(true);
    });
  });

  describe("Order Status Tracking", function () {
    it("Should return initial order status as not filled/cancelled", async function () {
      const order = createOrder();
      const orderHash = await exchange.hashOrder(order);

      const status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(false);
      expect(status.remaining).to.equal(0);
    });

    it("Should update status after cancellation", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      await exchange.connect(maker).cancelOrder(signedOrder);

      const status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(true);
    });

    it("Should track different orders independently", async function () {
      const order1 = createOrder({ salt: 1n, signer: maker.address, maker: maker.address });
      const order2 = createOrder({ salt: 2n, signer: maker.address, maker: maker.address });

      const sig1 = await signOrder(order1, maker);
      const signedOrder1 = { ...order1, signature: sig1 };

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      // Cancel only order1
      await exchange.connect(maker).cancelOrder(signedOrder1);

      expect((await exchange.getOrderStatus(hash1)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(hash2)).isFilledOrCancelled).to.equal(false);
    });
  });

  describe("Order Validation Edge Cases", function () {
    it("Should accept order with zero expiration (no expiry)", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: 0
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should accept order with far future expiration", async function () {
      const farFuture = Math.floor(Date.now() / 1000) + 365 * 86400; // 1 year
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: farFuture
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should accept order with specific taker", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        taker: taker.address
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should accept order with zero fee", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        feeRateBps: 0n
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should accept order with max fee", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        feeRateBps: maxFeeRate
      });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;
    });

    it("Should handle orders for both token0 and token1", async function () {
      const order0 = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0
      });
      const order1 = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token1
      });

      const sig0 = await signOrder(order0, maker);
      const sig1 = await signOrder(order1, maker);

      await expect(exchange.validateOrder({ ...order0, signature: sig0 })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...order1, signature: sig1 })).to.not.be.reverted;
    });
  });

  describe("Access Control for Trading Operations", function () {
    it("Should only allow operator to call fillOrder", async function () {
      // This will revert because we're not actually passing valid order data
      // but we can test that non-operator is rejected
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.connect(taker).fillOrder(signedOrder, ethers.parseUnits("10", 6))
      ).to.be.revertedWithCustomError(exchange, "NotOperator");
    });

    it("Should only allow operator to call matchOrders", async function () {
      const takerOrder = createOrder({ signer: taker.address, maker: taker.address });
      const makerOrder = createOrder({ signer: maker.address, maker: maker.address });

      const takerSig = await signOrder(takerOrder, taker);
      const makerSig = await signOrder(makerOrder, maker);

      await expect(
        exchange.connect(taker).matchOrders(
          { ...takerOrder, signature: takerSig },
          [{ ...makerOrder, signature: makerSig }],
          ethers.parseUnits("10", 6),
          [ethers.parseUnits("10", 6)]
        )
      ).to.be.revertedWithCustomError(exchange, "NotOperator");
    });

    it("Should not allow trading when paused", async function () {
      await exchange.connect(owner).pauseTrading();

      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      await expect(
        exchange.connect(operator).fillOrder(signedOrder, ethers.parseUnits("10", 6))
      ).to.be.revertedWithCustomError(exchange, "Paused");
    });
  });

  describe("Gas Efficiency", function () {
    it("Should be gas efficient for order cancellation", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      const tx = await exchange.connect(maker).cancelOrder(signedOrder);
      const receipt = await tx.wait();

      // Order cancellation should be cheap
      expect(receipt?.gasUsed).to.be.lessThan(100000);
    });

    it("Should efficiently cancel multiple orders", async function () {
      const orders = [];
      for (let i = 0; i < 5; i++) {
        const order = createOrder({ salt: BigInt(i + 1), signer: maker.address, maker: maker.address });
        const signature = await signOrder(order, maker);
        orders.push({ ...order, signature });
      }

      const tx = await exchange.connect(maker).cancelOrders(orders);
      const receipt = await tx.wait();

      // Batch cancellation should be efficient
      const avgGasPerOrder = Number(receipt?.gasUsed || 0n) / orders.length;
      expect(avgGasPerOrder).to.be.lessThan(50000);
    });
  });
});
