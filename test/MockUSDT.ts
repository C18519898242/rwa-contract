import { expect } from "chai";
import { ethers } from "hardhat";

describe("MockUSDT", function () {
    it("Should deploy with correct parameters", async function () {
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const usdt = await MockUSDT.deploy();
        await usdt.waitForDeployment();

        expect(await usdt.name()).to.equal("Mock USDT");
        expect(await usdt.symbol()).to.equal("USDT");
        expect(await usdt.decimals()).to.equal(6);

        const totalSupply = await usdt.totalSupply();
        expect(totalSupply).to.equal(ethers.parseUnits("100000000", 6));
    });
});
