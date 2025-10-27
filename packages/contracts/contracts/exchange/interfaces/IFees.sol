// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IFees {
    /// @notice Returns the maximum fee rate for an order
    function getMaxFeeRate() external pure returns (uint256);
}
