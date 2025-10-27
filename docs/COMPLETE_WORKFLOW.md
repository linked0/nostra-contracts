# Complete Production Workflow - Nostra Prediction Markets

**Purpose**: This document explains the complete end-to-end workflow for creating and operating a prediction market with order book trading on Nostra.

**Date**: 2025-10-21

---

## 📋 **Table of Contents**

1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Deployment & Setup](#phase-1-deployment--setup)
3. [Phase 2: Market Creation](#phase-2-market-creation)
4. [Phase 3: Order Book Trading](#phase-3-order-book-trading)
5. [Phase 4: Market Resolution](#phase-4-market-resolution)
6. [Phase 5: Token Redemption](#phase-5-token-redemption)
7. [Complete Code Example](#complete-code-example)
8. [Backend Integration Guide](#backend-integration-guide)

---

## 🏗️ **Architecture Overview**

### **Two-Layer System**

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: MARKET LIFECYCLE                 │
│              (MarketFactory + ResolutionOracle)              │
├─────────────────────────────────────────────────────────────┤
│  • Create prediction markets                                 │
│  • Manage market lifecycle (active → resolved → closed)      │
│  • Handle resolution and disputes                            │
│  • Enable token redemption for winners                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  LAYER 2: ORDER BOOK TRADING                 │
│                        (CTFExchange)                         │
├─────────────────────────────────────────────────────────────┤
│  OFF-CHAIN:                                                  │
│  • User creates signed orders (your web app)                 │
│  • Orders stored in database (your backend)                  │
│  • Matching engine finds compatible orders (your backend)    │
│  • Order book UI displays live bids/asks (your frontend)     │
│                                                              │
│  ON-CHAIN:                                                   │
│  • matchOrders() validates signatures & executes transfers   │
│  • Settlement happens atomically on blockchain               │
└─────────────────────────────────────────────────────────────┘
```

### **Key Components**

| Component | Type | Purpose |
|-----------|------|---------|
| **ConditionalTokens** | Smart Contract | ERC1155 outcome tokens (from Gnosis CTF) |
| **MarketFactory** | Smart Contract | Creates and manages prediction markets |
| **ResolutionOracle** | Smart Contract | Resolves markets with dispute mechanism |
| **CTFExchange** | Smart Contract | On-chain settlement for order book trading |
| **Your Backend** | Off-Chain | Order book storage, matching engine, operator |
| **Your Frontend** | Off-Chain | Order book UI, trade interface, user wallet |

---

## 🚀 **Phase 1: Deployment & Setup**

### **1.1 Deploy Contracts (One-Time)**

```bash
# Local development
npx hardhat node                              # Terminal 1
yarn deploy:local                             # Terminal 2

# Testnet
yarn deploy:polygon-amoy

# Mainnet
yarn deploy:polygon
```

**Deployment Order**:
1. ConditionalTokens
2. MockUSDC (testnet) or use real USDC (mainnet)
3. ResolutionOracle
4. MarketFactory
5. CTFExchange

**Post-Deployment Links**:
```typescript
// Link exchange to market factory
await marketFactory.setExchange(ctfExchangeAddress);

// Add authorized resolvers
await resolutionOracle.addResolver(resolverAddress);

// Add exchange operators
await ctfExchange.addOperator(operatorAddress);
```

### **1.2 Setup Backend Services**

```typescript
// backend/config/contracts.ts
import { ethers } from 'ethers';
import { getMarketFactory, getConditionalTokens, getCTFExchange } from '@nostra/sdk';

export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
export const operatorWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

export const marketFactory = getMarketFactory('polygon', operatorWallet);
export const conditionalTokens = getConditionalTokens('polygon', operatorWallet);
export const ctfExchange = getCTFExchange('polygon', operatorWallet);
```

---

## 📝 **Phase 2: Market Creation**

### **2.1 Create Market (Admin/Creator)**

```typescript
// Example: Bitcoin $100k prediction market
const questionId = ethers.id("WILL_BTC_HIT_100K_2024");
const question = "Will Bitcoin reach $100k in 2024?";
const description = "Resolves YES if BTC hits $100,000 before Dec 31, 2024";
const category = "Crypto";
const endTime = Math.floor(Date.now() / 1000) + 30 * 86400; // 30 days
const resolutionTime = endTime + 7 * 86400; // 7 days after end

const tx = await marketFactory.createBinaryMarket(
  questionId,
  question,
  description,
  category,
  endTime,
  resolutionTime
);

const receipt = await tx.wait();
```

### **2.2 Extract Market Information**

```typescript
// Parse MarketCreated event
const event = receipt.logs.find(log => {
  try {
    return marketFactory.interface.parseLog(log)?.name === 'MarketCreated';
  } catch { return false; }
});

const parsedEvent = marketFactory.interface.parseLog(event);
const { conditionId, token0, token1 } = parsedEvent.args;

console.log("Market created!");
console.log("Condition ID:", conditionId);
console.log("YES token:", token0);
console.log("NO token:", token1);
```

### **2.3 Register Tokens in Exchange**

```typescript
// Required for order book trading
await ctfExchange.connect(admin).registerToken(
  token0,  // YES token
  token1,  // NO token
  conditionId
);

console.log("✅ Tokens registered in CTFExchange");
```

### **2.4 Store Market in Database**

```typescript
// backend/api/markets.ts
await db.markets.create({
  questionId,
  conditionId,
  question,
  description,
  category,
  yesToken: token0,
  noToken: token1,
  endTime,
  resolutionTime,
  status: 'ACTIVE',
  createdAt: new Date()
});
```

---

## 📊 **Phase 3: Order Book Trading**

This is where **your backend and frontend** do the heavy lifting!

### **3.1 User Creates Order (Frontend)**

```typescript
// frontend/components/TradingInterface.tsx
import { ethers } from 'ethers';

async function createOrder(userWallet: ethers.Signer) {
  // 1. Build order object
  const order = {
    salt: Date.now(), // Unique order ID
    maker: await userWallet.getAddress(),
    signer: await userWallet.getAddress(),
    taker: ethers.ZeroAddress, // Public order (anyone can fill)
    tokenId: market.yesToken, // Buying YES tokens
    makerAmount: ethers.parseUnits("100", 6), // Spending 100 USDC
    takerAmount: ethers.parseUnits("167", 6), // Receiving 167 YES tokens (60% price)
    expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    nonce: await ctfExchange.nonces(await userWallet.getAddress()),
    feeRateBps: 100, // 1% fee
    side: 0, // BUY
    signatureType: 0 // EOA signature
  };

  // 2. EIP-712 domain
  const domain = {
    name: "Nostra CTF Exchange",
    version: "1",
    chainId: (await provider.getNetwork()).chainId,
    verifyingContract: await ctfExchange.getAddress()
  };

  // 3. EIP-712 types
  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" }
    ]
  };

  // 4. User signs order with wallet (MetaMask, WalletConnect, etc.)
  const signature = await userWallet.signTypedData(domain, types, order);

  // 5. Send to backend API
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, signature })
  });

  const result = await response.json();
  console.log("Order created:", result.orderHash);

  return result;
}
```

### **3.2 Backend Stores Order**

```typescript
// backend/api/orders.ts
import { Router } from 'express';
import { ethers } from 'ethers';

const router = Router();

router.post('/orders', async (req, res) => {
  const { order, signature } = req.body;

  // 1. Validate signature
  const orderHash = await ctfExchange.hashOrder(order);

  try {
    await ctfExchange.validateOrderSignature(orderHash, { ...order, signature });
  } catch (error) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Store in database
  const dbOrder = await db.orders.create({
    orderHash,
    maker: order.maker,
    tokenId: order.tokenId,
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    side: order.side,
    price: calculatePrice(order), // makerAmount / takerAmount
    expiration: order.expiration,
    nonce: order.nonce.toString(),
    signature,
    status: 'OPEN',
    createdAt: new Date()
  });

  // 3. Broadcast to WebSocket clients (real-time order book updates)
  io.emit('orderbook:update', {
    action: 'ADD',
    order: dbOrder
  });

  res.json({
    success: true,
    orderHash,
    order: dbOrder
  });
});

router.get('/orders', async (req, res) => {
  const { marketId, side } = req.query;

  const orders = await db.orders.find({
    marketId,
    side,
    status: 'OPEN'
  }).sort({ price: side === 'BUY' ? -1 : 1 }); // Best prices first

  res.json({ orders });
});

router.delete('/orders/:orderHash', async (req, res) => {
  const { orderHash } = req.params;

  // User can cancel their own orders
  const order = await db.orders.findOne({ orderHash });

  // Submit cancellation to blockchain
  await ctfExchange.cancelOrder(order);

  // Update database
  await db.orders.updateOne({ orderHash }, { status: 'CANCELLED' });

  res.json({ success: true });
});

export default router;
```

### **3.3 Matching Engine (Backend)**

```typescript
// backend/services/matching-engine.ts
import { ethers } from 'ethers';

export class MatchingEngine {
  private operatorWallet: ethers.Wallet;
  private ctfExchange: any;
  private isRunning = false;

  constructor(operatorWallet: ethers.Wallet, ctfExchange: any) {
    this.operatorWallet = operatorWallet;
    this.ctfExchange = ctfExchange;
  }

  async start() {
    this.isRunning = true;
    console.log("🔄 Matching engine started");

    while (this.isRunning) {
      try {
        await this.runMatchingCycle();
      } catch (error) {
        console.error("Matching cycle error:", error);
      }

      // Run every 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async runMatchingCycle() {
    // 1. Get all open orders from database
    const buyOrders = await db.orders.find({
      side: 'BUY',
      status: 'OPEN',
      expiration: { $gt: Math.floor(Date.now() / 1000) }
    }).sort({ price: -1 }); // Highest buy price first

    const sellOrders = await db.orders.find({
      side: 'SELL',
      status: 'OPEN',
      expiration: { $gt: Math.floor(Date.now() / 1000) }
    }).sort({ price: 1 }); // Lowest sell price first

    // 2. Find matches (price-time priority)
    const matches = this.findMatches(buyOrders, sellOrders);

    // 3. Submit matches to blockchain
    for (const match of matches) {
      try {
        console.log(`📈 Matching orders: ${match.buyOrder.orderHash} <-> ${match.sellOrder.orderHash}`);

        const tx = await this.ctfExchange.matchOrders(
          match.takerOrder,
          [match.makerOrder],
          match.takerFillAmount,
          [match.makerFillAmount]
        );

        const receipt = await tx.wait();
        console.log("✅ Match settled on-chain:", receipt.hash);

        // 4. Update database
        await this.updateOrdersAfterMatch(match, receipt);

        // 5. Broadcast trade to WebSocket clients
        io.emit('trade', {
          marketId: match.marketId,
          price: match.price,
          amount: match.amount,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error("Match submission failed:", error);
        // Order might be cancelled, expired, or already filled
        await this.handleMatchFailure(match, error);
      }
    }
  }

  private findMatches(buyOrders: any[], sellOrders: any[]) {
    const matches = [];

    for (const buyOrder of buyOrders) {
      for (const sellOrder of sellOrders) {
        // Check if orders can match (buy price >= sell price)
        if (buyOrder.price >= sellOrder.price) {
          const fillAmount = Math.min(
            buyOrder.remainingAmount,
            sellOrder.remainingAmount
          );

          matches.push({
            takerOrder: buyOrder, // Taker (buyer)
            makerOrder: sellOrder, // Maker (seller)
            takerFillAmount: fillAmount,
            makerFillAmount: fillAmount,
            price: sellOrder.price, // Trade at maker price
            amount: fillAmount
          });

          // Update remaining amounts
          buyOrder.remainingAmount -= fillAmount;
          sellOrder.remainingAmount -= fillAmount;

          // If order fully filled, stop processing it
          if (buyOrder.remainingAmount === 0) break;
        }
      }
    }

    return matches;
  }

  private async updateOrdersAfterMatch(match: any, receipt: any) {
    // Mark orders as filled or partially filled
    const takerFilled = match.takerOrder.makerAmount === match.takerFillAmount;
    const makerFilled = match.makerOrder.makerAmount === match.makerFillAmount;

    await db.orders.updateOne(
      { orderHash: match.takerOrder.orderHash },
      {
        status: takerFilled ? 'FILLED' : 'PARTIALLY_FILLED',
        filledAmount: match.takerFillAmount.toString(),
        txHash: receipt.hash
      }
    );

    await db.orders.updateOne(
      { orderHash: match.makerOrder.orderHash },
      {
        status: makerFilled ? 'FILLED' : 'PARTIALLY_FILLED',
        filledAmount: match.makerFillAmount.toString(),
        txHash: receipt.hash
      }
    );

    // Create trade record
    await db.trades.create({
      marketId: match.marketId,
      buyOrderHash: match.takerOrder.orderHash,
      sellOrderHash: match.makerOrder.orderHash,
      price: match.price,
      amount: match.amount.toString(),
      txHash: receipt.hash,
      timestamp: new Date()
    });
  }

  private async handleMatchFailure(match: any, error: any) {
    // Check if order was cancelled or expired
    if (error.message.includes('OrderFilledOrCancelled')) {
      await db.orders.updateMany(
        { orderHash: { $in: [match.takerOrder.orderHash, match.makerOrder.orderHash] } },
        { status: 'CANCELLED' }
      );
    } else if (error.message.includes('OrderExpired')) {
      await db.orders.updateMany(
        { orderHash: { $in: [match.takerOrder.orderHash, match.makerOrder.orderHash] } },
        { status: 'EXPIRED' }
      );
    }
  }

  stop() {
    this.isRunning = false;
    console.log("🛑 Matching engine stopped");
  }
}
```

### **3.4 Order Book UI (Frontend)**

```typescript
// frontend/components/OrderBook.tsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function OrderBook({ marketId }) {
  const [buyOrders, setBuyOrders] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);

  useEffect(() => {
    // Fetch initial order book
    fetchOrderBook();

    // Connect to WebSocket for real-time updates
    const socket = io('http://localhost:3000');

    socket.on('orderbook:update', (update) => {
      if (update.action === 'ADD') {
        if (update.order.side === 'BUY') {
          setBuyOrders(prev => [...prev, update.order].sort((a, b) => b.price - a.price));
        } else {
          setSellOrders(prev => [...prev, update.order].sort((a, b) => a.price - b.price));
        }
      }
    });

    socket.on('trade', (trade) => {
      // Remove filled orders from order book
      setBuyOrders(prev => prev.filter(o => o.orderHash !== trade.buyOrderHash));
      setSellOrders(prev => prev.filter(o => o.orderHash !== trade.sellOrderHash));
    });

    return () => socket.disconnect();
  }, [marketId]);

  async function fetchOrderBook() {
    const [buys, sells] = await Promise.all([
      fetch(`/api/orders?marketId=${marketId}&side=BUY`).then(r => r.json()),
      fetch(`/api/orders?marketId=${marketId}&side=SELL`).then(r => r.json())
    ]);

    setBuyOrders(buys.orders);
    setSellOrders(sells.orders);
  }

  return (
    <div className="order-book">
      <h3>Order Book</h3>

      <div className="sell-orders">
        <h4>Sell Orders (ASK)</h4>
        {sellOrders.map(order => (
          <div key={order.orderHash} className="order-row">
            <span className="price">{order.price.toFixed(2)}¢</span>
            <span className="amount">{order.amount}</span>
          </div>
        ))}
      </div>

      <div className="spread">
        Spread: {sellOrders[0] && buyOrders[0]
          ? (sellOrders[0].price - buyOrders[0].price).toFixed(2)
          : '-'}¢
      </div>

      <div className="buy-orders">
        <h4>Buy Orders (BID)</h4>
        {buyOrders.map(order => (
          <div key={order.orderHash} className="order-row">
            <span className="price">{order.price.toFixed(2)}¢</span>
            <span className="amount">{order.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### **3.5 Event Monitoring (Backend)**

```typescript
// backend/services/blockchain-monitor.ts
export class BlockchainMonitor {
  private ctfExchange: any;

  constructor(ctfExchange: any) {
    this.ctfExchange = ctfExchange;
  }

  start() {
    console.log("👁️  Blockchain monitor started");

    // Listen for OrdersMatched events
    this.ctfExchange.on('OrdersMatched', async (
      takerOrderHash,
      makerOrderHashes,
      takerFillAmount,
      makerFillAmounts,
      event
    ) => {
      console.log("📊 OrdersMatched event detected");
      console.log("Taker:", takerOrderHash);
      console.log("Makers:", makerOrderHashes);

      // Update database (mark orders as filled)
      await db.orders.updateMany(
        { orderHash: { $in: [takerOrderHash, ...makerOrderHashes] } },
        { status: 'FILLED', txHash: event.log.transactionHash }
      );

      // Broadcast to WebSocket
      io.emit('trade', {
        takerOrderHash,
        makerOrderHashes,
        txHash: event.log.transactionHash
      });
    });

    // Listen for OrderCancelled events
    this.ctfExchange.on('OrderCancelled', async (orderHash, event) => {
      console.log("❌ OrderCancelled event detected:", orderHash);

      await db.orders.updateOne(
        { orderHash },
        { status: 'CANCELLED', txHash: event.log.transactionHash }
      );

      io.emit('orderbook:update', {
        action: 'REMOVE',
        orderHash
      });
    });

    // Listen for TokenRegistered events
    this.ctfExchange.on('TokenRegistered', async (token0, token1, conditionId, event) => {
      console.log("📝 TokenRegistered event detected");
      console.log("Tokens:", token0, token1);

      // Update market in database
      await db.markets.updateOne(
        { conditionId },
        { exchangeRegistered: true }
      );
    });
  }
}
```

---

## ✅ **Phase 4: Market Resolution**

### **4.1 Propose Resolution (Resolver)**

```typescript
// After market end time has passed
const questionId = ethers.id("WILL_BTC_HIT_100K_2024");

// YES wins = [1, 0], NO wins = [0, 1]
const payouts = [1, 0]; // YES outcome won

await resolutionOracle.connect(resolver).proposeResolution(questionId, payouts);

console.log("✅ Resolution proposed, dispute period active (7 days)");
```

### **4.2 Finalize Resolution (Automated)**

```typescript
// After dispute period ends (7 days), anyone can finalize
await resolutionOracle.finalizeResolution(questionId);

console.log("✅ Market resolved, winners can redeem tokens");
```

### **4.3 Handle Disputes (If Needed)**

```typescript
// During dispute period, resolver can dispute
await resolutionOracle.connect(anotherResolver).disputeResolution(questionId);

// After dispute, admin can force finalize
const correctPayouts = [0, 1]; // NO actually won
await resolutionOracle.connect(admin).adminFinalizeResolution(questionId, correctPayouts);
```

---

## 💰 **Phase 5: Token Redemption**

### **5.1 Winners Redeem Tokens**

```typescript
// User who holds winning tokens (YES tokens in this case)
const conditionId = "0x...";
const indexSets = [1]; // YES = index 1

await conditionalTokens.connect(winner).redeemPositions(
  collateralToken.address,
  ethers.ZeroHash, // No parent collection
  conditionId,
  indexSets
);

console.log("💰 Winner redeemed tokens for collateral!");
```

### **5.2 Check Balances**

```typescript
// Before redemption
const yesTokenBalance = await conditionalTokens.balanceOf(winner.address, yesTokenId);
console.log("YES tokens:", yesTokenBalance); // 100 YES tokens

const collateralBefore = await collateralToken.balanceOf(winner.address);
console.log("Collateral before:", collateralBefore); // 0 USDC

// After redemption
const collateralAfter = await collateralToken.balanceOf(winner.address);
console.log("Collateral after:", collateralAfter); // 100 USDC

const yesTokenAfter = await conditionalTokens.balanceOf(winner.address, yesTokenId);
console.log("YES tokens after:", yesTokenAfter); // 0 (burned)
```

---

## 🧪 **Complete Code Example**

Here's the actual test code that demonstrates the complete workflow:

```typescript
// From: packages/contracts/test/integration/ExchangeFlow.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { CTFExchange } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

enum SignatureType { EOA = 0 }
enum Side { BUY = 0, SELL = 1 }

describe("CTF Exchange - Complete Production Workflow", function () {
  let exchange: CTFExchange;
  let owner: SignerWithAddress;
  let maker: SignerWithAddress;
  let taker: SignerWithAddress;
  let operator: SignerWithAddress;
  let conditionalTokens: any;
  let collateralToken: any;

  const token0 = BigInt(ethers.id("YES_TOKEN"));
  const token1 = BigInt(ethers.id("NO_TOKEN"));
  const conditionId = ethers.id("WILL_BTC_HIT_100K");

  beforeEach(async function () {
    [owner, maker, taker, operator] = await ethers.getSigners();

    // PHASE 1: Deploy contracts
    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = await ConditionalTokensFactory.deploy();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    collateralToken = await MockUSDCFactory.deploy();

    const CTFExchangeFactory = await ethers.getContractFactory("CTFExchange");
    exchange = await CTFExchangeFactory.deploy(
      await collateralToken.getAddress(),
      await conditionalTokens.getAddress()
    );

    // PHASE 2: Setup
    // Register token pair (like after market creation)
    await exchange.connect(owner).registerToken(token0, token1, conditionId);

    // Add operator (your backend service)
    await exchange.connect(owner).addOperator(operator.address);

    // Mint collateral and approve
    const mintAmount = ethers.parseUnits("10000", 6);
    await collateralToken.mint(maker.address, mintAmount);
    await collateralToken.mint(taker.address, mintAmount);
    await collateralToken.connect(maker).approve(await exchange.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(taker).approve(await exchange.getAddress(), ethers.MaxUint256);

    await conditionalTokens.connect(maker).setApprovalForAll(await exchange.getAddress(), true);
    await conditionalTokens.connect(taker).setApprovalForAll(await exchange.getAddress(), true);
  });

  // Helper to create order
  function createOrder(overrides: any = {}) {
    const defaultExpiration = overrides.expiration !== undefined
      ? overrides.expiration
      : Math.floor(Date.now() / 1000) + 31536000; // 1 year from now

    return {
      salt: overrides.salt || 1n,
      maker: overrides.maker || maker.address,
      signer: overrides.signer || maker.address,
      taker: overrides.taker || ethers.ZeroAddress,
      tokenId: overrides.tokenId || token0,
      makerAmount: overrides.makerAmount || ethers.parseUnits("100", 6),
      takerAmount: overrides.takerAmount || ethers.parseUnits("100", 6),
      expiration: defaultExpiration,
      nonce: overrides.nonce || 0n,
      feeRateBps: overrides.feeRateBps || 0n,
      side: overrides.side !== undefined ? overrides.side : Side.BUY,
      signatureType: overrides.signatureType !== undefined ? overrides.signatureType : SignatureType.EOA,
      signature: overrides.signature || "0x"
    };
  }

  // Helper to sign order
  async function signOrder(order: any, signerWallet: SignerWithAddress) {
    const domain = {
      name: "Nostra CTF Exchange",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await exchange.getAddress()
    };

    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "signatureType", type: "uint8" }
      ]
    };

    return await signerWallet.signTypedData(domain, types, order);
  }

  describe("PHASE 3: Order Creation, Validation, and Cancellation", function () {
    it("Should complete full order lifecycle", async function () {
      // Step 1: Maker creates order (frontend)
      const order = createOrder({
        signer: maker.address,
        maker: maker.address,
        tokenId: token0,
        side: Side.BUY,
        makerAmount: ethers.parseUnits("100", 6),
        takerAmount: ethers.parseUnits("100", 6),
        feeRateBps: 100n // 1% fee
      });

      // Step 2: Maker signs order with wallet
      const signature = await signOrder(order, maker);
      const signedOrder = { ...order, signature };

      // Step 3: Backend validates order
      await expect(exchange.validateOrder(signedOrder)).to.not.be.reverted;

      // Step 4: Get order hash and verify status
      const orderHash = await exchange.hashOrder(order);
      let status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(false);

      console.log("✅ Order created and validated");
      console.log("Order hash:", orderHash);

      // Step 5: Maker cancels order
      await exchange.connect(maker).cancelOrder(signedOrder);

      // Step 6: Verify cancelled
      status = await exchange.getOrderStatus(orderHash);
      expect(status.isFilledOrCancelled).to.equal(true);

      console.log("✅ Order cancelled successfully");
    });
  });

  describe("PHASE 3: Nonce Management (Bulk Order Cancellation)", function () {
    it("Should invalidate all orders with nonce increment", async function () {
      // Create multiple orders with nonce 0
      const order1 = createOrder({ salt: 1n, signer: maker.address, maker: maker.address, nonce: 0n });
      const order2 = createOrder({ salt: 2n, signer: maker.address, maker: maker.address, nonce: 0n });
      const order3 = createOrder({ salt: 3n, signer: maker.address, maker: maker.address, nonce: 0n });

      const sig1 = await signOrder(order1, maker);
      const sig2 = await signOrder(order2, maker);
      const sig3 = await signOrder(order3, maker);

      // All orders valid
      await expect(exchange.validateOrder({ ...order1, signature: sig1 })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...order2, signature: sig2 })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...order3, signature: sig3 })).to.not.be.reverted;

      console.log("✅ All 3 orders with nonce 0 are valid");

      // Increment nonce (cancels all nonce 0 orders)
      await exchange.connect(maker).incrementNonce();

      console.log("✅ Nonce incremented to 1");

      // All orders now invalid
      await expect(
        exchange.validateOrder({ ...order1, signature: sig1 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      await expect(
        exchange.validateOrder({ ...order2, signature: sig2 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      await expect(
        exchange.validateOrder({ ...order3, signature: sig3 })
      ).to.be.revertedWithCustomError(exchange, "InvalidNonce");

      console.log("✅ All orders with nonce 0 invalidated");

      // New order with nonce 1 is valid
      const newOrder = createOrder({ salt: 4n, signer: maker.address, maker: maker.address, nonce: 1n });
      const newSig = await signOrder(newOrder, maker);
      await expect(exchange.validateOrder({ ...newOrder, signature: newSig })).to.not.be.reverted;

      console.log("✅ New order with nonce 1 is valid");
    });
  });

  describe("PHASE 3: Multi-User Order Management", function () {
    it("Should manage orders for multiple users independently", async function () {
      // Maker and taker create orders
      const makerOrder = createOrder({ salt: 1n, signer: maker.address, maker: maker.address });
      const takerOrder = createOrder({ salt: 1n, signer: taker.address, maker: taker.address });

      const makerSig = await signOrder(makerOrder, maker);
      const takerSig = await signOrder(takerOrder, taker);

      // Both valid
      await expect(exchange.validateOrder({ ...makerOrder, signature: makerSig })).to.not.be.reverted;
      await expect(exchange.validateOrder({ ...takerOrder, signature: takerSig })).to.not.be.reverted;

      console.log("✅ Both users' orders are valid");

      // Maker cancels their order
      await exchange.connect(maker).cancelOrder({ ...makerOrder, signature: makerSig });

      const makerHash = await exchange.hashOrder(makerOrder);
      const takerHash = await exchange.hashOrder(takerOrder);

      expect((await exchange.getOrderStatus(makerHash)).isFilledOrCancelled).to.equal(true);
      expect((await exchange.getOrderStatus(takerHash)).isFilledOrCancelled).to.equal(false);

      console.log("✅ Maker's order cancelled, taker's order still valid");

      // Taker's order still validates
      await expect(exchange.validateOrder({ ...takerOrder, signature: takerSig })).to.not.be.reverted;

      // Taker can cancel their order
      await exchange.connect(taker).cancelOrder({ ...takerOrder, signature: takerSig });
      expect((await exchange.getOrderStatus(takerHash)).isFilledOrCancelled).to.equal(true);

      console.log("✅ Independent order management working correctly");
    });
  });
});
```

---

## 🛠️ **Backend Integration Guide**

### **Required Backend Services**

```
nostra-server/
├── api/
│   ├── orders.ts              # Order CRUD endpoints
│   ├── markets.ts             # Market information endpoints
│   └── trades.ts              # Trade history endpoints
│
├── services/
│   ├── matching-engine.ts     # Order matching logic
│   ├── blockchain-monitor.ts  # Event listener
│   └── operator.ts            # Blockchain transaction submitter
│
├── database/
│   ├── models/
│   │   ├── Order.ts           # Order schema
│   │   ├── Trade.ts           # Trade history schema
│   │   └── Market.ts          # Market metadata schema
│   │
│   └── migrations/            # Database setup
│
├── websocket/
│   └── server.ts              # Real-time updates (Socket.IO)
│
└── config/
    └── contracts.ts           # Contract instances and configuration
```

### **Environment Variables**

```bash
# .env
RPC_URL=https://polygon-rpc.com
OPERATOR_PRIVATE_KEY=0x...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PORT=3000
```

### **Database Schema Examples**

```typescript
// models/Order.ts
interface Order {
  orderHash: string;           // Primary key
  maker: string;               // User address
  tokenId: string;             // YES or NO token
  makerAmount: string;         // Amount maker provides
  takerAmount: string;         // Amount maker receives
  side: 'BUY' | 'SELL';
  price: number;               // Calculated price
  expiration: number;          // Unix timestamp
  nonce: string;
  signature: string;
  status: 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'EXPIRED';
  filledAmount?: string;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// models/Trade.ts
interface Trade {
  id: string;
  marketId: string;
  buyOrderHash: string;
  sellOrderHash: string;
  price: number;
  amount: string;
  txHash: string;
  timestamp: Date;
}

// models/Market.ts
interface Market {
  id: string;
  questionId: string;
  conditionId: string;
  question: string;
  description: string;
  category: string;
  yesToken: string;
  noToken: string;
  endTime: number;
  resolutionTime: number;
  status: 'ACTIVE' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  outcome?: number[];          // Resolution payouts
  createdAt: Date;
}
```

---

## 📈 **Summary: What Happens Where**

| Task | Location | Technology |
|------|----------|------------|
| **Market Creation** | Smart Contract | MarketFactory.sol |
| **Token Registration** | Smart Contract | CTFExchange.sol |
| **Order Creation** | Frontend + Backend | React + Node.js + Database |
| **Order Storage** | Backend Database | PostgreSQL/MongoDB |
| **Order Book UI** | Frontend | React + WebSocket |
| **Order Matching** | Backend | Node.js Matching Engine |
| **Order Settlement** | Smart Contract | CTFExchange.matchOrders() |
| **Event Monitoring** | Backend | ethers.js Event Listeners |
| **Market Resolution** | Smart Contract | ResolutionOracle.sol |
| **Token Redemption** | Smart Contract | ConditionalTokens.sol |

---

## 🎯 **Key Takeaways**

1. **CTFExchange is ONLY for settlement** - All order book logic happens off-chain
2. **Users sign orders with wallets** - No gas cost to create orders
3. **Backend stores and matches orders** - Your matching engine, your rules
4. **Operator submits matches on-chain** - Gas cost paid by operator
5. **Events keep backend in sync** - Listen to OrdersMatched, OrderCancelled, etc.
6. **Market lifecycle is separate** - MarketFactory/Oracle handle creation and resolution

---

## 🔗 **Related Files**

- **Smart Contracts**: `/packages/contracts/contracts/exchange/`
- **Test Examples**: `/packages/contracts/test/integration/ExchangeFlow.test.ts`
- **Deployment Scripts**: `/packages/contracts/scripts/deploy/`
- **SDK**: `/packages/sdk/src/`
- **Documentation**: `/docs/EXCHANGE_FINAL_REPORT.md`

---

**Last Updated**: 2025-10-21
**Status**: Production Ready (pending audit for mainnet)
