import { expect } from "chai";
import { ethers } from "hardhat";
import { MarketFactory, ResolutionOracle, AleaToken, ConditionalTokens } from "../../typechain-types";

/**
 * @title Market Flow Integration Test (Alea Token - 18 decimals)
 * @notice Tests the complete prediction market flow from creation to resolution
 * @dev This test simulates a real-world scenario of a prediction market using Alea token
 */
describe("Market Flow Integration Test (Alea)", function () {
  let marketFactory: MarketFactory;
  let resolutionOracle: ResolutionOracle;
  let aleaToken: AleaToken;
  let conditionalTokens: ConditionalTokens;

  let owner: any;
  let creator: any;
  let trader1: any;
  let trader2: any;
  let resolver: any;

  // Alea token uses 18 decimals
  const DECIMALS = 18;

  // Test market parameters
  const questionId = ethers.keccak256(ethers.toUtf8Bytes("Will Bitcoin reach $100k in 2024?"));
  const question = "Will Bitcoin reach $100k in 2024?";
  const description = "A prediction market on Bitcoin's price reaching $100,000 by the end of 2024";
  const category = "Cryptocurrency";
  const endTime = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
  const resolutionTime = endTime + 3600; // 1 hour after end

  beforeEach(async function () {
    [owner, creator, trader1, trader2, resolver] = await ethers.getSigners();

    // Deploy Alea token
    const AleaTokenFactory = await ethers.getContractFactory("AleaToken");
    aleaToken = await AleaTokenFactory.deploy();
    await aleaToken.waitForDeployment();

    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = await ConditionalTokensFactory.deploy();
    await conditionalTokens.waitForDeployment();

    // Deploy ResolutionOracle
    const ResolutionOracleFactory = await ethers.getContractFactory("ResolutionOracle");
    resolutionOracle = await ResolutionOracleFactory.deploy(await conditionalTokens.getAddress());
    await resolutionOracle.waitForDeployment();

    // Deploy MarketFactory
    const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactoryFactory.deploy(
      await conditionalTokens.getAddress(),
      await aleaToken.getAddress(),
      await resolutionOracle.getAddress()
    );
    await marketFactory.waitForDeployment();

    // Add resolver
    await resolutionOracle.addResolver(resolver.address);

    // Mint Alea tokens to traders for testing (18 decimals)
    await aleaToken.mintForTesting(trader1.address, ethers.parseUnits("10000", DECIMALS)); // 10,000 ALEA
    await aleaToken.mintForTesting(trader2.address, ethers.parseUnits("10000", DECIMALS)); // 10,000 ALEA
    await aleaToken.mintForTesting(await conditionalTokens.getAddress(), ethers.parseUnits("1000000", DECIMALS)); // 1M ALEA for CTF
  });

  describe("Complete Market Flow", function () {
    it("Should execute complete market lifecycle: Create → Trade → Resolve → Redeem", async function () {
      console.log("\n🚀 Starting Complete Market Flow Test (Alea Token)");
      console.log("==================================================");

      // Step 1: Create Market
      console.log("\n📝 Step 1: Creating Prediction Market");
      const createTx = await marketFactory.connect(creator).createBinaryMarket(
        questionId,
        question,
        description,
        category,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        questionId,
        2
      );

      const market = await marketFactory.getMarket(conditionId);
      console.log("✅ Market created successfully");
      console.log(`   Condition ID: ${conditionId}`);
      console.log(`   Question: ${market.question}`);
      console.log(`   Creator: ${market.creator}`);

      // Step 2: Simulate Trading
      console.log("\n💰 Step 2: Simulating Trading Activity");
      const tradeAmount = ethers.parseUnits("1000", DECIMALS);

      // Trader1 buys YES position
      await aleaToken.connect(trader1).approve(await conditionalTokens.getAddress(), tradeAmount);
      await conditionalTokens.connect(trader1).splitPosition(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        tradeAmount
      );
      console.log("✅ Trader1 split position (1000 ALEA)");

      // Trader2 buys NO position
      await aleaToken.connect(trader2).approve(await conditionalTokens.getAddress(), tradeAmount);
      await conditionalTokens.connect(trader2).splitPosition(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [1, 2],
        tradeAmount
      );
      console.log("✅ Trader2 split position (1000 ALEA)");

      // Step 3: Resolve Market (YES wins)
      console.log("\n⚖️ Step 3: Resolving Market (YES wins)");
      await resolutionOracle.connect(resolver).proposeResolution(questionId, 2, [100, 0]);
      console.log("✅ Resolution proposed");

      // Fast forward past dispute period
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);
      await ethers.provider.send("evm_mine", []);

      await resolutionOracle.connect(resolver).finalizeResolution(questionId, 2);
      console.log("✅ Resolution finalized");

      // Step 4: Redeem tokens and verify results
      console.log("\n💎 Step 4: Redeeming Positions");
      const trader1AleaBefore = await aleaToken.balanceOf(trader1.address);
      const trader2AleaBefore = await aleaToken.balanceOf(trader2.address);

      await conditionalTokens.connect(trader1).redeemPositions(aleaToken, ethers.ZeroHash, conditionId, [1]);
      await conditionalTokens.connect(trader2).redeemPositions(aleaToken, ethers.ZeroHash, conditionId, [2]);

      const trader1AleaAfter = await aleaToken.balanceOf(trader1.address);
      const trader2AleaAfter = await aleaToken.balanceOf(trader2.address);

      console.log("✅ Positions redeemed successfully");

      // Verify results
      expect(await resolutionOracle.isResolved(conditionId)).to.be.true;

      expect(trader1AleaAfter).to.be.gte(trader1AleaBefore);
      expect(trader2AleaAfter).to.be.gte(trader2AleaBefore);
      expect(await conditionalTokens.balanceOf(trader1.address, market.tokenIds[0])).to.equal(0);
      expect(await conditionalTokens.balanceOf(trader2.address, market.tokenIds[1])).to.equal(0);

      console.log("\n🎉 Complete Market Flow Test Passed (Alea Token)!");
      console.log("==================================================");
    });

    it("Should handle market cancellation flow", async function () {
      console.log("\n🚫 Testing Market Cancellation Flow (Alea)");
      console.log("==========================================");

      // Create market
      const createTx = await marketFactory.connect(creator).createBinaryMarket(
        questionId,
        question,
        description,
        category,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        questionId,
        2
      );

      // Cancel market
      const cancelTx = await marketFactory.connect(creator).cancelMarket(conditionId);
      await cancelTx.wait();

      const market = await marketFactory.getMarket(conditionId);
      expect(market.status).to.equal(3); // MarketStatus.Canceled

      console.log("✅ Market cancelled successfully");
    });

    it("Should handle market closing flow", async function () {
      console.log("\n🔒 Testing Market Closing Flow (Alea)");
      console.log("=====================================");

      // Create market
      const createTx = await marketFactory.connect(creator).createBinaryMarket(
        questionId,
        question,
        description,
        category,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        questionId,
        2
      );

      // Close market
      const closeTx = await marketFactory.connect(creator).closeMarket(conditionId);
      await closeTx.wait();

      const market = await marketFactory.getMarket(conditionId);
      expect(market.status).to.equal(1); // MarketStatus.Closed

      console.log("✅ Market closed successfully");
    });

    it("Should handle multiple choice market creation", async function () {
      console.log("\n📊 Testing Multiple Choice Market Creation (Alea)");
      console.log("=================================================");

      const multiQuestionId = ethers.keccak256(ethers.toUtf8Bytes("Who will win the 2024 election?"));
      const multiQuestion = "Who will win the 2024 election?";
      const multiDescription = "A prediction market on the 2024 presidential election";
      const multiCategory = "Politics";
      const outcomeCount = 3;

      const createTx = await marketFactory.connect(creator).createMultipleChoiceMarket(
        multiQuestionId,
        multiQuestion,
        multiDescription,
        multiCategory,
        outcomeCount,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        multiQuestionId,
        outcomeCount
      );

      const market = await marketFactory.getMarket(conditionId);
      expect(market.outcomeSlotCount).to.equal(outcomeCount);
      expect(market.question).to.equal(multiQuestion);

      console.log("✅ Multiple choice market created successfully");
    });

    it("Should handle dispute resolution flow", async function () {
      console.log("\n⚖️ Testing Dispute Resolution Flow (Alea)");
      console.log("=========================================");

      // Create market
      const createTx = await marketFactory.connect(creator).createBinaryMarket(
        questionId,
        question,
        description,
        category,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        questionId,
        2
      );

      // Propose resolution
      await resolutionOracle.connect(resolver).proposeResolution(
        questionId,
        2,
        [100, 0] // YES wins
      );
      console.log("✅ Resolution proposed");

      // Check that dispute is possible
      expect(await resolutionOracle.canDispute(conditionId)).to.be.true;
      console.log("✅ Dispute period is active");

      // Dispute resolution
      const disputeTx = await resolutionOracle.connect(trader1).disputeResolution(
        questionId,
        2
      );
      await disputeTx.wait();

      const resolution = await resolutionOracle.getResolution(conditionId);
      expect(resolution.status).to.equal(2); // ResolutionStatus.Disputed

      console.log("✅ Resolution disputed successfully");
    });

    it("Should handle admin finalization flow", async function () {
      console.log("\n👑 Testing Admin Finalization Flow (Alea)");
      console.log("=========================================");

      const adminQuestionId = ethers.keccak256(ethers.toUtf8Bytes("Admin test question"));

      // Create market
      const createTx = await marketFactory.connect(creator).createBinaryMarket(
        adminQuestionId,
        "Admin test question",
        "Test description",
        "Test",
        endTime,
        resolutionTime
      );
      await createTx.wait();

      // Admin immediately finalizes resolution (bypasses dispute period)
      await resolutionOracle.adminFinalizeResolution(
        adminQuestionId,
        2,
        [100, 0] // YES wins
      );

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        adminQuestionId,
        2
      );

      const resolution = await resolutionOracle.getResolution(conditionId);
      expect(resolution.status).to.equal(3); // ResolutionStatus.Finalized
      expect(await resolutionOracle.isResolved(conditionId)).to.be.true;

      console.log("✅ Admin finalization successful");
    });

    it("Should handle complex Fed rate market with 6 outcomes", async function () {
      console.log("\n🏦 Testing Complex Fed Rate Market (6 Outcomes, Alea)");
      console.log("=====================================================");

      const fedQuestionId = ethers.keccak256(ethers.toUtf8Bytes("What will the Fed do with interest rates in December 2024?"));
      const fedQuestion = "What will the Fed do with interest rates in December 2024?";
      const fedDescription = "A prediction market on Federal Reserve interest rate decisions";
      const fedCategory = "Economics";
      const outcomeCount = 6;

      // Create 6-outcome market
      const createTx = await marketFactory.connect(creator).createMultipleChoiceMarket(
        fedQuestionId,
        fedQuestion,
        fedDescription,
        fedCategory,
        outcomeCount,
        endTime,
        resolutionTime
      );
      await createTx.wait();

      const conditionId = await conditionalTokens.getConditionId(
        await resolutionOracle.getAddress(),
        fedQuestionId,
        outcomeCount
      );

      const market = await marketFactory.getMarket(conditionId);
      console.log(`✅ Fed rate market created with ${market.outcomeSlotCount} outcomes`);

      // Trader1: Hedges on all cut scenarios (outcomes 1, 2, 3)
      const hedgeAmount = ethers.parseUnits("2000", DECIMALS);
      await aleaToken.connect(trader1).approve(await conditionalTokens.getAddress(), hedgeAmount);

      await conditionalTokens.connect(trader1).splitPosition(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [1, 2, 3], // Cut by 50bp+, 25bp, or <25bp
        hedgeAmount
      );
      console.log("✅ Trader1 hedged on all cut scenarios");

      // Trader2: Bets on specific outcome (25bp cut - outcome 2)
      const betAmount = ethers.parseUnits("1000", DECIMALS);
      await aleaToken.connect(trader2).approve(await conditionalTokens.getAddress(), betAmount);

      await conditionalTokens.connect(trader2).splitPosition(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [2], // Only 25bp cut
        betAmount
      );
      console.log("✅ Trader2 bet on 25bp cut specifically");

      // Resolve: Fed cuts by 30bp (outcome 3 wins - cut by <25bp)
      console.log("\n⚖️ Resolving: Fed cuts by 30bp (outcome 3 wins)");
      await resolutionOracle.connect(resolver).proposeResolution(
        fedQuestionId,
        outcomeCount,
        [0, 0, 100, 0, 0, 0] // 100% to outcome 3
      );

      // Fast forward past dispute period
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);
      await ethers.provider.send("evm_mine", []);

      await resolutionOracle.connect(resolver).finalizeResolution(fedQuestionId, outcomeCount);
      console.log("✅ Market resolved: outcome 3 (cut <25bp) wins");

      // Check results
      const trader1BalanceBefore = await aleaToken.balanceOf(trader1.address);
      const trader2BalanceBefore = await aleaToken.balanceOf(trader2.address);

      // Redeem positions
      await conditionalTokens.connect(trader1).redeemPositions(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [1, 2, 3]
      );
      await conditionalTokens.connect(trader2).redeemPositions(
        aleaToken,
        ethers.ZeroHash,
        conditionId,
        [2]
      );

      const trader1BalanceAfter = await aleaToken.balanceOf(trader1.address);
      const trader2BalanceAfter = await aleaToken.balanceOf(trader2.address);

      console.log(`✅ Trader1 (hedge): ${ethers.formatUnits(trader1BalanceAfter - trader1BalanceBefore, DECIMALS)} ALEA`);
      console.log(`✅ Trader2 (specific bet): ${ethers.formatUnits(trader2BalanceAfter - trader2BalanceBefore, DECIMALS)} ALEA`);

      expect(trader1BalanceAfter).to.be.gte(trader1BalanceBefore);
      expect(trader2BalanceAfter).to.equal(trader2BalanceBefore);
    });
  });
});
