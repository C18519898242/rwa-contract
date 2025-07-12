import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Token and Distribution Logic", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployContractsFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();

        // Deploy MockUSDT with 6 decimals
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const usdt = await MockUSDT.deploy();
        
        // Deploy CSI300Token with 6 decimals
        const MockOracle = await ethers.getContractFactory("MockOracle");
        const oracle = await MockOracle.deploy();
        const CSI300Token = await ethers.getContractFactory("CSI300Token");
        const csi300Token = await CSI300Token.deploy(await oracle.getAddress());

        // Deploy InterestDistribution
        const InterestDistribution = await ethers.getContractFactory("InterestDistribution");
        const interestDistribution = await InterestDistribution.deploy(await csi300Token.getAddress(), await usdt.getAddress());

        // --- Initial Setup ---
        // Mint CSI300Token for users (using 6 decimals)
        await csi300Token.transfer(user1.address, ethers.parseUnits("100", 6));
        await csi300Token.transfer(user2.address, ethers.parseUnits("300", 6));
        
        // Mint USDT to the InterestDistribution contract for distribution (using 6 decimals)
        await usdt.mint(await interestDistribution.getAddress(), ethers.parseUnits("1000", 6));

        // NOTE: Ownership of CSI300Token is NOT transferred in the fixture.
        // The deployer ('owner') retains ownership to manage the token.
        // It will be transferred temporarily in tests that need snapshotting.

        return { interestDistribution, csi300Token, usdt, owner, user1, user2, user3 };
    }

    describe("InterestDistribution Functionality", function() {
        it("Should allow users to claim interest based on their token balance at snapshot", async function () {
            const { interestDistribution, csi300Token, usdt, owner, user1, user2 } = await loadFixture(deployContractsFixture);
            const totalInterest = ethers.parseUnits("1000", 6);
            
            // Transfer ownership to allow snapshotting, then set interest
            await csi300Token.connect(owner).transferOwnership(await interestDistribution.getAddress());
            await interestDistribution.setTotalInterest(totalInterest);
    
            const snapshotId = await interestDistribution.currentSnapshotId();
            const csiTotalSupply = await csi300Token.totalSupplyAt(snapshotId);
    
            // User 1 claims interest
            const user1CSIBalance = await csi300Token.balanceOfAt(user1.address, snapshotId);
            const expectedInterest1 = (user1CSIBalance * totalInterest) / csiTotalSupply;
            await expect(interestDistribution.connect(user1).claimInterest())
                .to.emit(interestDistribution, "InterestClaimed")
                .withArgs(user1.address, expectedInterest1);
            expect(await usdt.balanceOf(user1.address)).to.equal(expectedInterest1);
    
            // User 2 claims interest
            const user2CSIBalance = await csi300Token.balanceOfAt(user2.address, snapshotId);
            const expectedInterest2 = (user2CSIBalance * totalInterest) / csiTotalSupply;
            await expect(interestDistribution.connect(user2).claimInterest())
                .to.emit(interestDistribution, "InterestClaimed")
                .withArgs(user2.address, expectedInterest2);
            expect(await usdt.balanceOf(user2.address)).to.equal(expectedInterest2);
        });
    
        it("Should prevent users from claiming interest twice", async function () {
            const { interestDistribution, csi300Token, owner, user1 } = await loadFixture(deployContractsFixture);

            // Transfer ownership to allow snapshotting, then set interest
            await csi300Token.connect(owner).transferOwnership(await interestDistribution.getAddress());
            await interestDistribution.setTotalInterest(ethers.parseUnits("1000", 6));
            
            await interestDistribution.connect(user1).claimInterest();
            await expect(interestDistribution.connect(user1).claimInterest()).to.be.revertedWith("Interest already claimed for this period");
        });
    });

    describe("CSI300Token Blacklist and Freeze Functionality", function() {
        it("Should prevent blacklisted users from claiming interest", async function () {
            const { interestDistribution, csi300Token, owner, user1 } = await loadFixture(deployContractsFixture);
            
            // Owner blacklists user1. This works because owner retains ownership from the fixture.
            await csi300Token.connect(owner).setBlacklisted(user1.address, true);
            expect(await csi300Token.isBlacklisted(user1.address)).to.be.true;

            // Now, transfer ownership to set interest
            await csi300Token.connect(owner).transferOwnership(await interestDistribution.getAddress());
            await interestDistribution.setTotalInterest(ethers.parseUnits("1000", 6));

            // Expect claim to be reverted
            await expect(interestDistribution.connect(user1).claimInterest()).to.be.revertedWith("User is blacklisted");
        });

        it("Should prevent blacklisted users from transferring tokens", async function () {
            const { csi300Token, owner, user1, user2 } = await loadFixture(deployContractsFixture);
            
            // Owner blacklists user1.
            await csi300Token.connect(owner).setBlacklisted(user1.address, true);

            // user1 tries to send tokens
            await expect(csi300Token.connect(user1).transfer(user2.address, ethers.parseUnits("10", 6)))
                .to.be.revertedWith("CSI300Token: sender is blacklisted");
            
            // another user tries to send to user1
            await expect(csi300Token.connect(user2).transfer(user1.address, ethers.parseUnits("10", 6)))
                .to.be.revertedWith("CSI300Token: recipient is blacklisted");
        });

        it("Should prevent transfers that exceed the available (unfrozen) balance", async function () {
            const { csi300Token, owner, user1, user2 } = await loadFixture(deployContractsFixture);
            
            // user1 has 100 tokens. Owner freezes 60 of them.
            await csi300Token.connect(owner).freezeBalance(user1.address, ethers.parseUnits("60", 6));
            
            expect(await csi300Token.frozenBalanceOf(user1.address)).to.equal(ethers.parseUnits("60", 6));
            expect(await csi300Token.availableBalanceOf(user1.address)).to.equal(ethers.parseUnits("40", 6));

            // Trying to transfer 50 tokens (more than available) should fail
            await expect(csi300Token.connect(user1).transfer(user2.address, ethers.parseUnits("50", 6)))
                .to.be.revertedWith("CSI300Token: transfer amount exceeds available balance");

            // Transferring 40 tokens (equal to available) should succeed
            await expect(csi300Token.connect(user1).transfer(user2.address, ethers.parseUnits("40", 6)))
                .to.not.be.reverted;
            
            expect(await csi300Token.balanceOf(user1.address)).to.equal(ethers.parseUnits("60", 6));
        });

        it("Should still calculate interest based on total balance, not just available balance", async function () {
            const { interestDistribution, csi300Token, usdt, owner, user1 } = await loadFixture(deployContractsFixture);
            
            // Owner freezes half of user1's tokens
            await csi300Token.connect(owner).freezeBalance(user1.address, ethers.parseUnits("50", 6));

            // Transfer ownership to InterestDistribution contract to allow snapshot
            await csi300Token.connect(owner).transferOwnership(await interestDistribution.getAddress());

            // Set interest
            const totalInterest = ethers.parseUnits("1000", 6);
            await interestDistribution.setTotalInterest(totalInterest);

            // User1's claim should be based on their full 100 tokens at snapshot
            const snapshotId = await interestDistribution.currentSnapshotId();
            const csiTotalSupply = await csi300Token.totalSupplyAt(snapshotId);
            const user1FullBalance = await csi300Token.balanceOfAt(user1.address, snapshotId);
            
            // The balance at snapshot should be the full 100 tokens
            expect(user1FullBalance).to.equal(ethers.parseUnits("100", 6));

            const expectedInterest = (user1FullBalance * totalInterest) / csiTotalSupply;
            
            await interestDistribution.connect(user1).claimInterest();
            expect(await usdt.balanceOf(user1.address)).to.equal(expectedInterest);
        });
    });
});
