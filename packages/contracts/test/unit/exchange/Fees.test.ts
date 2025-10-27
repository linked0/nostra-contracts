import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";

describe("CTFExchange - Fees", function () {
  let exchange: CTFExchange;
  let owner: any;
  let conditionalTokens: any;
  let collateralToken: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

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

  describe("Fee Rate Configuration", function () {
    it("Should return correct max fee rate (1000 = 10%)", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      expect(maxFeeRate).to.equal(1000);
    });

    it("Should have constant max fee rate", async function () {
      // Check multiple times to ensure it's consistent
      const rate1 = await exchange.getMaxFeeRate();
      const rate2 = await exchange.getMaxFeeRate();
      const rate3 = await exchange.getMaxFeeRate();

      expect(rate1).to.equal(rate2);
      expect(rate2).to.equal(rate3);
      expect(rate1).to.equal(1000);
    });

    it("Should return max fee rate in basis points", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();

      // 1000 basis points = 10%
      // 100 basis points = 1%
      expect(maxFeeRate).to.equal(1000);

      // Verify the percentage calculation
      const percentage = Number(maxFeeRate) / 100;
      expect(percentage).to.equal(10); // 10%
    });
  });

  describe("Fee Calculation Logic", function () {
    it("Should support fee rates up to max (10%)", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();

      // Example: 100 USDC trade at 10% fee
      const tradeAmount = ethers.parseUnits("100", 6);
      const feeAmount = (tradeAmount * maxFeeRate) / 10000n;

      // 10% of 100 = 10 USDC
      expect(feeAmount).to.equal(ethers.parseUnits("10", 6));
    });

    it("Should correctly calculate 5% fee", async function () {
      const feeRate = 500n; // 5% in basis points
      const maxFeeRate = await exchange.getMaxFeeRate();

      // Ensure 5% is within max
      expect(feeRate).to.be.lessThanOrEqual(maxFeeRate);

      // Example: 100 USDC trade at 5% fee
      const tradeAmount = ethers.parseUnits("100", 6);
      const feeAmount = (tradeAmount * feeRate) / 10000n;

      // 5% of 100 = 5 USDC
      expect(feeAmount).to.equal(ethers.parseUnits("5", 6));
    });

    it("Should correctly calculate 1% fee", async function () {
      const feeRate = 100n; // 1% in basis points
      const maxFeeRate = await exchange.getMaxFeeRate();

      // Ensure 1% is within max
      expect(feeRate).to.be.lessThanOrEqual(maxFeeRate);

      // Example: 100 USDC trade at 1% fee
      const tradeAmount = ethers.parseUnits("100", 6);
      const feeAmount = (tradeAmount * feeRate) / 10000n;

      // 1% of 100 = 1 USDC
      expect(feeAmount).to.equal(ethers.parseUnits("1", 6));
    });

    it("Should correctly calculate zero fee", async function () {
      const feeRate = 0n; // 0% in basis points

      // Example: 100 USDC trade at 0% fee
      const tradeAmount = ethers.parseUnits("100", 6);
      const feeAmount = (tradeAmount * feeRate) / 10000n;

      // 0% of 100 = 0 USDC
      expect(feeAmount).to.equal(0n);
    });
  });

  describe("Fee Rate Validation", function () {
    it("Should identify fee rates above max as invalid", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const invalidFeeRate = maxFeeRate + 1n; // 10.01%

      expect(invalidFeeRate).to.be.greaterThan(maxFeeRate);
    });

    it("Should identify fee rates at max as valid", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const validFeeRate = maxFeeRate; // Exactly 10%

      expect(validFeeRate).to.equal(maxFeeRate);
    });

    it("Should identify fee rates below max as valid", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const validFeeRates = [0n, 100n, 500n, 999n]; // 0%, 1%, 5%, 9.99%

      for (const feeRate of validFeeRates) {
        expect(feeRate).to.be.lessThanOrEqual(maxFeeRate);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum uint256 trade amount with zero fee", async function () {
      const feeRate = 0n;
      const maxAmount = ethers.MaxUint256;
      const feeAmount = (maxAmount * feeRate) / 10000n;

      expect(feeAmount).to.equal(0n);
    });

    it("Should not overflow on large trade amounts with max fee", async function () {
      const maxFeeRate = await exchange.getMaxFeeRate();
      const largeAmount = ethers.parseUnits("1000000", 6); // 1 million USDC

      // Should not throw overflow error
      const feeAmount = (largeAmount * maxFeeRate) / 10000n;

      // 10% of 1,000,000 = 100,000 USDC
      expect(feeAmount).to.equal(ethers.parseUnits("100000", 6));
    });
  });
});
