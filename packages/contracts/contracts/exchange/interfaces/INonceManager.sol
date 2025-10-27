// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface INonceManager {
    /// @notice Increment the nonce for msg.sender
    function incrementNonce() external;

    /// @notice Check if a nonce is valid for a user
    /// @param usr - The user address
    /// @param nonce - The nonce to check
    function isValidNonce(address usr, uint256 nonce) external view returns (bool);
}
