# CoinFlow Orchestrator Architecture

## Overview
The CoinFlow Orchestrator is a manager-level agent system that intelligently coordinates all payment operations for Hedge Payments and Bankroll wallet using CoinFlow as the underlying infrastructure.

## Design Principles

1. **Hierarchical Agent Management** - Manager agents coordinate specialized worker agents
2. **Intelligent Routing** - Auto-select best payment method based on cost, speed, success rate
3. **Fault Tolerance** - Automatic retries, fallbacks, and error recovery
4. **Real-time Monitoring** - Continuous optimization and performance tracking
5. **Stateful Operations** - Track transaction lifecycle from initiation to settlement
6. **Blockchain-First** - Solana as primary settlement layer

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CoinFlow Orchestrator                     │
│                    (Manager Agent)                          │
│                                                             │
│  - Decision Engine (Route, Retry, Fallback)                │
│  - State Manager (Transaction Lifecycle)                   │
│  - Event Bus (Agent Communication)                         │
│  - Performance Optimizer                                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Payment    │    │   Payout/    │    │ Compliance & │
│  Processing  │    │  Withdrawal  │    │     Risk     │
│     Team     │    │     Team     │    │     Team     │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
   [Sub-Agents]        [Sub-Agents]        [Sub-Agents]

┌──────────────┐    ┌──────────────┐
│  Settlement  │    │ Integration  │
│      &       │    │      &       │
│Reconciliation│    │  Monitoring  │
│     Team     │    │     Team     │
└──────────────┘    └──────────────┘
        │                   │
        ▼                   ▼
   [Sub-Agents]        [Sub-Agents]
```

---

## Core Orchestrator Components

### 1. Decision Engine

**Responsibilities:**
- Route transactions to optimal payment method
- Select fallback options when primary fails
- Determine retry strategy based on error type
- Balance cost vs. speed tradeoffs

**Logic:**
```javascript
class DecisionEngine {
  // Route payment based on context
  async routePayment(paymentRequest) {
    const factors = {
      amount: paymentRequest.amount,
      speed: paymentRequest.urgency, // 'instant' | 'fast' | 'standard'
      geography: paymentRequest.userLocation,
      paymentType: paymentRequest.type, // 'p2p' | 'merchant'
      userPreference: paymentRequest.preferredMethod,
      historicalSuccessRate: await this.getSuccessRate(paymentRequest),
      cost: await this.calculateCost(paymentRequest)
    }

    return this.selectOptimalAgent(factors)
  }

  // Determine retry strategy
  getRetryStrategy(error, attempt) {
    const strategies = {
      'insufficient_funds': { retry: false, fallback: 'alternate_method' },
      'network_timeout': { retry: true, delay: exponentialBackoff(attempt) },
      'card_declined': { retry: false, fallback: 'ach_payment' },
      'kyc_required': { retry: false, action: 'initiate_kyc' },
      'rate_limit': { retry: true, delay: 60000 } // 1 minute
    }

    return strategies[error.type] || { retry: true, maxAttempts: 3 }
  }
}
```

### 2. State Manager

**Responsibilities:**
- Track transaction lifecycle (pending → processing → completed/failed)
- Maintain transaction history
- Handle idempotency
- Manage rollbacks for failed transactions

**States:**
```javascript
const TransactionStates = {
  INITIATED: 'initiated',
  VALIDATING: 'validating',
  ROUTING: 'routing',
  PROCESSING: 'processing',
  SETTLING: 'settling',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded'
}

class StateManager {
  async transition(transactionId, fromState, toState, metadata) {
    // Validate state transition
    if (!this.isValidTransition(fromState, toState)) {
      throw new Error(`Invalid transition: ${fromState} → ${toState}`)
    }

    // Update state with audit trail
    await this.updateTransaction(transactionId, {
      state: toState,
      previousState: fromState,
      timestamp: Date.now(),
      metadata
    })

    // Emit state change event
    this.eventBus.emit('state:changed', { transactionId, fromState, toState })
  }
}
```

### 3. Event Bus

**Responsibilities:**
- Enable pub/sub communication between agents
- Decouple agent dependencies
- Support async event-driven workflows

**Events:**
```javascript
const Events = {
  // Payment events
  'payment:initiated': {},
  'payment:succeeded': {},
  'payment:failed': {},
  'payment:refunded': {},

  // Payout events
  'payout:requested': {},
  'payout:processing': {},
  'payout:completed': {},

  // Compliance events
  'kyc:required': {},
  'kyc:completed': {},
  'fraud:detected': {},
  'aml:flagged': {},

  // Settlement events
  'settlement:pending': {},
  'settlement:confirmed': {},
  'reconciliation:mismatch': {},

  // System events
  'agent:health:degraded': {},
  'rate:limit:reached': {},
  'error:critical': {}
}

class EventBus {
  subscribe(event, handler, agentId) {
    this.handlers[event] = this.handlers[event] || []
    this.handlers[event].push({ handler, agentId })
  }

  async emit(event, payload) {
    const handlers = this.handlers[event] || []
    await Promise.all(
      handlers.map(({ handler, agentId }) =>
        this.executeHandler(handler, payload, agentId)
      )
    )
  }
}
```

### 4. Performance Optimizer

**Responsibilities:**
- Track success rates per payment method
- Calculate cost efficiency
- Monitor latency and throughput
- Suggest optimizations

**Metrics:**
```javascript
class PerformanceOptimizer {
  async collectMetrics() {
    return {
      // Per payment method
      successRates: {
        'card': 0.97,
        'ach': 0.95,
        'apple_pay': 0.98,
        'usdc': 0.99
      },

      // Average cost per transaction
      averageCost: {
        'card': 0.029, // 2.9%
        'ach': 0.008,  // 0.8%
        'usdc': 0.001  // 0.1%
      },

      // Average settlement time (seconds)
      settlementTime: {
        'card': 180,      // 3 minutes
        'ach': 259200,    // 3 days
        'usdc': 30        // 30 seconds
      },

      // Agent health
      agentHealth: {
        'card_payment_agent': { status: 'healthy', uptime: 0.999 },
        'ach_agent': { status: 'degraded', uptime: 0.97 }
      }
    }
  }

  async optimizeRouting(paymentRequest) {
    const metrics = await this.collectMetrics()

    // Score each method based on requirements
    const scores = Object.keys(metrics.successRates).map(method => ({
      method,
      score: this.calculateScore(method, paymentRequest, metrics)
    }))

    return scores.sort((a, b) => b.score - a.score)[0].method
  }
}
```

---

## Agent Teams

### Team 1: Payment Processing Team

**Team Manager:** `PaymentProcessingManager`

**Sub-Agents:**

#### 1.1 Card Payment Agent
- **Responsibility:** Credit/Debit card transactions
- **Methods:** Visa, Mastercard, Amex, Discover
- **Features:**
  - Card tokenization (PCI compliant)
  - 3DS authentication
  - Card saving for recurring payments
  - Apple Pay / Google Pay integration

#### 1.2 Bank Transfer Agent
- **Responsibility:** Bank-to-bank transfers
- **Methods:** ACH, SEPA, UK Faster Payments, PIX
- **Features:**
  - Plaid integration for bank linking
  - Micro-deposit verification
  - Instant account verification
  - Same-day ACH support

#### 1.3 Crypto Payment Agent
- **Responsibility:** Native crypto payments
- **Methods:** USDC, USDT, SOL, BTC, ETH
- **Features:**
  - Multi-chain support (Solana primary)
  - Automatic token swaps
  - Gas optimization
  - MEV protection

#### 1.4 Payment Router Agent
- **Responsibility:** Intelligent payment routing
- **Logic:**
  - Analyze user location, amount, speed requirements
  - Check payment method availability
  - Select optimal method based on success rate + cost
  - Handle method cascading (fallback chain)

**Example Routing Logic:**
```javascript
// Bankroll P2P Transfer (friend to friend)
if (paymentType === 'p2p' && amount < 100) {
  // Optimize for speed and low cost
  primary: 'usdc_solana',    // Instant, 0.1% fee
  fallback: ['venmo', 'ach']
}

// Merchant Checkout (customer buying product)
if (paymentType === 'merchant' && amount > 500) {
  // Optimize for acceptance rate
  primary: 'card',           // 97% success, 2.9% fee
  fallback: ['apple_pay', 'ach', 'usdc']
}

// International Transfer
if (userCountry !== 'US') {
  primary: 'usdc_solana',    // No forex fees
  fallback: ['sepa', 'swift']
}
```

---

### Team 2: Payout/Withdrawal Team

**Team Manager:** `PayoutManager`

**Sub-Agents:**

#### 2.1 Instant Payout Agent
- **Methods:** Visa Direct, Mastercard Send, RTP, FedNow
- **Speed:** < 1 minute
- **Cost:** 1.5% fee
- **Use Case:** Emergency cash-outs, high-value users

#### 2.2 Standard Payout Agent
- **Methods:** Standard ACH, Wire Transfer
- **Speed:** 1-3 business days
- **Cost:** 0.8% fee (ACH), $10-25 (Wire)
- **Use Case:** Scheduled payouts, merchant settlements

#### 2.3 International Payout Agent
- **Methods:** SEPA, UK Faster Payments, PIX, SWIFT
- **Speed:** 1-5 business days
- **Cost:** 1-3% + forex fees
- **Use Case:** Cross-border payments

#### 2.4 Crypto Withdrawal Agent
- **Methods:** Direct wallet transfer (Solana, Ethereum, etc.)
- **Speed:** < 1 minute
- **Cost:** Network gas fees only
- **Use Case:** Crypto-native users, DeFi integrations

---

### Team 3: Compliance & Risk Team

**Team Manager:** `ComplianceManager`

**Sub-Agents:**

#### 3.1 KYC Agent
- **Responsibilities:**
  - Identity verification (Persona/Jumio via CoinFlow)
  - Document collection and validation
  - Address verification
  - Age verification
- **Triggers:**
  - First transaction > $100
  - Cumulative volume > $1,000
  - High-risk country
  - Regulatory requirement

#### 3.2 AML Agent
- **Responsibilities:**
  - Transaction monitoring
  - Sanctions screening (OFAC, UN, EU)
  - PEP (Politically Exposed Person) checks
  - Suspicious Activity Reports (SAR)
- **Rules:**
  - Flag transactions > $10,000
  - Detect structuring patterns
  - Monitor rapid movements
  - Check blockchain for tainted funds

#### 3.3 Fraud Detection Agent
- **Responsibilities:**
  - Real-time fraud scoring
  - Velocity checks
  - Device fingerprinting
  - Behavioral analysis
- **Models:**
  - ML-based anomaly detection
  - Rule-based triggers
  - Network graph analysis
  - Historical pattern matching

#### 3.4 Chargeback Handler Agent
- **Responsibilities:**
  - Chargeback notification handling
  - Evidence collection
  - Dispute response
  - Representment filing
- **Note:** CoinFlow provides 100% chargeback coverage

---

### Team 4: Settlement & Reconciliation Team

**Team Manager:** `SettlementManager`

**Sub-Agents:**

#### 4.1 USDC Settlement Agent
- **Responsibility:** Handle instant Solana USDC settlements
- **Features:**
  - Real-time balance updates
  - Multi-sig wallet support
  - Treasury management
  - Yield optimization (DeFi integration)

#### 4.2 Fiat Settlement Agent
- **Responsibility:** Traditional currency settlements
- **Features:**
  - Bank account sweeps
  - Multi-currency balances
  - Forex hedging
  - Reserve requirements

#### 4.3 Balance Monitor Agent
- **Responsibility:** Track liquidity across all currencies
- **Alerts:**
  - Low balance warnings
  - Imbalance detection (too much USDC, not enough USD)
  - Suggest rebalancing actions

#### 4.4 Reconciliation Agent
- **Responsibility:** Match transactions to settlements
- **Checks:**
  - Daily reconciliation reports
  - Identify missing settlements
  - Flag discrepancies
  - Auto-resolve minor differences

---

### Team 5: Integration & Monitoring Team

**Team Manager:** `IntegrationManager`

**Sub-Agents:**

#### 5.1 Webhook Handler Agent
- **Responsibility:** Process CoinFlow webhooks
- **Events:**
  - payment.succeeded
  - payment.failed
  - payout.completed
  - kyc.approved
  - settlement.confirmed
- **Actions:**
  - Update transaction states
  - Trigger downstream workflows
  - Send user notifications

#### 5.2 Status Monitor Agent
- **Responsibility:** Real-time transaction tracking
- **Features:**
  - Polling for long-running transactions
  - Timeout detection
  - Stuck transaction recovery
  - Status sync with CoinFlow

#### 5.3 Error Recovery Agent
- **Responsibility:** Handle failed transactions
- **Strategies:**
  - Exponential backoff retries
  - Method fallbacks
  - Partial refunds
  - Manual intervention escalation

#### 5.4 Analytics Agent
- **Responsibility:** Business intelligence
- **Metrics:**
  - GMV (Gross Merchandise Volume)
  - Success rates per method
  - Average transaction time
  - Cost per transaction
  - User cohort analysis
  - Revenue forecasting

---

## Use Case: Bankroll P2P Transfer

**Scenario:** User A sends $50 to User B via Bankroll wallet

```javascript
// 1. User initiates transfer in Bankroll app
const transfer = await orchestrator.initiatePayment({
  type: 'p2p',
  from: 'userA_wallet',
  to: 'userB_wallet',
  amount: 50,
  currency: 'USD',
  urgency: 'instant'
})

// 2. Orchestrator routes through decision engine
const route = decisionEngine.routePayment(transfer)
// Result: Primary = USDC on Solana (instant, cheap)

// 3. Check compliance
const complianceCheck = await complianceManager.check(transfer)
// KYC: userA ✓, userB ✓
// AML: No flags
// Fraud: Risk score 0.02 (low)

// 4. Process payment via Crypto Payment Agent
const payment = await cryptoPaymentAgent.process({
  from: userA_solana_wallet,
  to: userB_solana_wallet,
  amount: 50,
  token: 'USDC',
  chain: 'solana'
})

// 5. Settle to User B's wallet
await settlementAgent.confirmSettlement(payment.transactionId)

// 6. Send notifications
await notificationAgent.send(userA, 'payment:sent')
await notificationAgent.send(userB, 'payment:received')

// Total time: ~30 seconds
// Cost: 0.1% ($0.05)
```

---

## Use Case: Hedge Payments Merchant Checkout

**Scenario:** Customer buys $500 product from merchant

```javascript
// 1. Customer initiates checkout
const checkout = await orchestrator.initiatePayment({
  type: 'merchant',
  merchantId: 'merchant_123',
  customerId: 'customer_456',
  amount: 500,
  currency: 'USD',
  items: [{ id: 'product_xyz', price: 500 }]
})

// 2. Orchestrator offers payment methods
const methods = decisionEngine.getAvailableMethods(checkout)
// Result: ['card', 'apple_pay', 'google_pay', 'ach', 'usdc']

// 3. Customer selects card payment
const payment = await cardPaymentAgent.process({
  cardToken: 'tok_xxxx',
  amount: 500,
  merchantId: 'merchant_123',
  customerId: 'customer_456',
  metadata: { orderId: 'order_789' }
})

// 4. Settle to merchant's USDC wallet (instant)
const settlement = await settlementAgent.settleToMerchant({
  merchantId: 'merchant_123',
  amount: 500 * 0.971, // After 2.9% fee
  currency: 'USDC',
  chain: 'solana'
})

// 5. Merchant receives USDC in 3 minutes
// Can hold as USDC or cash out to bank via Payout Team

// Total time: 3 minutes (card → USDC)
// Cost: 2.9% ($14.50)
```

---

## Technology Stack

### Core Infrastructure
- **Language:** Node.js (existing codebase)
- **Framework:** Express.js
- **Database:** PostgreSQL (transactions) + Redis (state/cache)
- **Message Queue:** Redis Pub/Sub or RabbitMQ
- **Blockchain:** Solana (primary), Ethereum (secondary)

### Agent Framework
```javascript
class Agent {
  constructor(config) {
    this.id = config.id
    this.name = config.name
    this.orchestrator = config.orchestrator
    this.eventBus = config.eventBus
    this.state = 'idle'
  }

  async execute(task) {
    try {
      this.setState('working')
      const result = await this.performTask(task)
      this.setState('idle')
      return result
    } catch (error) {
      this.setState('error')
      this.eventBus.emit('agent:error', { agentId: this.id, error })
      throw error
    }
  }

  async performTask(task) {
    // Override in subclass
    throw new Error('Not implemented')
  }
}

class CardPaymentAgent extends Agent {
  async performTask(task) {
    // Use existing coinflowService
    return await coinflowService.createPayment({
      method: 'card',
      ...task.data
    })
  }
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Bankroll App                         │
│                    (iOS + Web Wallet)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hedge Payments API                       │
│                  (Express.js + MCP Server)                  │
│                                                             │
│   ┌─────────────────────────────────────────────────┐     │
│   │          CoinFlow Orchestrator                  │     │
│   │                                                 │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │     │
│   │  │ Payment  │  │  Payout  │  │Compliance│    │     │
│   │  │   Team   │  │   Team   │  │   Team   │    │     │
│   │  └──────────┘  └──────────┘  └──────────┘    │     │
│   └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CoinFlow API                            │
│                  (Payment Infrastructure)                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Banks &    │   │  Blockchain  │   │   Card       │
│   ACH Rails  │   │  (Solana)    │   │  Networks    │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## Next Steps

1. **Week 1-2:** Build Orchestrator Core
   - Decision Engine
   - State Manager
   - Event Bus
   - Performance Optimizer

2. **Week 3-4:** Build Payment Processing Team
   - Card Payment Agent
   - Bank Transfer Agent
   - Crypto Payment Agent
   - Payment Router Agent

3. **Week 5-6:** Build Payout Team
   - Instant Payout Agent
   - Standard Payout Agent
   - Crypto Withdrawal Agent

4. **Week 7-8:** Build Compliance Team
   - KYC Agent
   - AML Agent
   - Fraud Detection Agent

5. **Week 9-10:** Integration & Testing
   - Webhook handlers
   - Monitoring agents
   - Bankroll integration
   - End-to-end testing

---

## Success Metrics

### Performance Targets
- **Payment Success Rate:** >97%
- **Settlement Time (USDC):** <30 seconds
- **Settlement Time (ACH):** <3 days
- **API Uptime:** >99.9%
- **Orchestrator Decision Time:** <100ms

### Cost Targets
- **P2P Transfers (USDC):** 0.1% fee
- **Card Payments:** 2.9% fee
- **ACH Payments:** 0.8% fee
- **Instant Payouts:** 1.5% fee

### Business Targets
- **Month 1:** $100K GMV
- **Month 3:** $1M GMV
- **Month 6:** $10M GMV
- **Month 12:** $100M GMV

---

## Questions to Answer

1. **Agent Runtime:** Should agents run as:
   - Separate processes (microservices)?
   - Background workers (queues)?
   - Inline functions (monolith)?

2. **State Storage:** Where to store transaction state?
   - PostgreSQL (durable, slower)
   - Redis (fast, less durable)
   - Hybrid approach?

3. **Agent Communication:**
   - REST API calls?
   - Message queue (RabbitMQ/Redis)?
   - Event-driven (webhooks)?

4. **CoinFlow Credentials:**
   - When can we get sandbox access?
   - Do we need a banking partner first?

5. **Solana Wallets:**
   - Self-custodial (user holds keys)?
   - Custodial (we hold keys)?
   - MPC (multi-party computation)?
