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
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
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
    using SafeERC20 for IERC20;

    event RefundToExchange(address indexed user, bytes32 indexed conditionId, uint256 amount);
    event AdminBalanceTransfer(address indexed from, address indexed to, uint256 amount);

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

    /// @notice Deposits collateral from admin and credits a user's exchange balance
    /// @param user The user to credit
    /// @param amount The amount to deposit
    function depositFor(address user, uint256 amount) external nonReentrant notPaused onlyAdmin {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(getCollateral()).safeTransferFrom(msg.sender, address(this), amount);
        balances[user] += amount;

        emit Deposit(user, amount);
    }

    /// @notice Admin transfer between internal balances (penalties, adjustments)
    /// @param from The user to debit
    /// @param to The user to credit
    /// @param amount The amount to transfer
    function adminTransferBalance(address from, address to, uint256 amount)
        external
        nonReentrant
        notPaused
        onlyAdmin
    {
        require(from != address(0) && to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        require(balances[from] >= amount, "Insufficient balance");

        balances[from] -= amount;
        balances[to] += amount;

        emit AdminBalanceTransfer(from, to, amount);
    }

    /// @notice Refunds resolved positions and credits the user's exchange balance
    /// @param conditionId The resolved condition to redeem
    /// @param indexSets Outcome index sets to redeem (e.g., [1,2] for binary)
    function refundToExchange(bytes32 conditionId, uint256[] calldata indexSets)
        external
        nonReentrant
        notPaused
    {
        _refundToExchange(msg.sender, conditionId, indexSets);
    }

    /// @notice Admin refunds resolved positions and credits a user's exchange balance
    /// @param user The user to refund
    /// @param conditionId The resolved condition to redeem
    /// @param indexSets Outcome index sets to redeem (e.g., [1,2] for binary)
    function refundToExchangeFor(address user, bytes32 conditionId, uint256[] calldata indexSets)
        external
        nonReentrant
        notPaused
        onlyAdmin
    {
        _refundToExchange(user, conditionId, indexSets);
    }

    /// @notice Withdraws collateral from the exchange
    /// @param amount The amount to withdraw
    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(msg.sender, amount);
    }

    function _refundToExchange(address user, bytes32 conditionId, uint256[] calldata indexSets) internal {
        require(indexSets.length > 0, "No index sets");

        IConditionalTokens ctf = IConditionalTokens(getCtf());
        uint256 payoutDenominator = ctf.payoutDenominator(conditionId);
        require(payoutDenominator > 0, "Condition not resolved");

        IERC1155 ctf1155 = IERC1155(getCtf());
        require(ctf1155.isApprovedForAll(user, address(this)), "Approval required");

        uint256 beforeBalance = IERC20(getCollateral()).balanceOf(address(this));

        for (uint256 i = 0; i < indexSets.length; i++) {
            bytes32 collectionId = ctf.getCollectionId(parentCollectionId, conditionId, indexSets[i]);
            uint256 positionId = ctf.getPositionId(IERC20(getCollateral()), collectionId);
            uint256 balance = ctf1155.balanceOf(user, positionId);
            if (balance > 0) {
                ctf1155.safeTransferFrom(user, address(this), positionId, balance, "");
            }
        }

        ctf.redeemPositions(IERC20(getCollateral()), parentCollectionId, conditionId, indexSets);

        uint256 afterBalance = IERC20(getCollateral()).balanceOf(address(this));
        uint256 redeemed = afterBalance - beforeBalance;
        require(redeemed > 0, "No collateral redeemed");

        balances[user] += redeemed;
        emit Deposit(user, redeemed);
        emit RefundToExchange(user, conditionId, redeemed);
    }
}
