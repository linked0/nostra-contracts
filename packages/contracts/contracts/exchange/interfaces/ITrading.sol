// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Order, OrderStatus} from "../libraries/OrderStructs.sol";

interface ITrading {
    /// @notice Emitted when an order is filled
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makerAssetId,
        uint256 takerAssetId,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 fee
    );

    /// @notice Emitted when orders are matched
    event OrdersMatched(
        bytes32 indexed takerOrderHash,
        address indexed takerOrderMaker,
        uint256 makerAssetId,
        uint256 takerAssetId,
        uint256 makingAmount,
        uint256 takingAmount
    );

    /// @notice Emitted when an order is cancelled
    event OrderCancelled(bytes32 indexed orderHash);

    /// @notice Emitted when a fee is charged
    event FeeCharged(address indexed receiver, uint256 tokenId, uint256 amount);

    /// @notice Errors
    error NotOwner();
    error OrderFilledOrCancelled();
    error OrderExpired();
    error FeeTooHigh();
    error InvalidNonce();
    error TooLittleTokensReceived();
    error NotCrossing();
    error MismatchedTokenIds();
    error NotTaker();
    error MakingGtRemaining();

    /// @notice Gets the status of an order
    /// @param orderHash - The hash of the order
    function getOrderStatus(bytes32 orderHash) external view returns (OrderStatus memory);

    /// @notice Validates an order
    /// @param order - The order to be validated
    function validateOrder(Order memory order) external view;

    /// @notice Cancels an order
    /// @param order - The order to be cancelled
    function cancelOrder(Order memory order) external;

    /// @notice Cancels a set of orders
    /// @param orders - The set of orders to be cancelled
    function cancelOrders(Order[] memory orders) external;
}
