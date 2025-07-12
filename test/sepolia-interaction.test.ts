import { expect } from "chai";
import { ethers, network } from "hardhat";
import deploymentInfo from "./sepolia-deployment.json";
import { InterestDistribution, CSI300Token, MockUSDT } from "../typechain-types";

// This test suite is designed to run on a fork of the Sepolia network
// or directly against the Sepolia network.
// Ensure your hardhat.config.ts is configured for Sepolia and your .env file is set up.

describe("Sepolia Deployed Contracts Interaction", function () {
  let interestDistribution: InterestDistribution;
  let csi300Token: CSI300Token;
  let usdt: MockUSDT;
  let deployer: any;
  let user1: any;

  // We only run these tests on the Sepolia network (or a fork of it).
  if (network.name !== "sepolia") {
    console.log("Skipping Sepolia interaction tests on non-Sepolia network.");
    return;
  }

  before(async function () {
    // This test suite can be slow because it interacts with a live network.
    this.timeout(120000); // 2 minutes timeout for setup

    [deployer, user1] = await ethers.getSigners();

    console.log("Testing with account:", deployer.address);
    if (deployer.address.toLowerCase() !== deploymentInfo.deployerAccount.toLowerCase()) {
        console.warn("Warning: The private key in your .env file does not match the deployer account in sepolia-deployment.json. Tests requiring ownership may fail.");
    }

    // Get contract instances from the deployed addresses
    interestDistribution = await ethers.getContractAt("InterestDistribution", deploymentInfo.interestDistribution);
    csi300Token = await ethers.getContractAt("CSI300Token", deploymentInfo.csi300Token);
    usdt = await ethers.getContractAt("MockUSDT", deploymentInfo.mockUSDT);

    console.log("Successfully attached to contracts on Sepolia:");
    console.log("  - InterestDistribution:", await interestDistribution.getAddress());
    console.log("  - CSI300Token:", await csi300Token.getAddress());
    console.log("  - MockUSDT:", await usdt.getAddress());
  });

  it("Should have correct initial state", async function () {
    this.timeout(60000);
    const initialSupply = await csi300Token.INITIAL_SUPPLY();
    const deployerBalance = await csi300Token.balanceOf(deployer.address);
    expect(deployerBalance).to.equal(initialSupply);
  });

  it("Should allow the owner to set a new interest period", async function () {
    this.timeout(120000);
    const newInterestAmount = ethers.parseUnits("100", 18); // 100 USDT

    // Ensure the contract has enough USDT for the new interest amount
    console.log(`Minting ${ethers.formatEther(newInterestAmount)} USDT to the InterestDistribution contract...`);
    const mintTx = await usdt.connect(deployer).mint(await interestDistribution.getAddress(), newInterestAmount);
    await mintTx.wait();
    console.log("Minting confirmed.");

    console.log("Setting new total interest...");
    const tx = await interestDistribution.connect(deployer).setTotalInterest(newInterestAmount);
    console.log("Transaction sent, waiting for confirmation...", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed.");

    const currentSnapshotId = await interestDistribution.currentSnapshotId();
    expect(await interestDistribution.totalInterest()).to.equal(newInterestAmount);
    expect(currentSnapshotId).to.be.gt(0); // Greater than 0
    console.log(`New interest set. Current snapshot ID: ${currentSnapshotId}`);
  });

  it("Should allow a token holder to claim interest", async function () {
    this.timeout(120000);
    
    // For this test, the deployer (who holds all tokens) will claim the interest.
    const initialUsdtBalance = await usdt.balanceOf(deployer.address);
    console.log(`Initial USDT balance of deployer: ${ethers.formatEther(initialUsdtBalance)}`);

    const snapshotId = await interestDistribution.currentSnapshotId();
    const userBalanceAtSnapshot = await csi300Token.balanceOfAt(deployer.address, snapshotId);
    const totalSupplyAtSnapshot = await csi300Token.totalSupplyAt(snapshotId);
    const totalInterest = await interestDistribution.totalInterest();

    const expectedInterest = (userBalanceAtSnapshot * totalInterest) / totalSupplyAtSnapshot;
    console.log(`Expected interest for deployer: ${ethers.formatEther(expectedInterest)} USDT`);

    console.log("Deployer claiming interest...");
    const tx = await interestDistribution.connect(deployer).claimInterest();
    console.log("Transaction sent, waiting for confirmation...", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed.");

    const finalUsdtBalance = await usdt.balanceOf(deployer.address);
    console.log(`Final USDT balance of deployer: ${ethers.formatEther(finalUsdtBalance)}`);

    // The final balance should be the initial balance plus the claimed interest.
    expect(finalUsdtBalance).to.equal(initialUsdtBalance + expectedInterest);
  });

  it("Should prevent a user from claiming interest twice in the same period", async function () {
    this.timeout(120000);
    await expect(interestDistribution.connect(deployer).claimInterest()).to.be.revertedWith("Interest already claimed for this period");
    console.log("Successfully prevented double-claiming.");
  });
});
