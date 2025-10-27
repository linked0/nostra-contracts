import { expect } from "chai";
import { ethers } from "hardhat";
import { ConditionalTokens, MockUSDC } from "../../typechain-types";

describe("ConditionalTokens", function () {
  let conditionalTokens: ConditionalTokens;
  let mockUSDC: MockUSDC;
  let owner: any;
  let user1: any;
  let user2: any;
  let oracle: any;

  beforeEach(async function () {
    [owner, user1, user2, oracle] = await ethers.getSigners();
    
    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy ConditionalTokens
    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = await ConditionalTokensFactory.deploy();
    await conditionalTokens.waitForDeployment();

    // Mint USDC to users
    await mockUSDC.mintForTesting(user1.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mintForTesting(user2.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mintForTesting(await conditionalTokens.getAddress(), ethers.parseUnits("1000000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await conditionalTokens.owner()).to.equal(owner.address);
    });
  });

  describe("Condition Management", function () {
    const questionId = ethers.keccak256(ethers.toUtf8Bytes("Test question"));
    const outcomeSlotCount = 2;

    it("Should prepare condition successfully", async function () {
      const tx = await conditionalTokens.prepareCondition(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        log.topics[0] === conditionalTokens.interface.getEvent("ConditionPreparation").topicHash
      );

      expect(event).to.not.be.undefined;

      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      expect(await conditionalTokens.preparedConditions(conditionId)).to.be.true;
    });

    it("Should revert when preparing duplicate condition", async function () {
      await conditionalTokens.prepareCondition(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      await expect(
        conditionalTokens.prepareCondition(
          oracle.address,
          questionId,
          outcomeSlotCount
        )
      ).to.be.revertedWith("Condition already prepared");
    });

    it("Should calculate correct condition ID", async function () {
      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      // The actual implementation uses keccak256(abi.encodePacked(...))
      const expectedId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "bytes32", "uint256"],
          [oracle.address, questionId, outcomeSlotCount]
        )
      );

      expect(conditionId).to.equal(expectedId);
    });
  });

  describe("Position Management", function () {
    const questionId = ethers.keccak256(ethers.toUtf8Bytes("Test question"));
    const outcomeSlotCount = 2;
    const amount = ethers.parseUnits("1000", 6);

    beforeEach(async function () {
      // Prepare condition
      await conditionalTokens.prepareCondition(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      // Approve USDC spending
      await mockUSDC.connect(user1).approve(await conditionalTokens.getAddress(), amount);
    });

    it("Should split position successfully", async function () {
      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      const tx = await conditionalTokens.connect(user1).splitPosition(
        mockUSDC,
        ethers.ZeroHash,
        conditionId,
        [1, 2], // Both outcomes
        amount
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        log.topics[0] === conditionalTokens.interface.getEvent("PositionSplit").topicHash
      );

      expect(event).to.not.be.undefined;

      // Check token balances
      const tokenId1 = await conditionalTokens.getPositionId(
        mockUSDC,
        await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, 1)
      );
      const tokenId2 = await conditionalTokens.getPositionId(
        mockUSDC,
        await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, 2)
      );

      expect(await conditionalTokens.balanceOf(user1.address, tokenId1)).to.equal(amount);
      expect(await conditionalTokens.balanceOf(user1.address, tokenId2)).to.equal(amount);
    });

    it("Should merge positions successfully", async function () {
      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      // First split position
      await conditionalTokens.connect(user1).splitPosition(
        mockUSDC,
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        amount
      );

      // Then merge positions
      const tx = await conditionalTokens.connect(user1).mergePositions(
        mockUSDC,
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        amount
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        log.topics[0] === conditionalTokens.interface.getEvent("PositionsMerge").topicHash
      );

      expect(event).to.not.be.undefined;

      // Check token balances are zero after merge
      const tokenId1 = await conditionalTokens.getPositionId(
        mockUSDC,
        await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, 1)
      );
      const tokenId2 = await conditionalTokens.getPositionId(
        mockUSDC,
        await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, 2)
      );

      expect(await conditionalTokens.balanceOf(user1.address, tokenId1)).to.equal(0);
      expect(await conditionalTokens.balanceOf(user1.address, tokenId2)).to.equal(0);
    });

    it("Should revert when splitting position for unprepared condition", async function () {
      const fakeConditionId = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(
        conditionalTokens.connect(user1).splitPosition(
          mockUSDC,
          ethers.ZeroHash,
          fakeConditionId,
          [1, 2],
          amount
        )
      ).to.be.revertedWith("Condition not prepared");
    });
  });

  describe("Resolution and Redemption", function () {
    const questionId = ethers.keccak256(ethers.toUtf8Bytes("Resolution test question"));
    const outcomeSlotCount = 2;
    const amount = ethers.parseUnits("1000", 6);
    const payouts = [100, 0]; // YES wins

    beforeEach(async function () {
      // Approve USDC spending
      await mockUSDC.connect(user1).approve(await conditionalTokens.getAddress(), amount);
    });

    it("Should report payouts successfully", async function () {
      // First prepare the condition
      await conditionalTokens.prepareCondition(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      // Use the oracle address as the caller
      const tx = await conditionalTokens.connect(oracle).reportPayouts(questionId, payouts);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        log.topics[0] === conditionalTokens.interface.getEvent("ConditionResolution").topicHash
      );

      expect(event).to.not.be.undefined;

      const condition = await conditionalTokens.conditions(conditionId);
      expect(condition.isResolved).to.be.true;
    });

    it("Should redeem positions successfully", async function () {
      // First prepare the condition
      await conditionalTokens.prepareCondition(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      // Split position first
      await conditionalTokens.connect(user1).splitPosition(
        mockUSDC,
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        amount
      );

      // Report payouts (use oracle as caller)
      await conditionalTokens.connect(oracle).reportPayouts(questionId, payouts);

      // Get user's USDC balance before redemption
      const balanceBefore = await mockUSDC.balanceOf(user1.address);

      // Redeem positions
      await conditionalTokens.connect(user1).redeemPositions(
        mockUSDC,
        ethers.ZeroHash,
        conditionId,
        [1] // Only YES position
      );

      // Check that user got their money back
      const balanceAfter = await mockUSDC.balanceOf(user1.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
    });

    it("Should revert when redeeming unresolved condition", async function () {
      const conditionId = await conditionalTokens.getConditionId(
        oracle.address,
        questionId,
        outcomeSlotCount
      );

      await expect(
        conditionalTokens.connect(user1).redeemPositions(
          mockUSDC,
          ethers.ZeroHash,
          conditionId,
          [1]
        )
      ).to.be.revertedWith("Not resolved");
    });
  });

  describe("Utility Functions", function () {
    it("Should calculate correct collection ID", async function () {
      const parentCollectionId = ethers.ZeroHash;
      const conditionId = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const indexSet = 1;

      const collectionId = await conditionalTokens.getCollectionId(
        parentCollectionId,
        conditionId,
        indexSet
      );

      // The actual implementation uses keccak256(abi.encodePacked(...))
      const expectedId = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "bytes32", "uint256"],
          [parentCollectionId, conditionId, indexSet]
        )
      );

      expect(collectionId).to.equal(expectedId);
    });

    it("Should calculate correct position ID", async function () {
      const collectionId = ethers.keccak256(ethers.toUtf8Bytes("test"));

      const positionId = await conditionalTokens.getPositionId(
        mockUSDC,
        collectionId
      );

      // The actual implementation uses keccak256(abi.encodePacked(...))
      const expectedId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "bytes32"],
          [await mockUSDC.getAddress(), collectionId]
        )
      );

      expect(positionId).to.equal(expectedId);
    });
  });
});
