import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../../typechain-types";

describe("MockUSDC", function () {
  let mockUSDC: MockUSDC;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
      expect(await mockUSDC.symbol()).to.equal("mUSDC");
    });

    it("Should set the correct decimals", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("Should set the correct owner", async function () {
      expect(await mockUSDC.owner()).to.equal(owner.address);
    });

    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await mockUSDC.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.parseUnits("1000000", 6));
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, amount);
      
      const balance = await mockUSDC.balanceOf(user1.address);
      expect(balance).to.equal(amount);
    });

    it("Should allow anyone to mint for testing", async function () {
      const amount = ethers.parseUnits("500", 6);
      await mockUSDC.connect(user1).mintForTesting(user2.address, amount);
      
      const balance = await mockUSDC.balanceOf(user2.address);
      expect(balance).to.equal(amount);
    });

    it("Should revert when non-owner tries to mint", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(
        mockUSDC.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(mockUSDC, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC20 Functionality", function () {
    const amount = ethers.parseUnits("1000", 6);

    beforeEach(async function () {
      // Mint tokens to user1
      await mockUSDC.mintForTesting(user1.address, amount);
    });

    it("Should transfer tokens correctly", async function () {
      await mockUSDC.connect(user1).transfer(user2.address, amount);
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should approve and transferFrom correctly", async function () {
      await mockUSDC.connect(user1).approve(user2.address, amount);
      
      const allowance = await mockUSDC.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);
      
      await mockUSDC.connect(user2).transferFrom(user1.address, user2.address, amount);
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should revert when transferring more than balance", async function () {
      const excessAmount = ethers.parseUnits("2000", 6);
      
      await expect(
        mockUSDC.connect(user1).transfer(user2.address, excessAmount)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientBalance");
    });

    it("Should revert when transferring from insufficient allowance", async function () {
      const allowance = ethers.parseUnits("500", 6);
      await mockUSDC.connect(user1).approve(user2.address, allowance);
      
      await expect(
        mockUSDC.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(mockUSDC, "ERC20InsufficientAllowance");
    });
  });

  describe("Events", function () {
    it("Should emit Transfer event on mint", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(mockUSDC.mint(user1.address, amount))
        .to.emit(mockUSDC, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, amount);
    });

    it("Should emit Transfer event on transfer", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mintForTesting(user1.address, amount);
      
      await expect(mockUSDC.connect(user1).transfer(user2.address, amount))
        .to.emit(mockUSDC, "Transfer")
        .withArgs(user1.address, user2.address, amount);
    });

    it("Should emit Approval event on approve", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(mockUSDC.connect(user1).approve(user2.address, amount))
        .to.emit(mockUSDC, "Approval")
        .withArgs(user1.address, user2.address, amount);
    });
  });
});
