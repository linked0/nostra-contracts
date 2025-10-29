# Market Grouping Proposal

## Problem

Polymarket-style grouped binary markets (e.g., "Who will win MVP?" with 3 separate YES/NO markets) have no on-chain relationship. Cannot query "all markets in group X".

## Current State

```solidity
struct Market {
    bytes32 conditionId;
    string question;
    string description;
    string category;        // Generic: "Sports"
    uint256 outcomeSlotCount;
    uint256[] tokenIds;
    uint256 endTime;
    uint256 resolutionTime;
    MarketStatus status;
    address creator;
    uint256 createdAt;
}
```

**Issue**: No `groupId` field to link related markets.

## Proposed Solutions

### Option 1: Add `groupId` Field (Recommended for V2)

```solidity
struct Market {
    bytes32 conditionId;
    bytes32 groupId;        // NEW: 0x0 for standalone, hash for grouped
    string question;
    string description;
    string category;
    uint256 outcomeSlotCount;
    uint256[] tokenIds;
    uint256 endTime;
    uint256 resolutionTime;
    MarketStatus status;
    address creator;
    uint256 createdAt;
}

// Add registry
mapping(bytes32 => bytes32[]) public marketGroups;  // groupId => conditionIds[]

event MarketCreated(
    bytes32 indexed conditionId,
    bytes32 indexed questionId,
    bytes32 indexed groupId,    // NEW: indexed for off-chain queries
    string question,
    uint256 outcomeSlotCount,
    uint256[] tokenIds,
    address creator
);

function createBinaryMarket(
    bytes32 questionId,
    string calldata question,
    string calldata description,
    string calldata category,
    uint256 endTime,
    uint256 resolutionTime,
    bytes32 groupId             // NEW: optional (0x0 for standalone)
) external returns (bytes32 conditionId, uint256[] memory tokenIds) {
    // ...existing logic...

    markets[conditionId] = Market({
        conditionId: conditionId,
        groupId: groupId,
        question: question,
        // ...
    });

    // Register in group
    if (groupId != bytes32(0)) {
        marketGroups[groupId].push(conditionId);
    }

    emit MarketCreated(conditionId, questionId, groupId, question, ...);
}

// Query helper
function getMarketGroup(bytes32 groupId) external view returns (bytes32[] memory) {
    return marketGroups[groupId];
}
```

**Pros**:
- ✅ Clean data model
- ✅ On-chain queryable
- ✅ Indexed events for off-chain indexing
- ✅ Backward compatible (groupId=0x0 for standalone)

**Cons**:
- ❌ Requires contract upgrade
- ❌ Storage cost (1 slot per market)

### Option 2: Use Category Field (Current Deployment)

```typescript
// In script: Encode groupId in category
const category = `Sports:WorldSeriesMVP:${marketGroupId}`;

await marketFactory.createBinaryMarket(
    questionId,
    question,
    description,
    category,  // "Sports:WorldSeriesMVP:1761629857076"
    endTime,
    resolutionTime
);
```

**Query Pattern**:
```typescript
// Off-chain indexer
const markets = await marketFactory.queryFilter(
    marketFactory.filters.MarketCreated()
);

const grouped = markets.filter(m =>
    m.args.question.includes("World Series MVP")
);
```

**Pros**:
- ✅ No contract changes needed
- ✅ Works with current deployment

**Cons**:
- ❌ Overloading category field
- ❌ Requires string parsing
- ❌ Not indexed/queryable efficiently

### Option 3: Off-Chain Database (Pragmatic)

```typescript
// Backend tracks relationships
interface MarketGroup {
    groupId: string;
    name: string;
    markets: {
        conditionId: string;
        question: string;
        playerName: string;
    }[];
}

// Store in database
await db.marketGroups.create({
    groupId: '1761629857076',
    name: 'World Series MVP 2025',
    markets: [
        { conditionId: '0xa4efe...', question: '...Ohtani...', player: 'Ohtani' },
        { conditionId: '0x4a8dd...', question: '...Guerrero...', player: 'Guerrero' },
        { conditionId: '0xfc626...', question: '...Yamamoto...', player: 'Yamamoto' },
    ]
});
```

**Pros**:
- ✅ No contract changes needed
- ✅ Most flexible
- ✅ Can add metadata (player stats, images, etc.)
- ✅ Works with current deployment

**Cons**:
- ❌ Centralized (requires backend)
- ❌ Not trustless

### Option 4: Enhanced Events (Minimal Contract Change)

```solidity
event MarketGroupCreated(
    bytes32 indexed groupId,
    string groupName,
    bytes32[] conditionIds
);

// Emit after creating all markets in group
function createMarketGroup(
    bytes32 groupId,
    string calldata groupName,
    // ... market parameters arrays
) external {
    bytes32[] memory conditionIds = new bytes32[](playerCount);

    for (uint i = 0; i < playerCount; i++) {
        (bytes32 conditionId, ) = _createBinaryMarket(...);
        conditionIds[i] = conditionId;
    }

    emit MarketGroupCreated(groupId, groupName, conditionIds);
}
```

**Pros**:
- ✅ Indexed for off-chain queries
- ✅ Atomic group creation
- ✅ Minimal storage cost

**Cons**:
- ❌ Requires contract upgrade
- ❌ Less flexible than separate market creation

## Recommendation

### For Current Deployment (BSC Testnet)
**Use Option 3 (Off-Chain Database)** + **Option 2 (Category field)**:

```typescript
// In 01-create-market.ts
const marketGroupId = Date.now();
const category = `Sports:WorldSeriesMVP:${marketGroupId}`;

// Store in database
await backend.createMarketGroup({
    groupId: marketGroupId.toString(),
    name: 'World Series MVP 2025',
    category: 'Sports',
    markets: [/* conditionIds after creation */]
});
```

### For Next Contract Version (V2)
**Use Option 1 (Add groupId field)**:
- Clean architecture
- On-chain queryable
- Backward compatible with standalone markets

## Migration Path

1. **Phase 1 (Current)**: Use off-chain database + category encoding
2. **Phase 2 (V2 contracts)**: Deploy with groupId field
3. **Phase 3**: Migrate important groups to V2, keep old data indexed

## Implementation for Current Deployment

```typescript
// packages/contracts/scripts/interact/world-series-mvp/01-create-market.ts

const marketGroupId = Date.now();
const groupName = "World Series MVP 2025";
const category = `Sports:MVP:${marketGroupId}`;

console.log(`\n🎯 Market Group Details:`);
console.log(`Group ID: ${marketGroupId}`);
console.log(`Group Name: ${groupName}`);
console.log(`Category (with group): ${category}`);

// Create markets
for (let i = 0; i < players.length; i++) {
    await marketFactory.createBinaryMarket(
        questionId,
        question,
        description,
        category,  // Encodes groupId
        endTime,
        resolutionTime
    );
}

// Save to JSON for backend ingestion
fs.writeFileSync(`market-group-${marketGroupId}.json`, JSON.stringify({
    groupId: marketGroupId,
    groupName: groupName,
    category: 'Sports',
    subcategory: 'MVP',
    markets: markets.map(m => ({
        conditionId: m.conditionId,
        question: m.question,
        playerName: m.player.name,
        yesTokenId: m.yesTokenId,
        noTokenId: m.noTokenId
    }))
}, null, 2));
```

## Query Patterns

### Off-Chain (Indexer)

```typescript
// Index MarketCreated events
const events = await marketFactory.queryFilter(
    marketFactory.filters.MarketCreated()
);

// Group by category pattern
const groups = events.reduce((acc, event) => {
    const match = event.args.category?.match(/^(.+):(.+):(\d+)$/);
    if (match) {
        const [, category, subcategory, groupId] = match;
        if (!acc[groupId]) acc[groupId] = [];
        acc[groupId].push({
            conditionId: event.args.conditionId,
            question: event.args.question,
            category,
            subcategory
        });
    }
    return acc;
}, {});
```

### Frontend API

```typescript
// GET /api/market-groups/1761629857076
{
    "groupId": "1761629857076",
    "name": "World Series MVP 2025",
    "category": "Sports",
    "subcategory": "MVP",
    "markets": [
        {
            "conditionId": "0xa4efe349...",
            "question": "Will Shohei Ohtani win...",
            "playerName": "Shohei Ohtani",
            "yesTokenId": "87843816...",
            "noTokenId": "97819663...",
            "yesPrice": "0.65",
            "noPrice": "0.35"
        },
        // ...
    ]
}
```
