// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockOracle {
    uint256 public price = 3500 * 10**18; // 初始模拟价格3500点
    
    function getPrice() external view returns (uint256) {
        return price;
    }
    
    function setPrice(uint256 newPrice) external {
        price = newPrice;
    }
}
