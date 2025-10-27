// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IPausable {
    /// @notice Emitted when trading is paused
    event TradingPaused(address indexed pauser);

    /// @notice Emitted when trading is unpaused
    event TradingUnpaused(address indexed unpauser);

    /// @notice Error when trading is paused
    error Paused();
}
