// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IOracle {
    function getPrice() external view returns (uint256);
}

contract CSI300Token is ERC20, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    IOracle public oracle;

    // --- Snapshot ---
    uint256 private _currentSnapshotId;
    mapping(uint256 => mapping(address => uint256)) private _balanceSnapshots;
    mapping(uint256 => uint256) private _totalSupplySnapshots;
    EnumerableSet.AddressSet private _holders;

    // --- Blacklist ---
    mapping(address => bool) private _isBlacklisted;
    event Blacklisted(address indexed account, bool isBlacklisted);

    // --- Frozen Balance ---
    mapping(address => uint256) private _frozenBalances;
    event BalanceFrozen(address indexed account, uint256 amount);

    constructor(address oracleAddress)
        ERC20("CSI 300 Index Token", "CSI300")
        Ownable(msg.sender)
    {
        _mint(msg.sender, 1_000_000 * (10**6));
        oracle = IOracle(oracleAddress);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // --- Snapshot Functions ---

    function snapshot() public onlyOwner returns (uint256) {
        _currentSnapshotId++;
        uint256 ts = totalSupply();
        _totalSupplySnapshots[_currentSnapshotId] = ts;

        for (uint256 i = 0; i < _holders.length(); i++) {
            address holder = _holders.at(i);
            _balanceSnapshots[_currentSnapshotId][holder] = balanceOf(holder);
        }
        return _currentSnapshotId;
    }

    function balanceOfAt(address account, uint256 snapshotId) public view returns (uint256) {
        return _balanceSnapshots[snapshotId][account];
    }

    function totalSupplyAt(uint256 snapshotId) public view returns (uint256) {
        return _totalSupplySnapshots[snapshotId];
    }

    // --- Blacklist Functions ---

    function setBlacklisted(address account, bool blacklisted) public onlyOwner {
        _isBlacklisted[account] = blacklisted;
        emit Blacklisted(account, blacklisted);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _isBlacklisted[account];
    }

    // --- Frozen Balance Functions ---

    function freezeBalance(address account, uint256 amount) public onlyOwner {
        require(balanceOf(account) >= amount, "Frozen amount exceeds balance");
        _frozenBalances[account] = amount;
        emit BalanceFrozen(account, amount);
    }

    function frozenBalanceOf(address account) public view returns (uint256) {
        return _frozenBalances[account];
    }

    function availableBalanceOf(address account) public view returns (uint256) {
        return balanceOf(account) - frozenBalanceOf(account);
    }

    // --- Oracle Functions ---

    function setOracle(address newOracle) external onlyOwner {
        oracle = IOracle(newOracle);
    }

    function getIndexPrice() public view returns (uint256) {
        return oracle.getPrice();
    }

    // --- Overridden ERC20 Functions ---

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _requireTransfer(owner, to, amount);
        _transfer(owner, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _requireTransfer(from, to, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _requireTransfer(address from, address to, uint256 amount) internal view {
        require(!_isBlacklisted[from], "CSI300Token: sender is blacklisted");
        require(!_isBlacklisted[to], "CSI300Token: recipient is blacklisted");
        require(amount <= availableBalanceOf(from), "CSI300Token: transfer amount exceeds available balance");
    }
    
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        // Holder management for snapshots
        if (from == address(0)) { // Mint
            if (balanceOf(to) > 0 && !_holders.contains(to)) {
                _holders.add(to);
            }
        } else if (to == address(0)) { // Burn
            if (balanceOf(from) == 0 && _holders.contains(from)) {
                _holders.remove(from);
            }
        } else { // Transfer
            if (balanceOf(from) == 0 && _holders.contains(from)) {
                _holders.remove(from);
            }
            if (balanceOf(to) > 0 && !_holders.contains(to)) {
                _holders.add(to);
            }
        }
    }
}
