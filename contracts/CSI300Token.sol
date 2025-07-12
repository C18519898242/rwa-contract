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

    mapping(uint256 => mapping(address => uint256)) private _balanceSnapshots;
    mapping(uint256 => uint256) private _totalSupplySnapshots;
    uint256 private _currentSnapshotId;
    address[] private _holders;
    mapping(address => bool) private _isHolder;

    constructor(address oracleAddress)
        ERC20("CSI 300 Index Token", "CSI300")
        Ownable(msg.sender)
    {
        _mint(msg.sender, INITIAL_SUPPLY);
        oracle = IOracle(oracleAddress);
        _addHolder(msg.sender);
    }

    function _addHolder(address holder) private {
        if (!_isHolder[holder]) {
            _isHolder[holder] = true;
            _holders.push(holder);
        }
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (balanceOf(to) > 0 && !_isHolder[to]) {
            _addHolder(to);
        }
    }

    function snapshot() public onlyOwner returns (uint256) {
        _currentSnapshotId++;
        uint256 ts = totalSupply();
        _totalSupplySnapshots[_currentSnapshotId] = ts;
        for (uint i = 0; i < _holders.length; i++) {
            address holder = _holders[i];
            uint256 balance = balanceOf(holder);
            if (balance > 0) {
                _balanceSnapshots[_currentSnapshotId][holder] = balance;
            }
        }
        return _currentSnapshotId;
    }

    function balanceOfAt(address account, uint256 snapshotId) public view returns (uint256) {
        return _balanceSnapshots[snapshotId][account];
    }

    function totalSupplyAt(uint256 snapshotId) public view returns (uint256) {
        return _totalSupplySnapshots[snapshotId];
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = IOracle(newOracle);
    }

    function getIndexPrice() public view returns (uint256) {
        return oracle.getPrice();
    }
}
