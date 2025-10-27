import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Creating test prediction market...");

  const [deployer, user1, user2] = await ethers.getSigners();
  
  // Get deployed contracts (replace with actual addresses from deployment)
  const marketFactoryAddress = "0x..."; // Replace with actual address
  const resolutionOracleAddress = "0x..."; // Replace with actual address
  
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = MarketFactory.attach(marketFactoryAddress);

  const ResolutionOracle = await ethers.getContractFactory("ResolutionOracle");
  const resolutionOracle = ResolutionOracle.attach(resolutionOracleAddress);

  // Create a test binary market
  const questionId = ethers.keccak256(ethers.toUtf8Bytes("Will Bitcoin reach $100k in 2024?"));
  const question = "Will Bitcoin reach $100k in 2024?";
  const description = "A prediction market on Bitcoin's price reaching $100,000 by the end of 2024";
  const category = "Cryptocurrency";
  const endTime = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
  const resolutionTime = endTime + 3600; // 1 hour after end

  console.log("Creating market:", question);
  console.log("End time:", new Date(endTime * 1000).toISOString());
  console.log("Resolution time:", new Date(resolutionTime * 1000).toISOString());

  const tx = await marketFactory.createBinaryMarket(
    questionId,
    question,
    description,
    category,
    endTime,
    resolutionTime
  );

  const receipt = await tx.wait();
  console.log("✅ Market created successfully!");
  console.log("Transaction hash:", tx.hash);

  // Get market info
  const conditionId = await marketFactory.ctf().getConditionId(
    await marketFactory.oracle(),
    questionId,
    2
  );

  const market = await marketFactory.getMarket(conditionId);
  console.log("\n📊 Market Details:");
  console.log("Condition ID:", conditionId);
  console.log("Question:", market.question);
  console.log("Description:", market.description);
  console.log("Category:", market.category);
  console.log("Outcome Slot Count:", market.outcomeSlotCount.toString());
  console.log("Token IDs:", market.tokenIds.map(id => id.toString()));
  console.log("Status:", market.status.toString());
  console.log("Creator:", market.creator);

  // Create a test multiple choice market
  console.log("\n🎯 Creating multiple choice market...");
  
  const multiQuestionId = ethers.keccak256(ethers.toUtf8Bytes("Who will win the 2024 US Election?"));
  const multiQuestion = "Who will win the 2024 US Election?";
  const multiDescription = "A prediction market on the 2024 US Presidential Election";
  const multiCategory = "Politics";
  const multiOutcomeSlotCount = 3;
  const multiEndTime = Math.floor(Date.now() / 1000) + 86400 * 60; // 60 days from now
  const multiResolutionTime = multiEndTime + 3600;

  const multiTx = await marketFactory.createMultipleChoiceMarket(
    multiQuestionId,
    multiQuestion,
    multiDescription,
    multiCategory,
    multiOutcomeSlotCount,
    multiEndTime,
    multiResolutionTime
  );

  const multiReceipt = await multiTx.wait();
  console.log("✅ Multiple choice market created successfully!");
  console.log("Transaction hash:", multiTx.hash);

  const multiConditionId = await marketFactory.ctf().getConditionId(
    await marketFactory.oracle(),
    multiQuestionId,
    multiOutcomeSlotCount
  );

  const multiMarket = await marketFactory.getMarket(multiConditionId);
  console.log("\n📊 Multiple Choice Market Details:");
  console.log("Condition ID:", multiConditionId);
  console.log("Question:", multiMarket.question);
  console.log("Outcome Slot Count:", multiMarket.outcomeSlotCount.toString());
  console.log("Token IDs:", multiMarket.tokenIds.map(id => id.toString()));

  console.log("\n🎉 Test markets created successfully!");
  console.log("\nNext steps:");
  console.log("1. Test trading functionality");
  console.log("2. Test market resolution");
  console.log("3. Test token redemption");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });