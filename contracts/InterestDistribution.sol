// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICSI300Token is IERC20 {
    function snapshot() external returns (uint256);
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
    function isBlacklisted(address account) external view returns (bool);
}

contract InterestDistribution is Ownable {
    ICSI300Token public immutable csi300Token;
    IERC20 public immutable usdtToken;

    uint256 public currentSnapshotId;
    uint256 public totalInterest;
    // mapping(snapshotId => mapping(userAddress => bool))
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event InterestSet(uint256 totalAmount, uint256 snapshotId);
    event InterestClaimed(address indexed user, uint256 amount);

    constructor(address _csi300Token, address _usdtToken) Ownable(msg.sender) {
        csi300Token = ICSI300Token(_csi300Token);
        usdtToken = IERC20(_usdtToken);
    }

    function setTotalInterest(uint256 _totalInterest) external onlyOwner {
        require(_totalInterest > 0, "Total interest must be greater than 0");
        require(usdtToken.balanceOf(address(this)) >= _totalInterest, "Insufficient USDT to cover interest");
        
        // Take a new snapshot
        currentSnapshotId = csi300Token.snapshot();
        totalInterest = _totalInterest;

        emit InterestSet(_totalInterest, currentSnapshotId);
    }

    function claimInterest() external {
        // Check blacklist status first
        require(!csi300Token.isBlacklisted(msg.sender), "User is blacklisted");

        require(currentSnapshotId > 0, "Interest not set yet");
        require(!hasClaimed[currentSnapshotId][msg.sender], "Interest already claimed for this period");

        uint256 userBalance = csi300Token.balanceOfAt(msg.sender, currentSnapshotId);
        require(userBalance > 0, "No tokens at snapshot");

        uint256 snapshotTotalSupply = csi300Token.totalSupplyAt(currentSnapshotId);
        require(snapshotTotalSupply > 0, "Total supply at snapshot was 0");

        uint256 interestAmount = (userBalance * totalInterest) / snapshotTotalSupply;
        require(interestAmount > 0, "Calculated interest is zero");

        hasClaimed[currentSnapshotId][msg.sender] = true;
        
        require(usdtToken.transfer(msg.sender, interestAmount), "USDT transfer failed");

        emit InterestClaimed(msg.sender, interestAmount);
    }
}
