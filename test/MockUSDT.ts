import { expect } from "chai";
import { ethers } from "hardhat";

describe("MockUSDT", function () {
  let MockUSDT;
  let mockUSDT: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await mockUSDT.name()).to.equal("Mock Tether USD");
      expect(await mockUSDT.symbol()).to.equal("USDT");
    });

    it("Should have zero initial supply", async function () {
      expect(await mockUSDT.totalSupply()).to.equal(0);
    });

    it("Should assign the deployer as the owner", async function () {
      expect(await mockUSDT.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow the owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6); // USDT typically has 6 decimals
      await mockUSDT.mint(addr1.address, mintAmount);
      expect(await mockUSDT.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await mockUSDT.totalSupply()).to.equal(mintAmount);
    });

    it("Should emit a Transfer event on mint", async function () {
      const mintAmount = ethers.parseUnits("500", 6);
      await expect(mockUSDT.mint(addr1.address, mintAmount))
        .to.emit(mockUSDT, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, mintAmount);
    });

    it("Should not allow non-owners to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("100", 6);
      await expect(mockUSDT.connect(addr1).mint(addr1.address, mintAmount))
        .to.be.revertedWithCustomError(mockUSDT, "OwnableUnauthorizedAccount")
        .withArgs(addr1.address);
    });
  });

  describe("ERC20 Standard Functions", function () {
    beforeEach(async function () {
      const initialMint = ethers.parseUnits("10000", 6);
      await mockUSDT.mint(owner.address, initialMint);
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      await mockUSDT.transfer(addr1.address, transferAmount);
      expect(await mockUSDT.balanceOf(owner.address)).to.equal(ethers.parseUnits("9900", 6));
      expect(await mockUSDT.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should approve and transferFrom tokens", async function () {
      const approveAmount = ethers.parseUnits("200", 6);
      const transferFromAmount = ethers.parseUnits("150", 6);

      await mockUSDT.approve(addr1.address, approveAmount);
      expect(await mockUSDT.allowance(owner.address, addr1.address)).to.equal(approveAmount);

      await mockUSDT.connect(addr1).transferFrom(owner.address, addr2.address, transferFromAmount);
      expect(await mockUSDT.balanceOf(owner.address)).to.equal(ethers.parseUnits("9850", 6));
      expect(await mockUSDT.balanceOf(addr2.address)).to.equal(transferFromAmount);
      expect(await mockUSDT.allowance(owner.address, addr1.address)).to.equal(ethers.parseUnits("50", 6));
    });
  });
});
