import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("InterestDistribution", function () {
    async function deployContractsFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        // Deploy MockUSDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const usdt = await MockUSDT.deploy();

        // Deploy CSI300Token
        const MockOracle = await ethers.getContractFactory("MockOracle");
        const oracle = await MockOracle.deploy();
        const CSI300Token = await ethers.getContractFactory("CSI300Token");
        const csi300Token = await CSI300Token.deploy(await oracle.getAddress());

        // Deploy InterestDistribution
        const InterestDistribution = await ethers.getContractFactory("InterestDistribution");
        const interestDistribution = await InterestDistribution.deploy(await csi300Token.getAddress(), await usdt.getAddress());

        // Mint some CSI300Token for users
        await csi300Token.transfer(user1.address, ethers.parseEther("100"));
        await csi300Token.transfer(user2.address, ethers.parseEther("300"));
        
        // Mint USDT to the InterestDistribution contract for distribution
        await usdt.mint(await interestDistribution.getAddress(), ethers.parseEther("1000"));

        // Transfer ownership of CSI300Token to InterestDistribution contract
        await csi300Token.transferOwnership(await interestDistribution.getAddress());

        return { interestDistribution, csi300Token, usdt, owner, user1, user2 };
    }

    it("Should allow owner to set total interest and create a snapshot", async function () {
        const { interestDistribution, csi300Token } = await loadFixture(deployContractsFixture);
        const totalInterest = ethers.parseEther("1000");

        await expect(interestDistribution.setTotalInterest(totalInterest))
            .to.emit(interestDistribution, "InterestSet")
            .withArgs(totalInterest, 1); // Assuming first snapshot ID is 1
        
        expect(await interestDistribution.totalInterest()).to.equal(totalInterest);
        expect(await interestDistribution.currentSnapshotId()).to.equal(1);
    });

    it("Should allow users to claim interest based on their token balance at snapshot", async function () {
        const { interestDistribution, csi300Token, usdt, user1, user2 } = await loadFixture(deployContractsFixture);
        const totalInterest = ethers.parseEther("1000");
        await interestDistribution.setTotalInterest(totalInterest);

        // Check balances before claiming
        const user1InitialBalance = await usdt.balanceOf(user1.address);
        const user2InitialBalance = await usdt.balanceOf(user2.address);
        expect(user1InitialBalance).to.equal(0);
        expect(user2InitialBalance).to.equal(0);

        // User 1 claims interest
        const snapshotId = await interestDistribution.currentSnapshotId();
        await interestDistribution.connect(user1).claimInterest();
        const user1BalanceAfterClaim = await usdt.balanceOf(user1.address);
        const csiTotalSupply = await csi300Token.totalSupplyAt(snapshotId);
        const user1CSIBalance = await csi300Token.balanceOfAt(user1.address, snapshotId);
        const expectedInterest1 = (user1CSIBalance * totalInterest) / csiTotalSupply;
        expect(user1BalanceAfterClaim).to.equal(expectedInterest1);

        // User 2 claims interest
        await interestDistribution.connect(user2).claimInterest();
        const user2BalanceAfterClaim = await usdt.balanceOf(user2.address);
        const user2CSIBalance = await csi300Token.balanceOfAt(user2.address, snapshotId);
        const expectedInterest2 = (user2CSIBalance * totalInterest) / csiTotalSupply;
        expect(user2BalanceAfterClaim).to.equal(expectedInterest2);
    });

    it("Should prevent users from claiming interest twice", async function () {
        const { interestDistribution, user1 } = await loadFixture(deployContractsFixture);
        await interestDistribution.setTotalInterest(ethers.parseEther("1000"));
        
        await interestDistribution.connect(user1).claimInterest();
        await expect(interestDistribution.connect(user1).claimInterest()).to.be.revertedWith("Interest already claimed for this period");
    });

    it("Should prevent non-token-holders from claiming interest", async function () {
        const { interestDistribution, csi300Token, owner, user1 } = await loadFixture(deployContractsFixture);
        await csi300Token.connect(owner).transfer(user1.address, await csi300Token.balanceOf(owner.address));
        await interestDistribution.setTotalInterest(ethers.parseEther("1000"));
        const snapshotId = await interestDistribution.currentSnapshotId();
        const ownerBalanceAtSnapshot = await csi300Token.balanceOfAt(owner.address, snapshotId);
        expect(ownerBalanceAtSnapshot).to.equal(0);

        await expect(interestDistribution.connect(owner).claimInterest()).to.be.revertedWith("No tokens at snapshot");
    });
});
