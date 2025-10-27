// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAssets {
    /// @notice Returns the collateral token address
    function getCollateral() external view returns (address);

    /// @notice Returns the CTF token address
    function getCtf() external view returns (address);
}
