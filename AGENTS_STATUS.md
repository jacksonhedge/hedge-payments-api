# Agent System Status
**Last Updated:** 2025-11-10

## Quick Overview

### ✅ Built and Ready
- **CoinFlowOrchestrator** - Master coordinator for all agents
- **EventBus** - Pub/sub communication system
- **Agent Base Class** - Foundation for all agents
- **NetworkDetectionAgent** - Detects if parties are in network
- **LedgerTransferAgent** - Handles internal transfers (100% margin!)
- **BankrollWizardAgent** - AI assistant for Bankroll users

### 🚧 Pending (Not Yet Built)
- External Payment Agent
- Payment Processing Team (Card, ACH, Crypto)
- Merchant Experience Team
- Compliance Team (KYC, AML, Fraud)
- Payout Team
- Settlement & Reconciliation Team
- Integration & Monitoring Team

---

## File Structure

```
src/agents/
├── index.js                              ✅ Main export file
├── CoinFlowOrchestrator.js              ✅ Master orchestrator
│
├── base/
│   ├── Agent.js                         ✅ Base agent class
│   └── EventBus.js                      ✅ Event system
│
├── network/
│   ├── NetworkDetectionAgent.js         ✅ Network detection
│   ├── LedgerTransferAgent.js           ✅ Internal transfers
│   └── ExternalPaymentAgent.js          ❌ TODO
│
├── consumer/
│   ├── BankrollWizardAgent.js           ✅ Consumer assistant
│   ├── P2PTransferAgent.js              ❌ TODO
│   ├── SmartBalanceAgent.js             ❌ TODO
│   └── MerchantDiscoveryAgent.js        ❌ TODO
│
├── merchant/                             ❌ TODO (entire team)
├── payment/                              ❌ TODO (entire team)
├── payout/                               ❌ TODO (entire team)
├── compliance/                           ❌ TODO (entire team)
├── settlement/                           ❌ TODO (entire team)
└── integration/                          ❌ TODO (entire team)
```

---

## How to Use the Agent System

### Initialize the Orchestrator

```javascript
const { getOrchestrator } = require('./agents');

// Initialize with config
const orchestrator = getOrchestrator({
  db: yourDatabaseConnection,
  ledgerFeePercentage: 0.01 // 1%
});

await orchestrator.initialize();
```

### Route a Payment

```javascript
// The orchestrator automatically detects if it's internal or external
const result = await orchestrator.routePayment({
  from: 'user_123',          // Bankroll user
  to: 'merchant_456',        // Hedge merchant
  amount: 100,
  currency: 'USD',
  memo: 'Payment for services'
});

// If both are in network:
// → Routes to LedgerTransferAgent
// → Database-only operation
// → $0 cost, $1 profit (1% fee)
// → Instant settlement

// If one is external:
// → Routes to ExternalPaymentAgent (TODO)
// → Uses CoinFlow rails
// → ~2.9% cost
```

### Smart P2P Transfer

```javascript
// Bankroll user wants to send money
const recommendation = await orchestrator.smartP2P(
  'user_123',           // From
  '@johndoe',          // To (username)
  50                   // Amount
);

// Response if @johndoe is in network:
{
  method: 'internal_ledger',
  recipient: 'John Doe',
  estimatedTime: 'Instant',
  fee: '0.50',
  feePercentage: '1%',
  total: '50.50',
  message: '💚 John Doe uses Bankroll! Instant transfer with 1% fee.',
  savings: '0.95',
  savingsMessage: 'You save $0.95 vs. external payment!'
}

// Response if @johndoe is NOT in network:
{
  method: 'external',
  recipient: '@johndoe',
  message: '@johndoe isn't on Bankroll yet. Here are your options:',
  options: [
    { method: 'usdc_solana', time: '~30 seconds', fee: '0.05', ... },
    { method: 'ach', time: '1-3 days', fee: '0.00', ... },
    { method: 'card', time: 'Instant', fee: '0.75', ... }
  ],
  inviteMessage: '💡 Invite @johndoe to Bankroll and save on future payments!',
  referralBonus: 10
}
```

### Calculate User Savings

```javascript
const savings = await orchestrator.calculateSavings('user_123');

// Response:
{
  userId: 'user_123',
  totalVolume: 2500,
  internalVolume: 1750,     // 70% in network!
  externalVolume: 750,
  networkPercentage: '70.0',
  actualFees: '25.25',
  wouldHaveCost: '72.50',
  youSaved: '47.25',
  savingsPercentage: '65.2',
  message: '🎉 Amazing! You've saved $47.25 by using the Bankroll network!'
}
```

### Get Transfer Quote

```javascript
const quote = await orchestrator.getTransferQuote(
  'user_123',
  'merchant_456',
  100
);

// If internal:
{
  amount: 100,
  fee: 1.00,
  feePercentage: 0.01,
  totalCost: 101,
  recipient_receives: 100,
  network_profit: 1.00,         // 100% margin!
  settlement_time: 'Instant (<1 second)',
  method: 'internal_ledger',
  cost_to_platform: 0
}
```

### Get System Metrics

```javascript
const metrics = orchestrator.getAllMetrics();

// Response:
{
  orchestrator: {
    totalAgents: 3,
    teams: 2,
    isInitialized: true
  },
  eventBus: {
    totalEvents: 150,
    eventTypes: 8,
    totalSubscriptions: 12
  },
  agents: {
    network_detection: {
      tasksExecuted: 45,
      successRate: '0.999',
      avgExecutionTime: '45ms',
      ...
    },
    ledger_transfer: {
      tasksExecuted: 30,
      successRate: '1.000',
      avgExecutionTime: '120ms',
      ledgerTransfers: {
        totalVolume: 5000,
        totalFees: 50,
        totalProfit: 50,        // 100% margin!
        totalTransfers: 30,
        avgTransactionSize: '166.67',
        avgFee: '1.67',
        profitMargin: '100%'
      }
    },
    bankroll_wizard: { ... }
  }
}
```

### Health Check

```javascript
const health = await orchestrator.healthCheck();

// Response:
{
  healthy: true,
  totalAgents: 3,
  activeAgents: 3,
  unhealthyAgents: []
}
```

---

## Agent Capabilities

### NetworkDetectionAgent

**Purpose:** Identify if payment parties are in the Hedge/Bankroll network

**Methods:**
- `identifyParty(identifier)` - Detect user/merchant by email, phone, username, domain, wallet
- `checkMerchantIntegration(domain)` - Check if merchant uses Hedge Payments
- `batchIdentify(identifiers)` - Identify multiple parties at once

**Supported Identifiers:**
- Email: `user@example.com`
- Phone: `+1-555-0100`
- Username: `@johndoe`
- Merchant ID: `merchant_xxx`
- Domain: `example.com`
- Wallet address: `9xQeW...` (Solana)

---

### LedgerTransferAgent

**Purpose:** Execute internal network transfers (pure database operations)

**Methods:**
- `executeInternalTransfer({ from, to, amount, currency, memo })`
- `validateTransfer({ from, to, amount, currency })`
- `getTransferQuote(amount)`

**Economics:**
- Fee: 1% (configurable)
- Cost: $0 (database only)
- Profit Margin: 100%
- Settlement Time: <1 second

**Constraints:**
- Max amount: $10,000 per transfer (configurable)
- Only works if BOTH parties are in network
- Currently USD only (expandable)

---

### BankrollWizardAgent

**Purpose:** AI-powered assistant for Bankroll users

**Methods:**
- `analyzeUserBehavior(userId)` - Spending patterns, recommendations
- `calculateNetworkSavings(userId)` - Show how much user saved
- `smartP2P(from, to, amount)` - Intelligent P2P routing
- `discoverNetworkMerchants(location, interests)` - Find nearby merchants
- `optimizeBalance(userId)` - Balance recommendations
- `suggestNetworkRecruitment(userId, merchantId)` - Referral opportunities

**Features:**
- Detects if recipient is in network
- Suggests optimal payment method
- Calculates savings vs. external payments
- Recommends balance top-ups
- Identifies merchant recruitment opportunities

---

## Event System

### Key Events

**Network Events:**
- `network:party_detected` - Party network status identified
- `network:transfer_completed` - Internal transfer finished
- `network:external_payment_initiated` - External payment started

**Agent Events:**
- `agent:started` - Agent initialized
- `agent:task_completed` - Task succeeded
- `agent:task_failed` - Task failed
- `agent:state_changed` - Agent state changed
- `agent:shutdown` - Agent shutting down

**System Events:**
- `orchestrator:initialized` - Orchestrator ready

### Subscribe to Events

```javascript
const { getEventBus } = require('./agents');
const eventBus = getEventBus();

// Subscribe to transfer completions
eventBus.subscribe('network:transfer_completed', (payload) => {
  console.log('Transfer completed:', payload.transactionId);
  console.log('Profit:', payload.fee);
});

// Subscribe to all agent errors
eventBus.subscribe('agent:task_failed', (payload) => {
  console.error('Agent error:', payload.agentName, payload.error);
});
```

---

## Next Steps

### Phase 1: Complete Core Network (Week 1-2)
- ✅ NetworkDetectionAgent
- ✅ LedgerTransferAgent
- ✅ BankrollWizardAgent
- ⏳ Database integration (replace mocks)
- ⏳ Unit tests
- ⏳ Integration tests

### Phase 2: External Payments (Week 3-4)
- ❌ ExternalPaymentAgent
- ❌ CardPaymentAgent
- ❌ BankTransferAgent
- ❌ CryptoPaymentAgent
- ❌ CoinFlow API integration

### Phase 3: Merchant Experience (Week 5-6)
- ❌ MerchantOnboardingAgent
- ❌ MerchantSettlementAgent
- ❌ CheckoutWidgetAgent
- ❌ MerchantAnalyticsAgent

### Phase 4: Compliance & Risk (Week 7-8)
- ❌ KYCAgent
- ❌ AMLAgent
- ❌ FraudDetectionAgent
- ❌ ChargebackHandlerAgent

---

## Configuration

### Environment Variables

```bash
# Agent System
AGENT_SYSTEM_ENABLED=true
AGENT_MAX_CONCURRENT_TASKS=100
AGENT_TASK_TIMEOUT=30000

# Network Detection
NETWORK_DETECTION_CACHE_TTL=300000  # 5 minutes

# Ledger Transfer
LEDGER_FEE_PERCENTAGE=0.01          # 1%
LEDGER_MIN_FEE=0.01                 # $0.01
LEDGER_MAX_AMOUNT=10000             # $10,000
```

---

## Testing

### Run Agent Tests

```bash
# Unit tests (when implemented)
npm test -- agents

# Integration tests (when implemented)
npm test -- agents:integration

# Test specific agent
npm test -- agents/network/NetworkDetectionAgent
```

### Manual Testing

```javascript
// test-agents.js
const { getOrchestrator } = require('./src/agents');

async function test() {
  const orchestrator = getOrchestrator({ db: null });
  await orchestrator.initialize();

  // Test network detection
  const party = await orchestrator.getAgent('network_detection').execute({
    type: 'identify_party',
    data: { identifier: '@testuser' }
  });

  console.log('Party:', party);

  // Test transfer quote
  const quote = orchestrator.getAgent('ledger_transfer').getTransferQuote(100);
  console.log('Quote:', quote);

  // Test smart P2P
  const p2p = await orchestrator.smartP2P('user1', 'user2', 50);
  console.log('P2P:', p2p);

  // Get metrics
  const metrics = orchestrator.getAllMetrics();
  console.log('Metrics:', JSON.stringify(metrics, null, 2));

  await orchestrator.shutdown();
}

test().catch(console.error);
```

---

## Database Schema Requirements

### Tables Needed (TODO: Create migrations)

**users**
- id
- email
- phone
- username
- wallet_id (references wallets.id)
- kyc_status
- created_at, updated_at

**merchants**
- id
- name
- domain
- uses_hedge_payments (boolean)
- accepts_bankroll (boolean)
- wallet_id (references wallets.id)
- created_at, updated_at

**wallets**
- id
- user_id or merchant_id
- type ('user' or 'merchant')
- created_at, updated_at

**wallet_balances**
- wallet_id (references wallets.id)
- currency (USD, USDC, etc.)
- available_balance (decimal)
- pending_balance (decimal)
- reserved_balance (decimal)
- updated_at

**transactions**
- id
- from_wallet_id
- to_wallet_id
- amount (decimal)
- currency
- type ('internal_transfer', 'external_payment', etc.)
- status ('pending', 'completed', 'failed')
- fee (decimal)
- cost (decimal)
- profit (decimal)
- memo
- external_reference (CoinFlow transaction ID)
- settled_at
- created_at

**ledger_entries** (double-entry accounting)
- id
- transaction_id
- wallet_id
- type ('credit' or 'debit')
- amount
- currency
- balance_after
- created_at

---

## Support & Questions

For questions about the agent system:
1. Check the architecture docs:
   - `/docs/COINFLOW_ORCHESTRATOR_ARCHITECTURE.md`
   - `/docs/NETWORK_AWARE_AGENT_ARCHITECTURE.md`
   - `/docs/AGENTS_REGISTRY.md`

2. Review this status document

3. Check agent source code in `/src/agents/`

**Project Owner:** Jackson Fitzgerald
**Repository:** `/Users/jacksonfitzgerald/Documents/hedge-payments-api`
