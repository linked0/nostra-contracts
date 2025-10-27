# Market Creation Policy

This document outlines the design considerations and chosen policy for how new prediction markets are created on the Nostra platform.

## Background

A critical design decision for any prediction market is determining who has the authority to create new markets. This choice directly impacts platform decentralization, market quality, and user experience. There are three primary models to consider.

### 1. Curated Model (e.g., Polymarket)

-   **How it works:** Only the core team or a small, whitelisted group of trusted creators can create markets.
-   **Pros:** Ensures high-quality, unambiguous markets and prevents spam. Allows for better focus on providing liquidity for a few key markets.
-   **Cons:** Highly centralized. It limits the platform's growth to the capacity of the curation team and goes against the ethos of decentralization.

### 2. Permissionless Model (e.g., Augur)

-   **How it works:** Any user can create a market at any time.
-   **Pros:** Fully decentralized and open, allowing for a wide variety of markets.
-   **Cons:** Prone to spam, low-quality or nonsensical markets, and liquidity fragmentation across too many markets. This can lead to a poor user experience.

### 3. Token-Gated Model (The Nostra Approach)

-   **How it works:** Any user who holds a specific platform token (`AimondToken`) can create a new market.
-   **Pros:**
    -   **Balanced Decentralization:** It strikes a great balance between a fully open and a fully closed system. It decentralizes market creation beyond just the core team.
    -   **Spam Reduction:** Requiring a token creates a barrier to entry that effectively disincentivizes spam and low-effort market creation.
    -   **Community Empowerment:** It gives utility to the `AimondToken` and creates a community of invested stakeholders who are more likely to create high-quality markets.
    -   **Flexibility:** The barrier to entry can be tuned. For example, we could later require a *minimum balance* of `AimondToken` to further increase the quality of market creators.
-   **Cons:**
    -   It is still a barrier for brand-new users who may not have the token.
    -   It doesn't completely guarantee high-quality markets if the token is very easy to acquire.

### 4. Staking & Slashing Model (with Community Governance)

-   **How it works:** This is an advanced version of the token-gated model.
    1.  A market creator must deposit a stake of collateral (e.g., USDC).
    2.  If the market is later deemed to be "sub-standard" (e.g., ambiguous or unethical), other token holders (**participants**) can vote on whether to punish the creator.
    3.  If a high consensus threshold is met (e.g., 90% agreement among all voting stakers), **one-tenth (10%) of the creator's stake is slashed**.
    4.  The slashed funds are then **distributed proportionally among the participants who voted in favor of the punishment**.
-   **Pros:**
    -   **Strongest Incentive for Quality:** Creates a direct financial penalty for creating bad markets, ensuring creators are highly motivated to be clear and objective.
    -   **Decentralized Enforcement:** Empowers the community to police itself, rather than relying on a central team.
    -   **Incentivizes Participation:** Rewarding voters who correctly identify and slash bad markets encourages active and responsible community governance.
-   **Cons:**
    -   **Highest Barrier to Entry:** The stake requirement significantly increases the cost and risk for market creators.
    -   **Governance Overhead:** Requires a robust and fair process to handle disputes and decide on slashing, which adds significant complexity.

## Our Opinion and Decision (Updated)

For the initial MVP, the simple **Token-Gated Model** is a good starting point.

However, the ideal long-term vision is the **Staking & Slashing Model**.

My opinion is that while the simple token-gated model is a good start, the staking and slashing mechanism provides a much stronger foundation for long-term platform health and market integrity. It creates a system where the community is empowered not only to create markets but also to enforce its own quality standards.

By requiring a slashable stake that is governed by the community, we ensure that market creators are directly accountable for the quality of their contributions. This is a powerful and elegant solution that should be a key feature in a future version of the platform.