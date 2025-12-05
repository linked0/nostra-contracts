// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./mixins/Auth.sol";
import "./mixins/Assets.sol";
import "./mixins/Fees.sol";
import "./mixins/Hashing.sol";
import "./mixins/Trading.sol";
import "./mixins/Registry.sol";
import "./mixins/Pausable.sol";
import "./mixins/Signatures.sol";
import "./mixins/NonceManager.sol";
import "./mixins/AssetOperations.sol";
import "./BaseExchange.sol";
import {Order} from "./libraries/OrderStructs.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

/// @title CTF Exchange
/// @notice Implements logic for trading CTF assets
/// @author Nostra (based on Polymarket CTF Exchange)
contract CTFExchange is
    BaseExchange,
    Multicall,
    Auth,
    Assets,
    Fees,
    Pausable,
    AssetOperations,
    Hashing("Nostra CTF Exchange", "1"),
    NonceManager,
    Registry,
    Signatures,
    Trading
{
    constructor(address _collateral, address _ctf) Assets(_collateral, _ctf) {}

    /// @notice Resolve function conflicts - use concrete implementations from mixins
    function getMaxFeeRate() public pure override(Fees, Trading) returns (uint256) {
        return Fees.getMaxFeeRate();
    }

    function hashOrder(Order memory order) public view override(Hashing, Trading) returns (bytes32) {
        return Hashing.hashOrder(order);
    }

    function validateTokenId(uint256 tokenId) public view override(Registry, Trading) {
        return Registry.validateTokenId(tokenId);
    }

    function getConditionId(uint256 token) public view override(Registry, Trading) returns (bytes32) {
        return Registry.getConditionId(token);
    }

    function validateComplement(uint256 token, uint256 complement) public view override(Registry, Trading) {
        return Registry.validateComplement(token, complement);
    }

    function validateOrderSignature(bytes32 orderHash, Order memory order)
        public
        view
        override(Signatures, Trading)
    {
        return Signatures.validateOrderSignature(orderHash, order);
    }

    function isValidNonce(address usr, uint256 nonce) public view override(NonceManager, Trading) returns (bool) {
        return NonceManager.isValidNonce(usr, nonce);
    }

    function getCollateral() public view override(Assets, AssetOperations) returns (address) {
        return Assets.getCollateral();
    }

    function getCtf() public view override(Assets, AssetOperations) returns (address) {
        return Assets.getCtf();
    }

    /// @notice Internal functions - explicitly use AssetOperations implementation
    function _transfer(address from, address to, uint256 id, uint256 value)
        internal
        override(AssetOperations, Trading)
    {
        AssetOperations._transfer(from, to, id, value);
    }

    function _getBalance(uint256 tokenId) internal override(AssetOperations, Trading) returns (uint256) {
        return AssetOperations._getBalance(tokenId);
    }

    function _mint(bytes32 conditionId, uint256 amount) internal override(AssetOperations, Trading) {
        AssetOperations._mint(conditionId, amount);
    }

    function _merge(bytes32 conditionId, uint256 amount) internal override(AssetOperations, Trading) {
        AssetOperations._merge(conditionId, amount);
    }

    /*//////////////////////////////////////////////////////////////
                           PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause trading on the Exchange
    function pauseTrading() external onlyAdmin {
        _pauseTrading();
    }

    /// @notice Unpause trading on the Exchange
    function unpauseTrading() external onlyAdmin {
        _unpauseTrading();
    }

    /*//////////////////////////////////////////////////////////////
                           REGISTRY
    //////////////////////////////////////////////////////////////*/

    /// @notice Registers a token
    /// @param token0 - The first token ID
    /// @param token1 - The second token ID (complement)
    /// @param conditionId - The condition ID from the CTF
    function registerToken(uint256 token0, uint256 token1, bytes32 conditionId) external onlyAdmin {
        _registerToken(token0, token1, conditionId);
    }

    /*//////////////////////////////////////////////////////////////
                           TRADING
    //////////////////////////////////////////////////////////////*/

    /// @notice Fills an order
    /// @param order - The order to be filled
    /// @param fillAmount - The amount to be filled
    function fillOrder(Order memory order, uint256 fillAmount) external nonReentrant notPaused onlyOperator {
        _fillOrder(order, fillAmount, msg.sender);
    }

    /// @notice Fills multiple orders
    /// @param orders - The orders to be filled
    /// @param fillAmounts - The amounts to be filled
    function fillOrders(Order[] memory orders, uint256[] memory fillAmounts)
        external
        nonReentrant
        notPaused
        onlyOperator
    {
        _fillOrders(orders, fillAmounts, msg.sender);
    }

    /// @notice Matches orders against each other
    /// @param takerOrder - The taker order
    /// @param makerOrders - The maker orders
    /// @param takerFillAmount - The taker fill amount
    /// @param makerFillAmounts - The maker fill amounts
    function matchOrders(
        Order memory takerOrder,
        Order[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) external nonReentrant notPaused onlyOperator {
        _matchOrders(takerOrder, makerOrders, takerFillAmount, makerFillAmounts);
    }

    /*//////////////////////////////////////////////////////////////
                           DEPOSIT / WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposits collateral into the exchange
    /// @param amount The amount to deposit
    function deposit(uint256 amount) external nonReentrant notPaused {
        _deposit(msg.sender, amount);
    }

    /// @notice Withdraws collateral from the exchange
    /// @param amount The amount to withdraw
    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(msg.sender, amount);
    }
}
