import { expect } from "chai";
import { ethers } from "hardhat";
import { AleaToken } from "../../typechain-types";

describe("AleaToken", function () {
  let aleaToken: AleaToken;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const AleaTokenFactory = await ethers.getContractFactory("AleaToken");
    aleaToken = await AleaTokenFactory.deploy();
    await aleaToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await aleaToken.name()).to.equal("Alea");
      expect(await aleaToken.symbol()).to.equal("ALEA");
    });

    it("Should set the correct decimals (18)", async function () {
      expect(await aleaToken.decimals()).to.equal(18);
    });

    it("Should set the correct owner", async function () {
      expect(await aleaToken.owner()).to.equal(owner.address);
    });

    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await aleaToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.parseUnits("1000000000", 18));
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 18);
      await aleaToken.mint(user1.address, amount);

      const balance = await aleaToken.balanceOf(user1.address);
      expect(balance).to.equal(amount);
    });

    it("Should allow anyone to mint for testing", async function () {
      const amount = ethers.parseUnits("500", 18);
      await aleaToken.connect(user1).mintForTesting(user2.address, amount);

      const balance = await aleaToken.balanceOf(user2.address);
      expect(balance).to.equal(amount);
    });

    it("Should revert when non-owner tries to mint", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await expect(
        aleaToken.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(aleaToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC20 Functionality", function () {
    const amount = ethers.parseUnits("1000", 18);

    beforeEach(async function () {
      // Mint tokens to user1
      await aleaToken.mintForTesting(user1.address, amount);
    });

    it("Should transfer tokens correctly", async function () {
      await aleaToken.connect(user1).transfer(user2.address, amount);

      expect(await aleaToken.balanceOf(user1.address)).to.equal(0);
      expect(await aleaToken.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should approve and transferFrom correctly", async function () {
      await aleaToken.connect(user1).approve(user2.address, amount);

      const allowance = await aleaToken.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);

      await aleaToken.connect(user2).transferFrom(user1.address, user2.address, amount);

      expect(await aleaToken.balanceOf(user1.address)).to.equal(0);
      expect(await aleaToken.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should revert when transferring more than balance", async function () {
      const excessAmount = ethers.parseUnits("2000", 18);

      await expect(
        aleaToken.connect(user1).transfer(user2.address, excessAmount)
      ).to.be.revertedWithCustomError(aleaToken, "ERC20InsufficientBalance");
    });

    it("Should revert when transferring from insufficient allowance", async function () {
      const allowance = ethers.parseUnits("500", 18);
      await aleaToken.connect(user1).approve(user2.address, allowance);

      await expect(
        aleaToken.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(aleaToken, "ERC20InsufficientAllowance");
    });
  });

  describe("Events", function () {
    it("Should emit Transfer event on mint", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await expect(aleaToken.mint(user1.address, amount))
        .to.emit(aleaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, amount);
    });

    it("Should emit Transfer event on transfer", async function () {
      const amount = ethers.parseUnits("1000", 18);
      await aleaToken.mintForTesting(user1.address, amount);

      await expect(aleaToken.connect(user1).transfer(user2.address, amount))
        .to.emit(aleaToken, "Transfer")
        .withArgs(user1.address, user2.address, amount);
    });

    it("Should emit Approval event on approve", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await expect(aleaToken.connect(user1).approve(user2.address, amount))
        .to.emit(aleaToken, "Approval")
        .withArgs(user1.address, user2.address, amount);
    });
  });
});
