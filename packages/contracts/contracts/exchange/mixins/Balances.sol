// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IAssets.sol";

/// @title Balances
/// @notice Manages internal user balances for collateral
abstract contract Balances is IAssets {
    using SafeERC20 for IERC20;

    /// @notice Mapping of user address to collateral balance
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Get collateral token address - must be implemented by Assets mixin
    function getCollateral() public view virtual returns (address);

    /// @notice Internal deposit function
    /// @param user The user address to credit
    /// @param amount The amount to deposit
    function _deposit(address user, uint256 amount) internal virtual {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from user to this contract
        IERC20(getCollateral()).safeTransferFrom(user, address(this), amount);
        
        // Update balance
        balances[user] += amount;
        
        emit Deposit(user, amount);
    }

    /// @notice Internal withdraw function
    /// @param user The user address to debit
    /// @param amount The amount to withdraw
    function _withdraw(address user, uint256 amount) internal virtual {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[user] >= amount, "Insufficient balance");
        
        // Update balance first (Checks-Effects-Interactions)
        balances[user] -= amount;
        
        // Transfer tokens to user
        IERC20(getCollateral()).safeTransfer(user, amount);
        
        emit Withdraw(user, amount);
    }
}
