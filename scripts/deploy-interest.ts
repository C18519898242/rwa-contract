import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  console.log("MockUSDT deployed to:", await usdt.getAddress());

  // Deploy MockOracle
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  console.log("MockOracle deployed to:", await oracle.getAddress());

  // Deploy CSI300Token
  const CSI300Token = await ethers.getContractFactory("CSI300Token");
  const csi300Token = await CSI300Token.deploy(await oracle.getAddress());
  console.log("CSI300Token deployed to:", await csi300Token.getAddress());

  // Deploy InterestDistribution
  const InterestDistribution = await ethers.getContractFactory("InterestDistribution");
  const interestDistribution = await InterestDistribution.deploy(await csi300Token.getAddress(), await usdt.getAddress());
  console.log("InterestDistribution deployed to:", await interestDistribution.getAddress());

  // Transfer ownership of CSI300Token to InterestDistribution contract
  await csi300Token.transferOwnership(await interestDistribution.getAddress());
  console.log("Transferred ownership of CSI300Token to InterestDistribution");

  // Mint some USDT to the InterestDistribution contract for distribution
  await usdt.mint(await interestDistribution.getAddress(), ethers.parseEther("10000")); // 10,000 USDT
  console.log("Minted 10,000 USDT to InterestDistribution contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
