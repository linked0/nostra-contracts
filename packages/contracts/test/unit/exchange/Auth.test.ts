import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../../typechain-types";

describe("CTFExchange - Auth", function () {
  let exchange: CTFExchange;
  let owner: any;
  let operator: any;
  let admin: any;
  let user: any;
  let conditionalTokens: any;
  let collateralToken: any;

  beforeEach(async function () {
    [owner, operator, admin, user] = await ethers.getSigners();

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

  describe("Initial State", function () {
    it("Should set deployer as admin", async function () {
      expect(await exchange.isAdmin(owner.address)).to.equal(true);
    });

    it("Should set deployer as operator", async function () {
      expect(await exchange.isOperator(owner.address)).to.equal(true);
    });

    it("Should not set random user as admin", async function () {
      expect(await exchange.isAdmin(user.address)).to.equal(false);
    });

    it("Should not set random user as operator", async function () {
      expect(await exchange.isOperator(user.address)).to.equal(false);
    });
  });

  describe("Admin Management", function () {
    it("Should allow admin to add new admin", async function () {
      await expect(exchange.connect(owner).addAdmin(admin.address))
        .to.emit(exchange, "NewAdmin")
        .withArgs(admin.address, owner.address);

      expect(await exchange.isAdmin(admin.address)).to.equal(true);
    });

    it("Should not allow non-admin to add admin", async function () {
      await expect(
        exchange.connect(user).addAdmin(admin.address)
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should allow admin to remove admin", async function () {
      await exchange.connect(owner).addAdmin(admin.address);

      await expect(exchange.connect(owner).removeAdmin(admin.address))
        .to.emit(exchange, "RemovedAdmin")
        .withArgs(admin.address, owner.address);

      expect(await exchange.isAdmin(admin.address)).to.equal(false);
    });

    it("Should not allow non-admin to remove admin", async function () {
      await exchange.connect(owner).addAdmin(admin.address);

      await expect(
        exchange.connect(user).removeAdmin(admin.address)
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should allow admin to renounce admin role", async function () {
      await expect(exchange.connect(owner).renounceAdminRole())
        .to.emit(exchange, "RemovedAdmin")
        .withArgs(owner.address, owner.address);

      expect(await exchange.isAdmin(owner.address)).to.equal(false);
    });
  });

  describe("Operator Management", function () {
    it("Should allow admin to add operator", async function () {
      await expect(exchange.connect(owner).addOperator(operator.address))
        .to.emit(exchange, "NewOperator")
        .withArgs(operator.address, owner.address);

      expect(await exchange.isOperator(operator.address)).to.equal(true);
    });

    it("Should not allow non-admin to add operator", async function () {
      await expect(
        exchange.connect(user).addOperator(operator.address)
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should allow admin to remove operator", async function () {
      await exchange.connect(owner).addOperator(operator.address);

      await expect(exchange.connect(owner).removeOperator(operator.address))
        .to.emit(exchange, "RemovedOperator")
        .withArgs(operator.address, owner.address);

      expect(await exchange.isOperator(operator.address)).to.equal(false);
    });

    it("Should not allow non-admin to remove operator", async function () {
      await exchange.connect(owner).addOperator(operator.address);

      await expect(
        exchange.connect(user).removeOperator(operator.address)
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should allow operator to renounce operator role", async function () {
      await exchange.connect(owner).addOperator(operator.address);

      await expect(exchange.connect(operator).renounceOperatorRole())
        .to.emit(exchange, "RemovedOperator")
        .withArgs(operator.address, operator.address);

      expect(await exchange.isOperator(operator.address)).to.equal(false);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause trading", async function () {
      await expect(exchange.connect(owner).pauseTrading())
        .to.emit(exchange, "TradingPaused")
        .withArgs(owner.address);
    });

    it("Should not allow non-admin to pause trading", async function () {
      await expect(
        exchange.connect(user).pauseTrading()
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });

    it("Should allow admin to unpause trading", async function () {
      await exchange.connect(owner).pauseTrading();

      await expect(exchange.connect(owner).unpauseTrading())
        .to.emit(exchange, "TradingUnpaused")
        .withArgs(owner.address);
    });

    it("Should not allow non-admin to unpause trading", async function () {
      await exchange.connect(owner).pauseTrading();

      await expect(
        exchange.connect(user).unpauseTrading()
      ).to.be.revertedWithCustomError(exchange, "NotAdmin");
    });
  });
});
