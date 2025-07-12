import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // 1. 先部署Oracle
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();

  console.log("MockOracle deployed to:", await oracle.getAddress());

  // 2. 部署CSI300Token
  const Token = await ethers.getContractFactory("CSI300Token");
  const token = await Token.deploy(await oracle.getAddress());
  await token.waitForDeployment();

  console.log("CSI300Token deployed to:", await token.getAddress());
  console.log("Initial supply:", await token.totalSupply());
  console.log("Current index price:", await token.getIndexPrice());

  // 3. 部署MockUSDT
  const USDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await USDT.deploy();
  await usdt.waitForDeployment();

  console.log("MockUSDT deployed to:", await usdt.getAddress());
  console.log("USDT initial supply:", await usdt.totalSupply());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
