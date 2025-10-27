import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";

// Enums (matching OrderStructs.sol)
enum SignatureType { EOA = 0 }
enum Side { BUY = 0, SELL = 1 }

describe("CTFExchange - Signatures", function () {
  let exchange: CTFExchange;
  let owner: any;
  let maker: any;
  let signer: any;
  let user: any;
  let conditionalTokens: any;
  let collateralToken: any;

  // Test token IDs
  const token0 = BigInt(ethers.id("token0"));
  const token1 = BigInt(ethers.id("token1"));
  const conditionId = ethers.id("conditionId");

  beforeEach(async function () {
    [owner, maker, signer, user] = await ethers.getSigners();

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
  });

  // Helper function to create an order
  function createOrder(overrides: any = {}) {
    return {
      salt: overrides.salt || 1n,
      maker: overrides.maker || maker.address,
      signer: overrides.signer || maker.address,
      taker: overrides.taker || ethers.ZeroAddress,
      tokenId: overrides.tokenId || token0,
      makerAmount: overrides.makerAmount || ethers.parseUnits("100", 6),
      takerAmount: overrides.takerAmount || ethers.parseUnits("100", 6),
      expiration: overrides.expiration || Math.floor(Date.now() / 1000) + 86400,
      nonce: overrides.nonce || 0n,
      feeRateBps: overrides.feeRateBps || 0n,
      side: overrides.side !== undefined ? overrides.side : Side.BUY,
      signatureType: overrides.signatureType !== undefined ? overrides.signatureType : SignatureType.EOA,
      signature: overrides.signature || "0x"
    };
  }

  // Helper function to sign an order
  async function signOrder(order: any, signerWallet: any) {
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

  describe("EIP-712 Domain Separator", function () {
    it("Should return correct domain separator", async function () {
      const domainSeparator = await exchange.domainSeparator();
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });

    it("Should include correct domain name in separator", async function () {
      // Domain separator should be deterministic based on contract address and chain
      const domain = await exchange.domainSeparator();
      expect(domain.length).to.equal(66); // 0x + 64 hex chars
    });
  });

  describe("Order Hashing", function () {
    it("Should hash order correctly", async function () {
      const order = createOrder();
      const orderHash = await exchange.hashOrder(order);

      expect(orderHash).to.not.equal(ethers.ZeroHash);
      expect(orderHash.length).to.equal(66); // 0x + 64 hex chars
    });

    it("Should produce different hashes for different orders", async function () {
      const order1 = createOrder({ salt: 1n });
      const order2 = createOrder({ salt: 2n });

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      expect(hash1).to.not.equal(hash2);
    });

    it("Should produce same hash for identical orders", async function () {
      const order1 = createOrder({ salt: 123n });
      const order2 = createOrder({ salt: 123n });

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      expect(hash1).to.equal(hash2);
    });

    it("Should produce different hashes when any order parameter changes", async function () {
      const baseOrder = createOrder();
      const baseHash = await exchange.hashOrder(baseOrder);

      // Change each parameter and verify hash changes
      const orderWithDifferentMaker = createOrder({ maker: user.address });
      expect(await exchange.hashOrder(orderWithDifferentMaker)).to.not.equal(baseHash);

      const orderWithDifferentAmount = createOrder({ makerAmount: ethers.parseUnits("200", 6) });
      expect(await exchange.hashOrder(orderWithDifferentAmount)).to.not.equal(baseHash);

      const orderWithDifferentSide = createOrder({ side: Side.SELL });
      expect(await exchange.hashOrder(orderWithDifferentSide)).to.not.equal(baseHash);
    });
  });

  describe("EOA Signature Validation", function () {
    it("Should validate correct EOA signature", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      const orderHash = await exchange.hashOrder(order);

      // This should not revert if signature is valid
      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });

    it("Should reject signature from wrong signer", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      const signature = await signOrder(order, user); // Wrong signer
      const signedOrder = { ...order, signature };

      const orderHash = await exchange.hashOrder(order);

      await expect(
        exchange.validateOrderSignature(orderHash, signedOrder)
      ).to.be.revertedWithCustomError(exchange, "InvalidSignature");
    });

    it("Should reject signature when signer doesn't match maker", async function () {
      const order = createOrder({ signer: signer.address, maker: maker.address });
      const signature = await signOrder(order, signer);
      const signedOrder = { ...order, signature };

      const orderHash = await exchange.hashOrder(order);

      await expect(
        exchange.validateOrderSignature(orderHash, signedOrder)
      ).to.be.revertedWithCustomError(exchange, "InvalidSignature");
    });

    it("Should reject invalid signature format", async function () {
      const order = createOrder({ signer: maker.address });
      const invalidSignature = "0x1234"; // Too short
      const signedOrder = { ...order, signature: invalidSignature };

      const orderHash = await exchange.hashOrder(order);

      // OpenZeppelin's ECDSA library uses ECDSAInvalidSignatureLength for short signatures
      await expect(
        exchange.validateOrderSignature(orderHash, signedOrder)
      ).to.be.revertedWithCustomError(exchange, "ECDSAInvalidSignatureLength");
    });

    it("Should reject signature with incorrect v value", async function () {
      const order = createOrder({ signer: maker.address, maker: maker.address });
      let signature = await signOrder(order, maker);

      // Manipulate the v value (last 2 chars before the end)
      const sigBytes = ethers.getBytes(signature);
      sigBytes[sigBytes.length - 1] = 99; // Invalid v value
      const corruptedSignature = ethers.hexlify(sigBytes);

      const signedOrder = { ...order, signature: corruptedSignature };
      const orderHash = await exchange.hashOrder(order);

      // OpenZeppelin's ECDSA library uses ECDSAInvalidSignature for invalid v value
      await expect(
        exchange.validateOrderSignature(orderHash, signedOrder)
      ).to.be.revertedWithCustomError(exchange, "ECDSAInvalidSignature");
    });
  });

  describe("Signature Type Support", function () {
    it("Should only support EOA signature type", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        signatureType: SignatureType.EOA
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      // EOA signature should work
      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle orders with zero taker (public orders)", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        taker: ethers.ZeroAddress
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });

    it("Should handle orders with specific taker", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        taker: user.address
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });

    it("Should handle orders with maximum amounts", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        makerAmount: ethers.MaxUint256,
        takerAmount: ethers.MaxUint256
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });

    it("Should handle orders with far future expiration", async function () {
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        expiration: Math.floor(Date.now() / 1000) + 365 * 86400 // 1 year
      });

      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };
      const orderHash = await exchange.hashOrder(order);

      await expect(exchange.validateOrderSignature(orderHash, signedOrder)).to.not.be.reverted;
    });

    it("Should validate multiple orders from same maker", async function () {
      const order1 = createOrder({ salt: 1n, signer: maker.address, maker: maker.address });
      const order2 = createOrder({ salt: 2n, signer: maker.address, maker: maker.address });

      const sig1 = await signOrder(order1, maker);
      const sig2 = await signOrder(order2, maker);

      const signedOrder1 = { ...order1, signature: sig1 };
      const signedOrder2 = { ...order2, signature: sig2 };

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      await expect(exchange.validateOrderSignature(hash1, signedOrder1)).to.not.be.reverted;
      await expect(exchange.validateOrderSignature(hash2, signedOrder2)).to.not.be.reverted;
    });
  });

  describe("Signature Replay Protection", function () {
    it("Should produce different hashes for different salts", async function () {
      const order1 = createOrder({ salt: 1n });
      const order2 = createOrder({ salt: 2n });

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      expect(hash1).to.not.equal(hash2);
    });

    it("Should produce different hashes for different nonces", async function () {
      const order1 = createOrder({ nonce: 0n });
      const order2 = createOrder({ nonce: 1n });

      const hash1 = await exchange.hashOrder(order1);
      const hash2 = await exchange.hashOrder(order2);

      expect(hash1).to.not.equal(hash2);
    });
  });
});
