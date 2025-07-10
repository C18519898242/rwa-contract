// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IOracle {
    function getPrice() external view returns (uint256);
}

contract CSI300Token is ERC20, Ownable {
    IOracle public oracle;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10**18; // 1 million tokens
    
    constructor(address oracleAddress) 
        ERC20("CSI 300 Index Token", "CSI300")
        Ownable(msg.sender)
    {
        _mint(msg.sender, INITIAL_SUPPLY);
        oracle = IOracle(oracleAddress);
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = IOracle(newOracle);
    }

    function getIndexPrice() public view returns (uint256) {
        return oracle.getPrice();
    }
}
