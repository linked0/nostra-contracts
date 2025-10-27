import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";

describe("CTFExchange - NonceManager", function () {
  let exchange: CTFExchange;
  let owner: any;
  let maker: any;
  let user: any;
  let conditionalTokens: any;
  let collateralToken: any;

  beforeEach(async function () {
    [owner, maker, user] = await ethers.getSigners();

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
  });

  describe("Initial Nonce State", function () {
    it("Should have initial nonce as zero", async function () {
      expect(await exchange.nonces(maker.address)).to.equal(0);
    });

    it("Should validate only nonce 0 as valid initially", async function () {
      // Only nonce 0 is valid (exact match)
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(true);

      // Higher nonces are invalid until user increments
      expect(await exchange.isValidNonce(maker.address, 1)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 100)).to.equal(false);
    });
  });

  describe("Nonce Increment", function () {
    it("Should allow user to increment their own nonce", async function () {
      await exchange.connect(maker).incrementNonce();
      expect(await exchange.nonces(maker.address)).to.equal(1);
    });

    it("Should allow multiple nonce increments", async function () {
      await exchange.connect(maker).incrementNonce();
      expect(await exchange.nonces(maker.address)).to.equal(1);

      await exchange.connect(maker).incrementNonce();
      expect(await exchange.nonces(maker.address)).to.equal(2);

      await exchange.connect(maker).incrementNonce();
      expect(await exchange.nonces(maker.address)).to.equal(3);
    });

    it("Should invalidate orders with old nonces after increment", async function () {
      // Initially nonce 0 is valid
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(true);

      // Increment nonce to 1
      await exchange.connect(maker).incrementNonce();

      // Now nonce 0 should be invalid
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(false);

      // Only nonce 1 is valid now (exact match)
      expect(await exchange.isValidNonce(maker.address, 1)).to.equal(true);
      expect(await exchange.isValidNonce(maker.address, 2)).to.equal(false);
    });
  });

  describe("Nonce Validation", function () {
    it("Should validate only current nonce as valid", async function () {
      // Set nonce to 5
      for (let i = 0; i < 5; i++) {
        await exchange.connect(maker).incrementNonce();
      }

      // Only nonce 5 should be valid (exact match)
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 1)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 2)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 3)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 4)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 5)).to.equal(true); // Current nonce
      expect(await exchange.isValidNonce(maker.address, 6)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 100)).to.equal(false);
    });

    it("Should handle nonce validation for different users independently", async function () {
      const [, maker1, maker2] = await ethers.getSigners();

      // Increment maker1's nonce to 3
      for (let i = 0; i < 3; i++) {
        await exchange.connect(maker1).incrementNonce();
      }

      // Increment maker2's nonce to 1
      await exchange.connect(maker2).incrementNonce();

      // Check maker1's nonce validation (only 3 is valid)
      expect(await exchange.isValidNonce(maker1.address, 2)).to.equal(false);
      expect(await exchange.isValidNonce(maker1.address, 3)).to.equal(true);

      // Check maker2's nonce validation (only 1 is valid)
      expect(await exchange.isValidNonce(maker2.address, 0)).to.equal(false);
      expect(await exchange.isValidNonce(maker2.address, 1)).to.equal(true);
    });
  });

  describe("Order Cancellation via Nonce", function () {
    it("Should allow canceling single order by incrementing nonce", async function () {
      // User has an order with nonce 0
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(true);

      // User cancels by incrementing nonce
      await exchange.connect(maker).incrementNonce();

      // Order with nonce 0 is now invalid
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(false);

      // Only nonce 1 is valid now
      expect(await exchange.isValidNonce(maker.address, 1)).to.equal(true);
    });

    it("Should allow bulk order cancellation", async function () {
      // User wants to cancel all orders with nonces 0-4
      // To do this, they increment nonce to 5
      for (let i = 0; i < 5; i++) {
        await exchange.connect(maker).incrementNonce();
      }

      // All old orders (nonces 0-4) are now invalid
      expect(await exchange.isValidNonce(maker.address, 0)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 1)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 2)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 3)).to.equal(false);
      expect(await exchange.isValidNonce(maker.address, 4)).to.equal(false);

      // Only new orders with nonce 5 are valid
      expect(await exchange.isValidNonce(maker.address, 5)).to.equal(true);
    });
  });

  describe("Edge Cases", function () {
    it("Should not allow other users to affect someone else's nonce", async function () {
      const initialNonce = await exchange.nonces(maker.address);

      // User increments their own nonce (should have no effect on maker)
      await exchange.connect(user).incrementNonce();

      // Maker's nonce should be unchanged
      expect(await exchange.nonces(maker.address)).to.equal(initialNonce);

      // User's own nonce should be incremented
      expect(await exchange.nonces(user.address)).to.equal(1);
    });

    it("Should handle sequential nonce increments correctly", async function () {
      for (let i = 0; i < 10; i++) {
        await exchange.connect(maker).incrementNonce();
        expect(await exchange.nonces(maker.address)).to.equal(i + 1);
      }

      expect(await exchange.nonces(maker.address)).to.equal(10);
    });

    it("Should validate nonce at current value as valid", async function () {
      await exchange.connect(maker).incrementNonce();
      const currentNonce = await exchange.nonces(maker.address);

      expect(await exchange.isValidNonce(maker.address, currentNonce)).to.equal(true);
    });

    it("Should validate nonce one below current as invalid", async function () {
      // Increment nonce twice to get to 2
      await exchange.connect(maker).incrementNonce();
      await exchange.connect(maker).incrementNonce();

      const currentNonce = await exchange.nonces(maker.address);
      expect(currentNonce).to.equal(2);

      // Nonce 1 (one below current) should be invalid
      expect(await exchange.isValidNonce(maker.address, currentNonce - 1n)).to.equal(false);
    });

    it("Should validate nonce one above current as invalid", async function () {
      const currentNonce = await exchange.nonces(maker.address);

      // Nonce one above current should be invalid
      expect(await exchange.isValidNonce(maker.address, currentNonce + 1n)).to.equal(false);
    });
  });

  describe("Gas Efficiency", function () {
    it("Should be gas efficient for single increment", async function () {
      const tx = await exchange.connect(maker).incrementNonce();
      const receipt = await tx.wait();

      // Nonce increment should be relatively cheap
      expect(receipt?.gasUsed).to.be.lessThan(100000);
    });

    it("Should maintain efficiency with multiple increments", async function () {
      const increments = 5;
      let totalGas = 0n;

      for (let i = 0; i < increments; i++) {
        const tx = await exchange.connect(maker).incrementNonce();
        const receipt = await tx.wait();
        totalGas += receipt?.gasUsed || 0n;
      }

      // Average gas per increment should be reasonable
      const avgGas = totalGas / BigInt(increments);
      expect(avgGas).to.be.lessThan(100000);
    });
  });
});
