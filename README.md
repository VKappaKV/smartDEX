# 🧠 SmartDex

**SmartDex** is an **intent-based decentralized exchange (DEX)** designed to empower peer-to-peer DeFi through open, trustless order creation and a unique Dutch auction-style order matching system. Rather than relying on centralized matching engines or AMMs, SmartDex introduces a new trading paradigm where users register trade intents directly on-chain and other users fulfill them in a permissionless marketplace.

---

## 🚀 Overview

Traditional DEXs rely on Automated Market Makers (AMMs) or centralized limit order books. SmartDex takes a different approach by using **intents** — on-chain trade declarations — and leveraging **Dutch auctions** to incentivize decentralized order matching.

- 🔐 **Trustless**: All intents and matches are settled via smart contracts.
- 🧩 **Modular**: Matching and execution logic are separated, enabling open participation.
- 📉 **Dutch Auctions**: Encourage fair and efficient price discovery over time.
- 🔄 **P2P Matching**: Users or external solvers can fulfill orders directly, enabling MEV-resistant execution.

---

## 📦 Features

- **Intent Registration**: Users submit trade orders (intents) specifying what they want to trade and receive.
- **On-Chain Order Book**: All active intents are stored on-chain for public visibility and transparency.
- **Dutch Auction Matching**: Orders become more attractive over time, allowing natural price convergence and minimizing slippage.
- **Solver Participation**: Anyone can match existing intents, creating a competitive marketplace for order execution.

---

## 🛠 Architecture

SmartDex is implemented as a smart contract on the Algorand blockchain using [TEALScript](https://github.com/algorandfoundation/tealscript), which allows expressive TypeScript-like syntax for Algorand smart contracts. Here's a breakdown of its core architecture:

### 🔑 Core Components

- **Global State**

  - `manager`: Address of the app manager (admin).
  - `id`: An incrementing identifier used for uniquely tagging intents.

- **Order Management**

  - `orderRegistry`: A `BoxMap` that stores all active `OrderIntent` objects using unique `intentID`s.
  - `orderAuction`: Another `BoxMap` storing the block number when an intent's Dutch auction starts (used to compute dynamic pricing over time).

- **OrderIntent Structure**
  ```ts
  interface OrderIntent {
    creator: Address;
    reserve: Address;
    inID: AssetID;
    outID: AssetID;
    output: uint64;
    decayRate: uint64;
  }
  ```

### Flow Summary

User → bootstrapIntent()
↳ OrderIntent saved in orderRegistry
↳ Auction start time saved in orderAuction
↳ Reserve deployed for escrow

Solver → Reads box state → Computes price decay via auction time → Executes match off-chain

## 🌐 Future Roadmap

- [ ] **Batch Matching Support**
      Enable aggregators to fulfill multiple intents in a single transaction for efficiency and gas savings.

- [ ] **UI for Intent Visualization & Fulfillment**
      Build a frontend interface for users to submit, browse, and fulfill intents easily.

- [ ] **zk-Proof Based Private Intents**
      Allow users to submit encrypted or zero-knowledge proof-based orders to protect sensitive trade data.

- [ ] **Cross-Chain Intent Routing**
      Expand the intent system to operate across multiple blockchains using bridges or interoperability protocols.

- [ ] **Reputation System for Solvers**
      Introduce staking and scoring to incentivize reliable and efficient solvers.

- [ ] **Real-Time Order Book API**
      Create an off-chain indexer for fast querying and real-time updates of active intents.
