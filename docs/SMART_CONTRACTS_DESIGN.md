# Prediction Market Smart Contracts Design

## Overview
This document provides a comprehensive smart contract architecture for a blockchain-based prediction market platform, based on the Polymarket CTF Exchange implementation using the Conditional Tokens Framework (CTF).

**Reference Implementation**: Polymarket CTF Exchange (~/work/ctf-exchange)

---

## Architecture Overview

### Core Components

1. **CTF (Conditional Tokens Framework)** - ERC1155 standard for outcome tokens
2. **Exchange Contract** - Handles order matching and settlement
3. **Collateral Token** - ERC20 stablecoin (e.g., USDC)
4. **Market Factory** - Creates and manages prediction markets
5. **Resolution Oracle** - Resolves market outcomes

### Key Concepts

- **Outcome Tokens**: ERC1155 tokens representing positions in a market
- **Complementary Tokens**: Two outcome tokens that can be merged to form 1 unit of collateral
- **Conditional Tokens**: Tokens that represent claims on collateral conditional on a specific outcome
- **Order Book**: Off-chain matching with on-chain settlement
- **Hybrid Exchange Model**: Operator provides matching services, settlement is non-custodial

---

## Smart Contract Architecture

### Contract Structure

```
├── ConditionalTokens.sol          (CTF Core - manages outcome tokens)
├── MarketFactory.sol               (Creates markets and registers tokens)
├── CTFExchange.sol                 (Main exchange contract)
│   ├── BaseExchange.sol
│   ├── mixins/
│   │   ├── Auth.sol                (Access control)
│   │   ├── Assets.sol              (Asset management)
│   │   ├── AssetOperations.sol     (Transfer, mint, merge)
│   │   ├── Trading.sol             (Order execution)
│   │   ├── Fees.sol                (Fee management)
│   │   ├── Pausable.sol            (Emergency pause)
│   │   ├── Registry.sol            (Token registry)
│   │   ├── Signatures.sol          (EIP-712 signatures)
│   │   ├── Hashing.sol             (Order hashing)
│   │   └── NonceManager.sol        (Nonce management)
│   └── libraries/
│       ├── OrderStructs.sol        (Order data structures)
│       ├── CalculatorHelper.sol    (Price/fee calculations)
│       └── TransferHelper.sol      (Safe transfers)
└── ResolutionOracle.sol            (Market resolution)
```

---mm

## Contract Specifications

## 1. ConditionalTokens.sol

**Purpose**: Core CTF implementation for creating and managing outcome tokens

### Key Functions

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/**
 * @title Conditional Tokens
 * @notice ERC1155-based conditional tokens following Gnosis CTF standard
 */
interface IConditionalTokens {
    /// @notice Prepares a condition with a specific oracle and question ID
    /// @param oracle - Address that will report the outcome
    /// @param questionId - Unique identifier for the question
    /// @param outcomeSlotCount - Number of possible outcomes (usually 2 for binary)
    function prepareCondition(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external;

    /// @notice Splits collateral into outcome tokens
    /// @param collateralToken - The ERC20 collateral token
    /// @param parentCollectionId - Parent collection (usually bytes32(0))
    /// @param conditionId - The condition being split
    /// @param partition - Array of outcome indices [1, 2] for binary
    /// @param amount - Amount of collateral to split
    function splitPosition(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @notice Merges outcome tokens back into collateral
    /// @param collateralToken - The ERC20 collateral token
    /// @param parentCollectionId - Parent collection (usually bytes32(0))
    /// @param conditionId - The condition being merged
    /// @param partition - Array of outcome indices [1, 2] for binary
    /// @param amount - Amount to merge
    function mergePositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @notice Reports the outcome of a condition
    /// @param questionId - The question identifier
    /// @param payouts - Array of payouts for each outcome [0, 1] or [1, 0]
    function reportPayouts(
        bytes32 questionId,
        uint256[] calldata payouts
    ) external;

    /// @notice Redeems positions after resolution
    /// @param collateralToken - The ERC20 collateral token
    /// @param parentCollectionId - Parent collection
    /// @param conditionId - The resolved condition
    /// @param indexSets - Outcome index sets to redeem
    function redeemPositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external;

    /// @notice Gets the position ID (token ID) for a given collection and outcome
    function getPositionId(
        IERC20 collateralToken,
        bytes32 collectionId
    ) external pure returns (uint256);

    /// @notice Gets the collection ID for a condition and index set
    function getCollectionId(
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256 indexSet
    ) external view returns (bytes32);

    /// @notice Generates condition ID from oracle, question, and slot count
    function getConditionId(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external pure returns (bytes32);

    /// @notice Gets payout for a resolved condition
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);

    /// @notice Gets outcome payout
    function payoutNumerators(
        bytes32 conditionId,
        uint256 index
    ) external view returns (uint256);
}
```

### Events

```solidity
event ConditionPreparation(
    bytes32 indexed conditionId,
    address indexed oracle,
    bytes32 indexed questionId,
    uint256 outcomeSlotCount
);

event ConditionResolution(
    bytes32 indexed conditionId,
    address indexed oracle,
    bytes32 indexed questionId,
    uint256 outcomeSlotCount,
    uint256[] payoutNumerators
);

event PositionSplit(
    address indexed stakeholder,
    IERC20 collateralToken,
    bytes32 indexed parentCollectionId,
    bytes32 indexed conditionId,
    uint256[] partition,
    uint256 amount
);

event PositionsMerge(
    address indexed stakeholder,
    IERC20 collateralToken,
    bytes32 indexed parentCollectionId,
    bytes32 indexed conditionId,
    uint256[] partition,
    uint256 amount
);

event PayoutRedemption(
    address indexed redeemer,
    IERC20 indexed collateralToken,
    bytes32 indexed parentCollectionId,
    bytes32 conditionId,
    uint256[] indexSets,
    uint256 payout
);
```

---

## 2. MarketFactory.sol

**Purpose**: Creates new prediction markets and registers tokens

### Market Creation Policy (Optional Consideration)

The current `MarketFactory.sol` implementation is permissionless, meaning anyone can call `createBinaryMarket` or `createMultipleChoiceMarket`. For a production system, it is crucial to control who can create markets to prevent spam and ensure high quality.

Several models can be considered, from a fully curated approach to a more decentralized, token-gated one. This is an important design choice for future development.

A detailed analysis of these different policies and their trade-offs is available in the following document:

- **[Market Creation Policy](MARKET_CREATION_POLICY.md)**

### Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/// For more details on the market creation policy, see MARKET_CREATION_POLICY.md
import "./ConditionalTokens.sol";

/**
 * @title Market Factory
 * @notice Factory for creating prediction markets
 */
contract MarketFactory {
    IConditionalTokens public immutable ctf;
    address public immutable collateralToken;
    address public exchange;
    address public oracle;

    // Market registry
    mapping(bytes32 => Market) public markets;
    mapping(uint256 => bytes32) public tokenToCondition;

    struct Market {
        bytes32 conditionId;
        string question;
        string description;
        string category;
        uint256 outcomeSlotCount;
        uint256[] tokenIds;
        uint256 endTime;
        uint256 resolutionTime;
        MarketStatus status;
        address creator;
    }

    enum MarketStatus {
        Active,
        Closed,
        Resolved,
        Canceled
    }

    event MarketCreated(
        bytes32 indexed conditionId,
        bytes32 indexed questionId,
        string question,
        uint256 outcomeSlotCount,
        uint256[] tokenIds,
        address creator
    );

    event MarketResolved(
        bytes32 indexed conditionId,
        uint256[] payouts
    );

    constructor(
        address _ctf,
        address _collateralToken,
        address _oracle
    ) {
        ctf = IConditionalTokens(_ctf);
        collateralToken = _collateralToken;
        oracle = _oracle;
    }

    /// @notice Creates a new binary prediction market
    /// @param questionId - Unique identifier for the question
    /// @param question - The market question
    /// @param description - Market description
    /// @param category - Market category
    /// @param endTime - Market end time
    /// @param resolutionTime - Expected resolution time
    function createBinaryMarket(
        bytes32 questionId,
        string calldata question,
        string calldata description,
        string calldata category,
        uint256 endTime,
        uint256 resolutionTime
    ) external returns (bytes32 conditionId, uint256[] memory tokenIds) {
        require(endTime > block.timestamp, "Invalid end time");
        require(resolutionTime > endTime, "Invalid resolution time");

        // Prepare condition in CTF
        ctf.prepareCondition(oracle, questionId, 2);

        // Calculate condition ID
        conditionId = ctf.getConditionId(oracle, questionId, 2);

        // Calculate token IDs for YES and NO outcomes
        tokenIds = new uint256[](2);

        // YES token (index 0)
        bytes32 collectionIdYes = ctf.getCollectionId(
            bytes32(0),
            conditionId,
            1 // indexSet for outcome 0
        );
        tokenIds[0] = ctf.getPositionId(IERC20(collateralToken), collectionIdYes);

        // NO token (index 1)
        bytes32 collectionIdNo = ctf.getCollectionId(
            bytes32(0),
            conditionId,
            2 // indexSet for outcome 1
        );
        tokenIds[1] = ctf.getPositionId(IERC20(collateralToken), collectionIdNo);

        // Store market
        markets[conditionId] = Market({
            conditionId: conditionId,
            question: question,
            description: description,
            category: category,
            outcomeSlotCount: 2,
            tokenIds: tokenIds,
            endTime: endTime,
            resolutionTime: resolutionTime,
            status: MarketStatus.Active,
            creator: msg.sender
        });

        // Register tokens
        tokenToCondition[tokenIds[0]] = conditionId;
        tokenToCondition[tokenIds[1]] = conditionId;

        // Register with exchange
        if (exchange != address(0)) {
            ICTFExchange(exchange).registerToken(
                tokenIds[0],
                tokenIds[1],
                conditionId
            );
        }

        emit MarketCreated(
            conditionId,
            questionId,
            question,
            2,
            tokenIds,
            msg.sender
        );
    }

    /// @notice Creates a multiple choice prediction market
    /// @param questionId - Unique identifier for the question
    /// @param question - The market question
    /// @param description - Market description
    /// @param category - Market category
    /// @param outcomeSlotCount - Number of outcomes
    /// @param endTime - Market end time
    /// @param resolutionTime - Expected resolution time
    function createMultipleChoiceMarket(
        bytes32 questionId,
        string calldata question,
        string calldata description,
        string calldata category,
        uint256 outcomeSlotCount,
        uint256 endTime,
        uint256 resolutionTime
    ) external returns (bytes32 conditionId, uint256[] memory tokenIds) {
        require(outcomeSlotCount > 2 && outcomeSlotCount <= 256, "Invalid outcome count");
        require(endTime > block.timestamp, "Invalid end time");

        // Prepare condition
        ctf.prepareCondition(oracle, questionId, outcomeSlotCount);
        conditionId = ctf.getConditionId(oracle, questionId, outcomeSlotCount);

        // Calculate token IDs for all outcomes
        tokenIds = new uint256[](outcomeSlotCount);
        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            bytes32 collectionId = ctf.getCollectionId(
                bytes32(0),
                conditionId,
                1 << i
            );
            tokenIds[i] = ctf.getPositionId(IERC20(collateralToken), collectionId);
            tokenToCondition[tokenIds[i]] = conditionId;
        }

        // Store market
        markets[conditionId] = Market({
            conditionId: conditionId,
            question: question,
            description: description,
            category: category,
            outcomeSlotCount: outcomeSlotCount,
            tokenIds: tokenIds,
            endTime: endTime,
            resolutionTime: resolutionTime,
            status: MarketStatus.Active,
            creator: msg.sender
        });

        emit MarketCreated(
            conditionId,
            questionId,
            question,
            outcomeSlotCount,
            tokenIds,
            msg.sender
        );
    }

    /// @notice Closes a market (no more orders)
    function closeMarket(bytes32 conditionId) external {
        Market storage market = markets[conditionId];
        require(
            msg.sender == market.creator || msg.sender == oracle,
            "Not authorized"
        );
        require(market.status == MarketStatus.Active, "Market not active");

        market.status = MarketStatus.Closed;
    }

    /// @notice Sets the exchange address
    function setExchange(address _exchange) external {
        require(exchange == address(0), "Already set");
        exchange = _exchange;
    }

    /// @notice Gets market info
    function getMarket(bytes32 conditionId) external view returns (Market memory) {
        return markets[conditionId];
    }
}
```

---

## 3. CTFExchange.sol

**Purpose**: Main exchange contract for trading outcome tokens

Based on the Polymarket implementation, the exchange uses a modular design with mixins.

### Order Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/**
 * @title Order Structs
 * @notice Data structures for orders
 */

bytes32 constant ORDER_TYPEHASH = keccak256(
    "Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)"
);

struct Order {
    uint256 salt;              // Unique entropy
    address maker;             // Source of funds
    address signer;            // Signature creator
    address taker;             // Specified taker (0x0 = public order)
    uint256 tokenId;           // CTF token ID
    uint256 makerAmount;       // Amount maker is providing
    uint256 takerAmount;       // Amount maker wants to receive
    uint256 expiration;        // Expiration timestamp
    uint256 nonce;             // For cancellations
    uint256 feeRateBps;        // Fee in basis points
    Side side;                 // BUY or SELL
    SignatureType signatureType;
    bytes signature;
}

enum Side {
    BUY,   // Buying outcome tokens with collateral
    SELL   // Selling outcome tokens for collateral
}

enum SignatureType {
    EOA,              // Standard ECDSA
    POLY_PROXY,       // Proxy wallet
    POLY_GNOSIS_SAFE  // Gnosis Safe
}

enum MatchType {
    COMPLEMENTARY,  // Buy vs Sell (same token)
    MINT,          // Both Buys (complementary tokens) - requires minting
    MERGE          // Both Sells (complementary tokens) - requires merging
}

struct OrderStatus {
    bool isFilledOrCancelled;
    uint256 remaining;
}
```

### Main Exchange Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { Auth } from "./mixins/Auth.sol";
import { Fees } from "./mixins/Fees.sol";
import { Assets } from "./mixins/Assets.sol";
import { Hashing } from "./mixins/Hashing.sol";
import { Trading } from "./mixins/Trading.sol";
import { Registry } from "./mixins/Registry.sol";
import { Pausable } from "./mixins/Pausable.sol";
import { Signatures } from "./mixins/Signatures.sol";
import { NonceManager } from "./mixins/NonceManager.sol";
import { AssetOperations } from "./mixins/AssetOperations.sol";
import { BaseExchange } from "./BaseExchange.sol";
import { Order } from "./libraries/OrderStructs.sol";

/**
 * @title CTF Exchange
 * @notice Facilitates atomic swaps between CTF ERC1155 assets and ERC20 collateral
 * @dev Hybrid exchange: off-chain matching, on-chain non-custodial settlement
 */
contract CTFExchange is
    BaseExchange,
    Auth,
    Assets,
    Fees,
    Pausable,
    AssetOperations,
    Hashing("CTF Exchange", "1"),
    NonceManager,
    Registry,
    Signatures,
    Trading
{
    constructor(
        address _collateral,
        address _ctf,
        address _proxyFactory,
        address _safeFactory
    )
        Assets(_collateral, _ctf)
        Signatures(_proxyFactory, _safeFactory)
    {}

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
                            TRADING
    //////////////////////////////////////////////////////////////*/

    /// @notice Fills an order
    /// @param order - The order to be filled
    /// @param fillAmount - The amount to fill (in maker amount terms)
    function fillOrder(
        Order memory order,
        uint256 fillAmount
    ) external nonReentrant onlyOperator notPaused {
        _fillOrder(order, fillAmount, msg.sender);
    }

    /// @notice Fills multiple orders
    /// @param orders - Orders to be filled
    /// @param fillAmounts - Fill amounts (in maker amount terms)
    function fillOrders(
        Order[] memory orders,
        uint256[] memory fillAmounts
    ) external nonReentrant onlyOperator notPaused {
        _fillOrders(orders, fillAmounts, msg.sender);
    }

    /// @notice Matches a taker order against maker orders
    /// @param takerOrder - Active order
    /// @param makerOrders - Passive orders to match against
    /// @param takerFillAmount - Amount to fill on taker
    /// @param makerFillAmounts - Amounts to fill on makers
    function matchOrders(
        Order memory takerOrder,
        Order[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) external nonReentrant onlyOperator notPaused {
        _matchOrders(takerOrder, makerOrders, takerFillAmount, makerFillAmounts);
    }

    /*//////////////////////////////////////////////////////////////
                        CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Registers a token pair for trading
    /// @param token - Token ID
    /// @param complement - Complement token ID
    /// @param conditionId - CTF condition ID
    function registerToken(
        uint256 token,
        uint256 complement,
        bytes32 conditionId
    ) external onlyAdmin {
        _registerToken(token, complement, conditionId);
    }

    /// @notice Sets proxy factory
    function setProxyFactory(address _newProxyFactory) external onlyAdmin {
        _setProxyFactory(_newProxyFactory);
    }

    /// @notice Sets safe factory
    function setSafeFactory(address _newSafeFactory) external onlyAdmin {
        _setSafeFactory(_newSafeFactory);
    }
}
```

### Trading Logic (Key Mixin)

The trading logic handles three match types:

1. **COMPLEMENTARY** - Buy vs Sell (same token): Direct swap
2. **MINT** - Both Buys (complementary tokens): Mint from collateral
3. **MERGE** - Both Sells (complementary tokens): Merge to collateral

```solidity
/// @notice Example from Trading.sol
function _fillOrder(Order memory order, uint256 fillAmount, address to) internal {
    uint256 making = fillAmount;
    (uint256 taking, bytes32 orderHash) = _performOrderChecks(order, making);

    // Calculate fee
    uint256 fee = CalculatorHelper.calculateFee(
        order.feeRateBps,
        order.side == Side.BUY ? taking : making,
        order.makerAmount,
        order.takerAmount,
        order.side
    );

    (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(order);

    // Transfer proceeds minus fees from operator to maker
    _transfer(msg.sender, order.maker, takerAssetId, taking - fee);

    // Transfer making amount from maker to recipient
    _transfer(order.maker, to, makerAssetId, making);

    emit OrderFilled(orderHash, order.maker, msg.sender, makerAssetId, takerAssetId, making, taking, fee);
}
```

---

## 4. Fee Structure

**Symmetric Fees**: Ensures market integrity for complementary tokens

### Fee Formula

For a binary market where YES + NO = 1 USDC:

```
baseFeeRate = 0.02 (2% base rate, corresponds to 2x the actual fee)

usdcFee = baseFeeRate * min(price, 1-price) * size
```

**Case 1: Selling outcome tokens for collateral**
```
feeQuote = baseFeeRate * min(price, 1-price) * size
```

**Case 2: Buying outcome tokens with collateral**
```
feeBase = baseFeeRate * min(price, 1-price) * (size / price)
```

### Examples (baseFeeRate = 0.02)

| Action | Price | Size | Fee | USD Value |
|--------|-------|------|-----|-----------|
| BUY 100 YES | $0.50 | 100 | 2 YES | $1.00 |
| SELL 100 YES | $0.50 | 100 | 1.0 USDC | $1.00 |
| BUY 100 YES | $0.10 | 100 | 2 YES | $0.20 |
| SELL 100 YES | $0.90 | 100 | 0.2 USDC | $0.20 |

### Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

library CalculatorHelper {
    /// @notice Calculates fee with symmetric pricing
    function calculateFee(
        uint256 feeRateBps,
        uint256 amount,
        uint256 makerAmount,
        uint256 takerAmount,
        Side side
    ) internal pure returns (uint256) {
        if (feeRateBps == 0) return 0;

        // Calculate price
        uint256 price = (takerAmount * 10000) / makerAmount;

        // Calculate min(price, 10000-price)
        uint256 minPrice = price < (10000 - price) ? price : (10000 - price);

        // Calculate fee
        return (amount * feeRateBps * minPrice) / (10000 * 10000);
    }

    /// @notice Calculates taking amount
    function calculateTakingAmount(
        uint256 makingAmount,
        uint256 makerAmount,
        uint256 takerAmount
    ) internal pure returns (uint256) {
        return (makingAmount * takerAmount) / makerAmount;
    }

    /// @notice Checks if orders cross
    function isCrossing(Order memory takerOrder, Order memory makerOrder)
        internal
        pure
        returns (bool)
    {
        // Calculate effective prices
        uint256 takerPrice = (takerOrder.takerAmount * 10000) / takerOrder.makerAmount;
        uint256 makerPrice = (makerOrder.makerAmount * 10000) / makerOrder.takerAmount;

        // Orders cross if taker willing to pay >= maker asking
        return takerPrice >= makerPrice;
    }
}
```

---

## 5. ResolutionOracle.sol

**Purpose**: Resolves market outcomes

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/**
 * @title Resolution Oracle
 * @notice Resolves prediction market outcomes
 */
contract ResolutionOracle {
    IConditionalTokens public immutable ctf;
    address public admin;

    mapping(bytes32 => Resolution) public resolutions;
    mapping(address => bool) public resolvers;

    struct Resolution {
        bytes32 conditionId;
        uint256[] payouts;
        uint256 timestamp;
        address resolver;
        ResolutionStatus status;
    }

    enum ResolutionStatus {
        Unresolved,
        Proposed,
        Disputed,
        Finalized
    }

    event ResolutionProposed(
        bytes32 indexed conditionId,
        bytes32 indexed questionId,
        uint256[] payouts,
        address resolver
    );

    event ResolutionDisputed(
        bytes32 indexed conditionId,
        address disputer
    );

    event ResolutionFinalized(
        bytes32 indexed conditionId,
        uint256[] payouts
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyResolver() {
        require(resolvers[msg.sender], "Not resolver");
        _;
    }

    constructor(address _ctf) {
        ctf = IConditionalTokens(_ctf);
        admin = msg.sender;
        resolvers[msg.sender] = true;
    }

    /// @notice Proposes a resolution
    function proposeResolution(
        bytes32 questionId,
        uint256 outcomeSlotCount,
        uint256[] calldata payouts
    ) external onlyResolver {
        require(payouts.length == outcomeSlotCount, "Invalid payouts length");

        bytes32 conditionId = ctf.getConditionId(
            address(this),
            questionId,
            outcomeSlotCount
        );

        require(resolutions[conditionId].status == ResolutionStatus.Unresolved, "Already resolved");

        // Store proposed resolution
        resolutions[conditionId] = Resolution({
            conditionId: conditionId,
            payouts: payouts,
            timestamp: block.timestamp,
            resolver: msg.sender,
            status: ResolutionStatus.Proposed
        });

        emit ResolutionProposed(conditionId, questionId, payouts, msg.sender);
    }

    /// @notice Finalizes resolution after dispute period
    function finalizeResolution(
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external onlyResolver {
        bytes32 conditionId = ctf.getConditionId(
            address(this),
            questionId,
            outcomeSlotCount
        );

        Resolution storage resolution = resolutions[conditionId];
        require(resolution.status == ResolutionStatus.Proposed, "Not proposed");
        require(block.timestamp >= resolution.timestamp + 1 days, "Dispute period active");

        // Report to CTF
        ctf.reportPayouts(questionId, resolution.payouts);

        resolution.status = ResolutionStatus.Finalized;

        emit ResolutionFinalized(conditionId, resolution.payouts);
    }

    /// @notice Admin can immediately finalize
    function adminFinalizeResolution(
        bytes32 questionId,
        uint256 outcomeSlotCount,
        uint256[] calldata payouts
    ) external onlyAdmin {
        bytes32 conditionId = ctf.getConditionId(
            address(this),
            questionId,
            outcomeSlotCount
        );

        // Report to CTF
        ctf.reportPayouts(questionId, payouts);

        resolutions[conditionId] = Resolution({
            conditionId: conditionId,
            payouts: payouts,
            timestamp: block.timestamp,
            resolver: msg.sender,
            status: ResolutionStatus.Finalized
        });

        emit ResolutionFinalized(conditionId, payouts);
    }

    /// @notice Adds resolver
    function addResolver(address resolver) external onlyAdmin {
        resolvers[resolver] = true;
    }

    /// @notice Removes resolver
    function removeResolver(address resolver) external onlyAdmin {
        resolvers[resolver] = false;
    }
}
```

---

## 6. User Interaction Flows

### Flow 1: Create Market

```
User → MarketFactory.createBinaryMarket()
  ↓
MarketFactory → CTF.prepareCondition()
  ↓
Calculate token IDs for YES/NO
  ↓
MarketFactory → Exchange.registerToken()
  ↓
Emit MarketCreated event
```

### Flow 2: Buy Outcome Tokens

```
User creates signed Order (off-chain)
  ↓
Operator receives order (off-chain)
  ↓
Operator calls Exchange.fillOrder()
  ↓
Exchange validates order & signature
  ↓
Transfer collateral from user → seller
Transfer outcome tokens from seller → user
  ↓
Charge fees to operator
```

### Flow 3: Match Complementary Orders (MINT)

```
UserA: BUY 100 YES @ $0.50 (signed order)
UserB: BUY 100 NO @ $0.50 (signed order)
  ↓
Operator calls Exchange.matchOrders()
  ↓
Pull 50 USDC from UserA
Pull 50 USDC from UserB
  ↓
CTF.splitPosition() - Mint 100 YES + 100 NO
  ↓
Transfer 100 YES → UserA
Transfer 100 NO → UserB
  ↓
Charge fees
```

### Flow 4: Resolve Market & Claim Winnings

```
Oracle → ResolutionOracle.proposeResolution()
  ↓
Wait dispute period (24 hours)
  ↓
Oracle → ResolutionOracle.finalizeResolution()
  ↓
ResolutionOracle → CTF.reportPayouts([1, 0] for YES win)
  ↓
User → CTF.redeemPositions()
  ↓
CTF burns winning tokens, returns collateral
```

---

## 7. Security Considerations

### Access Control

- **Admin**: Can pause trading, register tokens, set fees
- **Operator**: Can execute fills and matches
- **Oracle**: Can resolve markets

### Signature Validation

- EIP-712 typed structured data
- Support for EOA, Proxy wallets, Gnosis Safes
- Nonce management for cancellations

### Reentrancy Protection

- NonReentrant modifiers on all trading functions
- Checks-Effects-Interactions pattern

### Order Validation

```solidity
function _validateOrder(bytes32 orderHash, Order memory order) internal view {
    // Check expiration
    if (order.expiration > 0 && order.expiration < block.timestamp)
        revert OrderExpired();

    // Validate signature
    validateOrderSignature(orderHash, order);

    // Check fee limits
    if (order.feeRateBps > getMaxFeeRate())
        revert FeeTooHigh();

    // Validate token is registered
    validateTokenId(order.tokenId);

    // Check order not already filled/cancelled
    if (orderStatus[orderHash].isFilledOrCancelled)
        revert OrderFilledOrCancelled();

    // Validate nonce
    if (!isValidNonce(order.maker, order.nonce))
        revert InvalidNonce();
}
```

---

## 8. Gas Optimization

### Batch Operations

```solidity
function fillOrders(Order[] memory orders, uint256[] memory fillAmounts)
    external
    nonReentrant
    onlyOperator
    notPaused
{
    uint256 length = orders.length;
    for (uint256 i = 0; i < length;) {
        _fillOrder(orders[i], fillAmounts[i], msg.sender);
        unchecked { ++i; }
    }
}
```

### Immutable Variables

```solidity
address internal immutable collateral;
address internal immutable ctf;
```

### Efficient Storage

```solidity
struct OrderStatus {
    bool isFilledOrCancelled;  // Packed into single slot
    uint256 remaining;
}
```

---

## 9. Testing Requirements

### Unit Tests

- Order validation
- Fee calculations
- Token transfers
- Signature verification
- Nonce management

### Integration Tests

- Market creation flow
- Order matching (all three types)
- Market resolution
- Redemption

### Fuzz Tests

- Random order parameters
- Edge cases in pricing
- Large number scenarios

---

## 10. Deployment Checklist

1. Deploy ConditionalTokens (or use existing)
2. Deploy ResolutionOracle
3. Deploy MarketFactory
4. Deploy CTFExchange
5. Configure admin/operator roles
6. Set fee parameters
7. Register initial markets
8. Verify contracts on block explorer
9. Set up monitoring/alerts
10. Deploy frontend

---

## 11. Event Emissions

### Key Events for Indexing

```solidity
// Exchange events
event OrderFilled(
    bytes32 indexed orderHash,
    address indexed maker,
    address indexed taker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled,
    uint256 fee
);

event OrdersMatched(
    bytes32 indexed takerOrderHash,
    address indexed takerOrderMaker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled
);

event OrderCancelled(bytes32 indexed orderHash);

event FeeCharged(
    address indexed receiver,
    uint256 tokenId,
    uint256 amount
);

// Market events
event MarketCreated(
    bytes32 indexed conditionId,
    bytes32 indexed questionId,
    string question,
    uint256 outcomeSlotCount,
    uint256[] tokenIds,
    address creator
);

event MarketResolved(
    bytes32 indexed conditionId,
    uint256[] payouts
);
```

---

## 12. Off-Chain Components

### Order Book Service

- Receives signed orders via API
- Maintains order book per market
- Matches orders according to price-time priority
- Calls exchange contract to settle matches

### Price Feed

- Aggregates order book data
- Calculates mid-market prices
- Provides historical price data
- WebSocket real-time updates

### Indexer

- Listens to blockchain events
- Updates database with trades, orders, resolutions
- Provides fast queries for UI
- Calculates user positions and P&L

---

## 13. Upgradability Considerations

### Proxy Pattern (Optional)

For upgradability, consider using UUPS or Transparent Proxy:

```solidity
contract CTFExchangeProxy is UUPSUpgradeable, OwnableUpgradeable {
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
```

### Configuration Updates

Non-upgradable contracts can still have updatable parameters:

```solidity
function setMaxFeeRate(uint256 _newMaxFeeRate) external onlyAdmin {
    require(_newMaxFeeRate <= 10000, "Fee too high");
    maxFeeRate = _newMaxFeeRate;
    emit MaxFeeRateUpdated(_newMaxFeeRate);
}
```

---

## Summary

This smart contract architecture provides:

✅ **Modular Design** - Mixins for clean separation of concerns
✅ **Gas Efficient** - Batch operations, optimized storage
✅ **Secure** - Reentrancy protection, signature validation, access control
✅ **Flexible** - Supports binary and multiple choice markets
✅ **Non-Custodial** - Users maintain custody via signed orders
✅ **Symmetric Fees** - Maintains market integrity
✅ **Battle-Tested** - Based on audited Polymarket implementation

The architecture follows the proven CTF Exchange pattern used by Polymarket, ensuring reliability and security for a production prediction market platform.
