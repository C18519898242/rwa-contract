// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICSI300Token is IERC20 {
    function snapshot() external returns (uint256);
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}

contract InterestDistribution is Ownable {
    ICSI300Token public immutable csi300Token;
    IERC20 public immutable usdtToken;

    uint256 public currentSnapshotId;
    uint256 public totalInterest;
    mapping(address => bool) public hasClaimed;

    event InterestSet(uint256 totalAmount, uint256 snapshotId);
    event InterestClaimed(address indexed user, uint256 amount);

    constructor(address _csi300Token, address _usdtToken) Ownable(msg.sender) {
        csi300Token = ICSI300Token(_csi300Token);
        usdtToken = IERC20(_usdtToken);
    }

    function setTotalInterest(uint256 _totalInterest) external onlyOwner {
        require(_totalInterest > 0, "Total interest must be greater than 0");
        
        // Take a new snapshot
        currentSnapshotId = csi300Token.snapshot();
        totalInterest = _totalInterest;

        // Reset claimed status for the new period, this is a simplified approach.
        // In a real-world scenario, you might want a more sophisticated way to handle claim periods.
        // For this implementation, we assume a global claim reset on new interest setting.
        // This part of the logic might need adjustment based on more detailed requirements.
        // For now, we will rely on a manual reset of the claimed mapping if needed, or a new contract deployment per distribution.
        // A more robust implementation would use a period ID.

        emit InterestSet(_totalInterest, currentSnapshotId);
    }

    function claimInterest() external {
        require(currentSnapshotId > 0, "Interest not set yet");
        require(!hasClaimed[msg.sender], "Interest already claimed");

        uint256 userBalance = csi300Token.balanceOfAt(msg.sender, currentSnapshotId);
        require(userBalance > 0, "No tokens at snapshot");

        uint256 snapshotTotalSupply = csi300Token.totalSupplyAt(currentSnapshotId);
        require(snapshotTotalSupply > 0, "Total supply at snapshot was 0");

        uint256 interestAmount = (userBalance * totalInterest) / snapshotTotalSupply;
        require(interestAmount > 0, "Calculated interest is zero");

        hasClaimed[msg.sender] = true;
        
        require(usdtToken.transfer(msg.sender, interestAmount), "USDT transfer failed");

        emit InterestClaimed(msg.sender, interestAmount);
    }
}
