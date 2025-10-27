// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IRegistry {
    /// @notice Emitted when a token is registered
    event TokenRegistered(uint256 indexed token, uint256 indexed complement, bytes32 indexed conditionId);

    /// @notice Error for invalid token ID
    error InvalidTokenId();

    /// @notice Error for invalid complement
    error InvalidComplement();

    /// @notice Error when token is already registered
    error AlreadyRegistered();

    /// @notice Gets the conditionId from a tokenId
    /// @param token - The token
    function getConditionId(uint256 token) external view returns (bytes32);

    /// @notice Gets the complement of a tokenId
    /// @param token - The token
    function getComplement(uint256 token) external view returns (uint256);

    /// @notice Validates the complement of a tokenId
    /// @param token - The tokenId
    /// @param complement - The complement to be validated
    function validateComplement(uint256 token, uint256 complement) external view;

    /// @notice Validates that a tokenId is registered
    /// @param tokenId - The tokenId
    function validateTokenId(uint256 tokenId) external view;
}
