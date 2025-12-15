# Agents Registry
## Complete list of all agents in the Hedge Payments / Bankroll system

**Last Updated:** 2025-11-10

---

## Agent Hierarchy

```
CoinFlowOrchestrator (Master Agent)
├── NetworkOperationsManager (Team Manager)
│   ├── NetworkDetectionAgent [BUILDING]
│   ├── LedgerTransferAgent [BUILDING]
│   ├── ExternalPaymentAgent [PENDING]
│   └── MerchantIntegrationAgent [PENDING]
│
├── ConsumerExperienceManager (Team Manager)
│   ├── BankrollWizardAgent [ACTIVE]
│   ├── P2PTransferAgent [PENDING]
│   ├── SmartBalanceAgent [PENDING]
│   ├── MerchantDiscoveryAgent [PENDING]
│   └── SavingsCalculatorAgent [PENDING]
│
├── ProductManagementManager (Team Manager)
│   ├── ProductRoadmapAgent [ACTIVE]
│   ├── FeaturePrioritizationAgent [PENDING]
│   └── ImpactTrackingAgent [PENDING]
│
├── MerchantExperienceManager (Team Manager)
│   ├── MerchantOnboardingAgent [PENDING]
│   ├── MerchantSettlementAgent [PENDING]
│   ├── CheckoutWidgetAgent [PENDING]
│   ├── MerchantAnalyticsAgent [PENDING]
│   └── NetworkGrowthAgent [PENDING]
│
├── PaymentProcessingManager (Team Manager)
│   ├── CardPaymentAgent [PENDING]
│   ├── BankTransferAgent [PENDING]
│   ├── CryptoPaymentAgent [PENDING]
│   └── PaymentRouterAgent [PENDING]
│
├── PayoutManager (Team Manager)
│   ├── InstantPayoutAgent [PENDING]
│   ├── StandardPayoutAgent [PENDING]
│   ├── InternationalPayoutAgent [PENDING]
│   └── CryptoWithdrawalAgent [PENDING]
│
├── ComplianceManager (Team Manager)
│   ├── KYCAgent [PENDING]
│   ├── AMLAgent [PENDING]
│   ├── FraudDetectionAgent [PENDING]
│   └── ChargebackHandlerAgent [PENDING]
│
├── SettlementManager (Team Manager)
│   ├── USDCSettlementAgent [PENDING]
│   ├── FiatSettlementAgent [PENDING]
│   ├── BalanceMonitorAgent [PENDING]
│   └── ReconciliationAgent [PENDING]
│
└── IntegrationManager (Team Manager)
    ├── WebhookHandlerAgent [PENDING]
    ├── StatusMonitorAgent [PENDING]
    ├── ErrorRecoveryAgent [PENDING]
    └── AnalyticsAgent [PENDING]
```

---

## Agent Status Legend

- **[BUILDING]** - Currently under development
- **[ACTIVE]** - Built and running
- **[TESTING]** - Built, in testing phase
- **[PENDING]** - Not yet started
- **[DEPRECATED]** - No longer in use

---

## Core Agents (Priority 1)

### 1. NetworkDetectionAgent
**Status:** [BUILDING]
**Team:** Network Operations
**Manager:** NetworkOperationsManager
**Purpose:** Detect if payment parties are in the Hedge/Bankroll network

**Capabilities:**
- Identify Bankroll users by username, phone, email
- Identify Hedge Payments merchants by domain, merchant ID
- Check if external parties could be recruited to network
- Return network membership status

**Key Methods:**
- `identifyParty(identifier)` → Party info
- `checkMerchantIntegration(domain)` → Boolean
- `suggestNetworkRecruitment(party)` → Recruitment opportunity

**Dependencies:**
- Database (user/merchant lookups)
- None (foundational agent)

**File Location:** `src/agents/network/NetworkDetectionAgent.js`

---

### 2. LedgerTransferAgent
**Status:** [BUILDING]
**Team:** Network Operations
**Manager:** NetworkOperationsManager
**Purpose:** Execute internal network transfers (database-only, no external rails)

**Capabilities:**
- Atomic database transfers between wallets
- Zero external costs (100% margin)
- Instant settlement (<1 second)
- Transaction recording with full audit trail

**Key Methods:**
- `performTask(task)` → Transaction result
- `atomicTransfer(params)` → Database transaction
- `validateBalance(walletId, amount)` → Boolean
- `recordInternalTransfer(details)` → Transaction record

**Dependencies:**
- Database (PostgreSQL with transactions)
- EventBus (emit transfer events)
- NetworkDetectionAgent (verify both parties in network)

**Economics:**
- Cost: $0.00
- Fee: 1.0%
- Profit Margin: 100%

**File Location:** `src/agents/network/LedgerTransferAgent.js`

---

### 3. BankrollWizardAgent
**Status:** [BUILDING]
**Team:** Consumer Experience
**Manager:** ConsumerExperienceManager
**Purpose:** AI-powered assistant for Bankroll users

**Capabilities:**
- Smart P2P transfer routing
- Merchant discovery (find network merchants)
- Savings calculation (show network benefits)
- Balance optimization suggestions
- Auto-reload management

**Key Methods:**
- `analyzeUserBehavior(userId)` → Spending patterns
- `calculateNetworkSavings(userId)` → Savings report
- `smartP2P(from, to, amount)` → Optimized transfer route
- `discoverNetworkMerchants(location, interests)` → Merchant list
- `optimizeBalance(userId)` → Balance recommendations

**Dependencies:**
- NetworkDetectionAgent (check merchant network status)
- LedgerTransferAgent (execute internal transfers)
- Database (user behavior, transaction history)
- Analytics service (spending patterns)

**File Location:** `src/agents/consumer/BankrollWizardAgent.js`

---

### 4. ProductRoadmapAgent
**Status:** [ACTIVE]
**Team:** Product Management
**Manager:** ProductManagementManager
**Purpose:** Manage product roadmap in Notion, prioritize features based on network metrics

**Capabilities:**
- Sync roadmap with Notion database
- Auto-prioritize features based on network impact
- Generate weekly progress reports
- Track feature impact on network metrics
- Create and update features
- Generate AI insights from data

**Key Methods:**
- `syncRoadmap()` → Fetch all roadmap items from Notion
- `prioritizeFeatures()` → Score and re-prioritize based on network data
- `generateWeeklyReport()` → Create comprehensive progress report
- `createFeature(data)` → Add new feature to roadmap
- `trackNetworkImpact(featureId)` → Measure feature's impact
- `updateFeatureStatus(featureId, status)` → Update feature progress

**Dependencies:**
- Notion MCP tools (via Claude Code)
- Supabase database (network analytics)
- EventBus (emit roadmap events)

**Notion Integration:**
- Requires Notion API key and database ID
- Auto-syncs with Notion database
- Updates priorities based on network metrics
- Posts weekly reports to Notion

**Feature Scoring:**
- Network Growth features: 10 points (highest)
- User/Merchant Acquisition: 8 points
- Cost Reduction: 7 points
- UX Improvement: 6 points
- Compliance: 5 points
- Infrastructure: 4 points
- Boosts for network % < 70%, quick wins, in-progress items
- Penalties for large effort, blocked items

**Weekly Report Includes:**
- Completed features this week
- Features in progress
- Blocked features and reasons
- Network metrics (%, volume, margin)
- AI-generated insights
- Next week's top priorities

**File Location:** `src/agents/product/ProductRoadmapAgent.js`

---

## Agent Team Managers

### NetworkOperationsManager
**Status:** [BUILDING]
**Purpose:** Coordinate network detection and routing decisions
**Sub-Agents:** 4 (1 building, 3 pending)
**Key Decision:** Internal vs External routing

### ConsumerExperienceManager
**Status:** [BUILDING]
**Purpose:** Manage all Bankroll user-facing features
**Sub-Agents:** 5 (1 building, 4 pending)
**Key Decision:** UX optimization for network growth

### MerchantExperienceManager
**Status:** [PENDING]
**Purpose:** Manage all Hedge Payments merchant features
**Sub-Agents:** 5 (all pending)
**Key Decision:** Merchant satisfaction and retention

### PaymentProcessingManager
**Status:** [PENDING]
**Purpose:** Handle external payment processing via CoinFlow
**Sub-Agents:** 4 (all pending)
**Key Decision:** Payment method selection and routing

### PayoutManager
**Status:** [PENDING]
**Purpose:** Manage withdrawals and payouts to external accounts
**Sub-Agents:** 4 (all pending)
**Key Decision:** Payout method selection (speed vs cost)

### ComplianceManager
**Status:** [PENDING]
**Purpose:** Ensure KYC/AML/fraud compliance
**Sub-Agents:** 4 (all pending)
**Key Decision:** Risk assessment and approval

### SettlementManager
**Status:** [PENDING]
**Purpose:** Handle settlement and reconciliation
**Sub-Agents:** 4 (all pending)
**Key Decision:** Settlement timing and currency

### IntegrationManager
**Status:** [PENDING]
**Purpose:** Monitor system health and handle errors
**Sub-Agents:** 4 (all pending)
**Key Decision:** Error recovery strategies

---

## Agent Communication

### Event Bus Topics

**Network Events:**
- `network:party_detected` - Party network status identified
- `network:transfer_completed` - Internal transfer finished
- `network:external_payment_initiated` - External payment started

**Consumer Events:**
- `consumer:p2p_requested` - P2P transfer requested
- `consumer:merchant_discovered` - User found network merchant
- `consumer:savings_calculated` - Savings report generated

**Merchant Events:**
- `merchant:onboarded` - New merchant joined
- `merchant:settlement_completed` - Merchant received funds
- `merchant:network_revenue_alert` - High network transaction volume

**Payment Events:**
- `payment:initiated` - Payment started
- `payment:succeeded` - Payment completed
- `payment:failed` - Payment failed
- `payment:refunded` - Payment refunded

**System Events:**
- `system:agent_started` - Agent initialized
- `system:agent_error` - Agent encountered error
- `system:health_check` - Health status update

---

## Agent Metrics

### Per-Agent Tracking

Each agent tracks:
- **Tasks Executed** - Total number of tasks completed
- **Success Rate** - % of successful task completions
- **Average Execution Time** - Mean time to complete task
- **Error Rate** - % of tasks that failed
- **Last Active** - Timestamp of last task
- **Current State** - idle | working | error

### Example Metrics Dashboard

```javascript
{
  "NetworkDetectionAgent": {
    "tasksExecuted": 15420,
    "successRate": 0.999,
    "avgExecutionTime": "45ms",
    "errorRate": 0.001,
    "lastActive": "2025-11-10T14:30:22Z",
    "currentState": "idle"
  },
  "LedgerTransferAgent": {
    "tasksExecuted": 8943,
    "successRate": 1.0,
    "avgExecutionTime": "120ms",
    "errorRate": 0.0,
    "lastActive": "2025-11-10T14:30:18Z",
    "currentState": "idle",
    "totalVolumeProcessed": "$445,000",
    "profitGenerated": "$4,450"
  }
}
```

---

## Agent Configuration

### Environment Variables

```bash
# Agent System
AGENT_SYSTEM_ENABLED=true
AGENT_MAX_CONCURRENT_TASKS=100
AGENT_TASK_TIMEOUT=30000
AGENT_RETRY_ATTEMPTS=3
AGENT_RETRY_DELAY=1000

# Network Detection
NETWORK_DETECTION_CACHE_TTL=300
NETWORK_DETECTION_BATCH_SIZE=100

# Ledger Transfer
LEDGER_TRANSFER_FEE_PERCENTAGE=0.01
LEDGER_TRANSFER_MIN_FEE=0.01
LEDGER_TRANSFER_MAX_AMOUNT=10000

# Bankroll Wizard
BANKROLL_WIZARD_ENABLED=true
BANKROLL_WIZARD_AI_MODEL=gpt-4
BANKROLL_WIZARD_CACHE_TTL=3600
```

---

## Development Roadmap

### Phase 1: Core Network Agents (Week 1-2)
- [x] Design agent architecture
- [ ] Build base Agent class
- [ ] Build EventBus system
- [ ] Build NetworkDetectionAgent
- [ ] Build LedgerTransferAgent
- [ ] Build BankrollWizardAgent
- [ ] Unit tests for core agents

### Phase 2: Payment Processing (Week 3-4)
- [ ] Build PaymentProcessingManager
- [ ] Build CardPaymentAgent
- [ ] Build BankTransferAgent
- [ ] Build CryptoPaymentAgent
- [ ] Build PaymentRouterAgent
- [ ] Integration tests with CoinFlow

### Phase 3: Merchant Experience (Week 5-6)
- [ ] Build MerchantExperienceManager
- [ ] Build MerchantOnboardingAgent
- [ ] Build MerchantSettlementAgent
- [ ] Build CheckoutWidgetAgent
- [ ] Build MerchantAnalyticsAgent

### Phase 4: Compliance & Risk (Week 7-8)
- [ ] Build ComplianceManager
- [ ] Build KYCAgent
- [ ] Build AMLAgent
- [ ] Build FraudDetectionAgent
- [ ] Integrate with CoinFlow compliance tools

### Phase 5: Settlement & Monitoring (Week 9-10)
- [ ] Build SettlementManager
- [ ] Build IntegrationManager
- [ ] Build all settlement agents
- [ ] Build monitoring agents
- [ ] Complete system integration

---

## Agent Dependencies Graph

```
NetworkDetectionAgent (no dependencies)
    ↓
LedgerTransferAgent (depends on NetworkDetectionAgent)
    ↓
BankrollWizardAgent (depends on NetworkDetectionAgent, LedgerTransferAgent)
    ↓
ExternalPaymentAgent (depends on NetworkDetectionAgent)
    ↓
PaymentRouterAgent (depends on NetworkDetectionAgent, LedgerTransferAgent, ExternalPaymentAgent)
```

---

## Testing Strategy

### Unit Tests
Each agent has isolated unit tests:
- Mock all dependencies
- Test success cases
- Test error cases
- Test edge cases

### Integration Tests
Test agent communication:
- Agent → Agent communication
- Agent → Database
- Agent → External API (CoinFlow)
- Event Bus pub/sub

### End-to-End Tests
Real user scenarios:
- Bankroll user pays network merchant
- Bankroll user pays external merchant
- Merchant receives settlement
- User withdraws funds

---

## Monitoring & Alerts

### Agent Health Checks
- Every 60 seconds, check agent status
- Alert if agent is in error state > 5 minutes
- Alert if success rate drops below 95%
- Alert if average execution time increases 50%

### Business Metrics
- Internal network transfer volume (target: 70%+)
- External payment success rate (target: 97%+)
- Average profit margin (target: 60%+)
- User network adoption rate (target: 80%+)

---

## Questions for Future Consideration

1. **Agent Scaling:** Should agents scale horizontally (multiple instances)?
2. **Agent Failover:** What happens if an agent crashes?
3. **Agent Versioning:** How do we roll out agent updates?
4. **Agent A/B Testing:** Can we test different agent strategies?
5. **Agent Learning:** Should agents use ML to improve over time?

---

## Contact & Ownership

**Project Owner:** Jackson Fitzgerald
**Architecture:** Claude (AI Assistant)
**Repository:** `/Users/jacksonfitzgerald/Documents/hedge-payments-api`
**Documentation:** `/docs/AGENTS_REGISTRY.md`

**Last Review:** 2025-11-10
**Next Review:** 2025-11-17 (weekly)
