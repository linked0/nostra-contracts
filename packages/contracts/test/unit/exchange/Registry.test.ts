import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";

describe("CTFExchange - Registry", function () {
  let exchange: CTFExchange;
  let owner: any;
  let user: any;
  let conditionalTokens: any;
  let collateralToken: any;

  // Test token IDs and condition ID
  const token0 = ethers.id("token0");
  const token1 = ethers.id("token1");
  const conditionId = ethers.id("conditionId");

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

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

  describe("Token Registration", function () {
    it("Should allow admin to register token pair", async function () {
      await expect(exchange.connect(owner).registerToken(token0, token1, conditionId))
        .to.emit(exchange, "TokenRegistered")
        .withArgs(token0, token1, conditionId);
    });

    it("Should not allow non-admin to register token", async function () {
      await expect(
        exchange.connect(user).registerToken(token0, token1, conditionId)
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should store condition ID correctly after registration", async function () {
      await exchange.connect(owner).registerToken(token0, token1, conditionId);

      expect(await exchange.getConditionId(token0)).to.equal(conditionId);
      expect(await exchange.getConditionId(token1)).to.equal(conditionId);
    });

    it("Should store complement correctly after registration", async function () {
      await exchange.connect(owner).registerToken(token0, token1, conditionId);

      expect(await exchange.getComplement(token0)).to.equal(token1);
      expect(await exchange.getComplement(token1)).to.equal(token0);
    });

    it("Should not allow registering same token pair twice", async function () {
      await exchange.connect(owner).registerToken(token0, token1, conditionId);

      await expect(
        exchange.connect(owner).registerToken(token0, token1, conditionId)
      ).to.be.revertedWithCustomError(exchange, "AlreadyRegistered");
    });

    it("Should not allow registering with token0 == token1", async function () {
      await expect(
        exchange.connect(owner).registerToken(token0, token0, conditionId)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");
    });

    it("Should not allow registering with zero token IDs", async function () {
      const zeroToken = ethers.ZeroHash;

      await expect(
        exchange.connect(owner).registerToken(zeroToken, token1, conditionId)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");

      await expect(
        exchange.connect(owner).registerToken(token0, zeroToken, conditionId)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");
    });

    it("Should allow registering with any condition ID", async function () {
      // Any bytes32 value should be accepted as condition ID
      const zeroCondition = ethers.ZeroHash;

      await expect(
        exchange.connect(owner).registerToken(token0, token1, zeroCondition)
      ).to.emit(exchange, "TokenRegistered");

      expect(await exchange.getConditionId(token0)).to.equal(zeroCondition);
    });
  });

  describe("Token Validation", function () {
    beforeEach(async function () {
      // Register a token pair for validation tests
      await exchange.connect(owner).registerToken(token0, token1, conditionId);
    });

    it("Should validate registered token without reverting", async function () {
      await expect(exchange.validateTokenId(token0)).to.not.be.reverted;
      await expect(exchange.validateTokenId(token1)).to.not.be.reverted;
    });

    it("Should revert when validating unregistered token", async function () {
      const unregisteredToken = ethers.id("unregistered");

      await expect(
        exchange.validateTokenId(unregisteredToken)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");
    });

    it("Should validate complement pair correctly", async function () {
      await expect(exchange.validateComplement(token0, token1)).to.not.be.reverted;
      await expect(exchange.validateComplement(token1, token0)).to.not.be.reverted;
    });

    it("Should revert when complement is incorrect", async function () {
      const wrongComplement = ethers.id("wrong");

      await expect(
        exchange.validateComplement(token0, wrongComplement)
      ).to.be.revertedWithCustomError(exchange, "InvalidComplement");
    });
  });

  describe("Condition ID Retrieval", function () {
    beforeEach(async function () {
      await exchange.connect(owner).registerToken(token0, token1, conditionId);
    });

    it("Should return correct condition ID for registered tokens", async function () {
      expect(await exchange.getConditionId(token0)).to.equal(conditionId);
      expect(await exchange.getConditionId(token1)).to.equal(conditionId);
    });

    it("Should return zero for unregistered tokens", async function () {
      const unregisteredToken = ethers.id("unregistered");

      expect(await exchange.getConditionId(unregisteredToken)).to.equal(ethers.ZeroHash);
    });
  });

  describe("Complement Retrieval", function () {
    beforeEach(async function () {
      await exchange.connect(owner).registerToken(token0, token1, conditionId);
    });

    it("Should return correct complement for registered tokens", async function () {
      expect(await exchange.getComplement(token0)).to.equal(token1);
      expect(await exchange.getComplement(token1)).to.equal(token0);
    });

    it("Should revert when getting complement for unregistered token", async function () {
      const unregisteredToken = ethers.id("unregistered");

      // getComplement calls validateTokenId which will revert for unregistered tokens
      await expect(
        exchange.getComplement(unregisteredToken)
      ).to.be.revertedWithCustomError(exchange, "InvalidTokenId");
    });
  });

  describe("Multiple Token Pair Registration", function () {
    it("Should allow registering multiple token pairs", async function () {
      const token2 = ethers.id("token2");
      const token3 = ethers.id("token3");
      const conditionId2 = ethers.id("conditionId2");

      await exchange.connect(owner).registerToken(token0, token1, conditionId);
      await exchange.connect(owner).registerToken(token2, token3, conditionId2);

      // Verify first pair
      expect(await exchange.getConditionId(token0)).to.equal(conditionId);
      expect(await exchange.getComplement(token0)).to.equal(token1);

      // Verify second pair
      expect(await exchange.getConditionId(token2)).to.equal(conditionId2);
      expect(await exchange.getComplement(token2)).to.equal(token3);
    });

    it("Should not allow cross-pair complement confusion", async function () {
      const token2 = ethers.id("token2");
      const token3 = ethers.id("token3");
      const conditionId2 = ethers.id("conditionId2");

      await exchange.connect(owner).registerToken(token0, token1, conditionId);
      await exchange.connect(owner).registerToken(token2, token3, conditionId2);

      // token0 and token2 should not be complements
      await expect(
        exchange.validateComplement(token0, token2)
      ).to.be.revertedWithCustomError(exchange, "InvalidComplement");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large token IDs", async function () {
      const largeToken0 = ethers.MaxUint256;
      const largeToken1 = ethers.MaxUint256 - 1n;

      await expect(
        exchange.connect(owner).registerToken(largeToken0, largeToken1, conditionId)
      ).to.emit(exchange, "TokenRegistered");

      expect(await exchange.getComplement(largeToken0)).to.equal(largeToken1);
    });

    it("Should emit correct event parameters", async function () {
      const tx = await exchange.connect(owner).registerToken(token0, token1, conditionId);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokenRegistered"
      );

      expect(event).to.not.be.undefined;
    });
  });
});
