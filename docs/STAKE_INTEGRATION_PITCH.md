# Hedge Payments + Bankroll: Stake.US Integration Pitch

**Target:** Stake.US (US Sweepstakes Casino)
**Opportunity Size:** $100M+ annual payment volume
**Integration Timeline:** 30-60 days

---

## The Problem Stake.US Has

### Current Payment Limitations

**Stake.US Today:**
- ❌ NO bank transfers (ACH)
- ❌ NO PayPal, Venmo, Cash App
- ❌ NO traditional payment apps
- ❌ ONLY crypto + credit cards (via Breeze)
- ❌ 3-5% payment processing fees
- ❌ Slow fiat withdrawals (crypto-only redemptions)

**Why This Hurts Them:**
1. **Low conversion rates** - Players bounce when they can't use their preferred payment method
2. **High fees** - Breeze charges 3-5% on credit card purchases
3. **Poor UX** - Most US players don't have crypto wallets
4. **Withdrawal friction** - Crypto-only withdrawals limit player base
5. **Competitive disadvantage** - Other social casinos offer more payment methods

### The Regulatory Constraint

Stake.US operates under **sweepstakes model** (Gold Coins + Stake Cash), which creates unique payment challenges:
- Can't operate like traditional casinos
- Limited processor options willing to work with social gaming
- Must maintain clear separation between purchased (Gold Coins) and promotional (Stake Cash) currencies
- Crypto-heavy solution alienates mainstream US players

---

## The Hedge Payments + Bankroll Solution

### What We Offer Stake.US

**1. Modern Payment Stack**
- ✅ ACH bank transfers (via CoinFlow/Plaid)
- ✅ Credit/debit cards
- ✅ Bankroll wallet (Venmo-like experience)
- ✅ Crypto (Bitcoin, USDC, SOL, etc.)
- ✅ Instant USDC settlements on Solana

**2. Dramatically Lower Fees**

| Current (Breeze) | With Hedge Payments |
|------------------|---------------------|
| 3-5% per transaction | 1% for Bankroll network transfers |
| + Chargebacks | Zero chargebacks (push payments) |
| + Fraud losses | Built-in fraud detection |
| **Total: ~4-6%** | **Total: ~1%** |

**3. Instant Deposits & Withdrawals**

For players using Bankroll:
- **Deposits:** Instant (database-only if both in network)
- **Withdrawals:** Instant to Bankroll wallet (not 24 hours for crypto)
- **No blockchain wait times**
- **No gas fees**

**4. Better Player Experience**

Players load **Bankroll wallet** once (ACH, card, crypto), then:
- Instant deposits to Stake.US (1 click)
- Instant withdrawals to Bankroll
- Use same balance across multiple gaming sites (if they join Hedge)
- P2P transfers to friends (split winnings, etc.)
- Keep gambling funds separate from main bank account

---

## The Network Effect Model

### How It Works

**Traditional Payment Flow (Current State):**
```
Player Bank Account → Breeze (3-5% fee) → Stake.US
Stake.US → Crypto Network (gas fees) → Player Crypto Wallet
```

**Hedge Network Flow (If Both Parties In Network):**
```
Player Bankroll Wallet → Hedge Ledger ($0 cost, 1% fee) → Stake.US Wallet
Stake.US Wallet → Hedge Ledger ($0 cost, 1% fee) → Player Bankroll Wallet
```

### Economics for Stake.US

**Scenario: $100M annual Gold Coin purchases**

| Metric | Current (Breeze) | With Hedge (70% network) |
|--------|------------------|--------------------------|
| **Volume** | $100M | $100M |
| **Payment Costs** | $4M (4%) | $1.2M (1.2%)* |
| **Chargeback Losses** | $500K (0.5%) | $50K (0.05%)** |
| **Total Cost** | **$4.5M** | **$1.25M** |
| **Annual Savings** | - | **$3.25M** |

*1% fee on 70% internal transfers, 3.5% fee on 30% external
**90% reduction due to push-payment model and fraud detection

### Economics for Hedge Payments

**Revenue Model:**
- 1% fee on internal transfers (pure profit, $0 cost)
- 3.5% fee on external transfers (~17% margin)

**At 70% network penetration:**
- $70M internal volume × 1% = $700K revenue, $700K profit (100% margin!)
- $30M external volume × 3.5% = $1.05M revenue, ~$180K profit (17% margin)
- **Total: $1.75M revenue, $880K profit, 50% blended margin**

**As network grows to 80-90%, margins approach 80%+**

---

## Integration Approach

### Phase 1: Add Bankroll as Payment Method (30 days)

**Step 1: Stake.US Merchant Onboarding**
- Sign up as Hedge Payments merchant
- KYC/compliance verification
- Configure settlement preferences (USDC on Solana recommended)

**Step 2: API Integration**
```javascript
// Add "Pay with Bankroll" button to Stake.US checkout
<BankrollPayButton
  merchantId="stake-us"
  amount={100}
  currency="USD"
  description="Gold Coins Purchase"
  onSuccess={handlePaymentSuccess}
/>
```

**Step 3: Player Experience**
1. Player clicks "Pay with Bankroll" on Stake.US
2. Bankroll modal opens (or redirects)
3. Player logs in / signs up for Bankroll
4. Player funds Bankroll wallet (ACH, card, crypto) - one-time setup
5. Approves payment to Stake.US
6. **Instant settlement** - Gold Coins appear immediately
7. Future deposits: 1-click, instant!

### Phase 2: Withdrawal Support (60 days)

**Add Bankroll Withdrawals for Stake Cash Redemptions**

Current State:
- Players redeem Stake Cash → Crypto only → 24 hour wait

New Flow:
- Players redeem Stake Cash → Bankroll wallet → Instant!
- From Bankroll, they can:
  - Cash out to bank account (ACH)
  - Transfer to another Bankroll user
  - Use at other merchants
  - Keep as USDC

**Compliance:** Hedge handles KYC/AML for withdrawals

### Phase 3: White-Label Wallet (90 days)

**"Stake.US Wallet powered by Bankroll"**

Integrate Bankroll wallet directly into Stake.US app:
- Branded as Stake.US wallet
- Players see it as native feature
- Backend powered by Hedge/Bankroll infrastructure
- Stake.US gets:
  - Instant deposits/withdrawals
  - Lower fees
  - Better UX
  - No payment infrastructure headaches

---

## Competitive Advantages

### vs Current Stack (Breeze + Crypto)

| Feature | Breeze | Hedge + Bankroll |
|---------|--------|------------------|
| **Deposit Methods** | Cards only | Cards, ACH, Bankroll, Crypto |
| **Fees** | 3-5% | 1% (network transfers) |
| **Deposit Speed** | 5 minutes | Instant |
| **Withdrawal Methods** | Crypto only | Bankroll (instant), Bank, Crypto |
| **Withdrawal Speed** | 24 hours | Instant to Bankroll |
| **Chargebacks** | Yes (costly) | No (push payments) |
| **Player UX** | Fragmented | Unified wallet |

### vs Other Payment Processors

**MoonPay / Banxa / Ramp:**
- They focus on crypto on-ramps (3-5% fees)
- We offer both crypto AND fiat, with lower fees
- Our network effect makes internal transfers near-free

**Traditional PSPs (Stripe, Adyen):**
- They don't work with gaming/gambling
- We're purpose-built for this use case
- Built on CoinFlow (gaming-friendly infrastructure)

**PayPal / Venmo:**
- They don't allow gambling transactions
- Bankroll is gaming-friendly
- Better economics (push payments, lower fees)

---

## Value Propositions by Stakeholder

### For Stake.US (The Business)

**1. Reduce Payment Costs by 60-70%**
- Save $3-4M annually on $100M volume
- 100% margin improvement on network transfers

**2. Increase Conversion Rates**
- Add ACH (most common US payment method)
- Bankroll wallet appeals to younger demographic
- Remove friction of crypto-only withdrawals

**3. Improve Player Retention**
- Instant withdrawals = happier players
- Unified wallet experience
- Lower fees = more play value

**4. Outsource Payment Complexity**
- We handle KYC/AML/compliance
- We handle fraud detection
- We handle multi-currency support
- You focus on gaming experience

**5. Future-Proof Payment Stack**
- Built on Solana (instant settlements)
- USDC-native (stablecoin, no volatility)
- Extensible to new payment methods

### For Stake.US Players

**1. More Payment Options**
- Connect bank account (ACH)
- Use Bankroll wallet (like Venmo)
- Still support cards + crypto

**2. Lower Fees**
- 1% vs 3-5% means more Gold Coins per dollar

**3. Instant Withdrawals**
- No more waiting 24 hours for crypto
- Cash out to Bankroll instantly
- From Bankroll to bank in 1-2 days (or instant to another Bankroll user)

**4. Unified Balance**
- One Bankroll wallet for all gaming sites (future)
- P2P transfers (send winnings to friends)
- Better financial control

### For Hedge Payments (Us)

**1. Massive Volume Partner**
- Stake.US processes $100M+ annually
- 20M+ global players (even 1% using Bankroll = 200K users)

**2. High-Margin Revenue**
- 50-80% profit margins as network grows
- $880K+ profit on $100M volume at 70% network

**3. Strategic Wedge into Gaming**
- Stake is Tier 1 gaming brand
- Reference customer for other casinos/gaming companies
- "If Stake uses Bankroll, we should too"

**4. Network Effect Catalyst**
- 200K+ Bankroll users = massive network liquidity
- These users spend elsewhere = more Hedge merchants needed
- Viral loop: Users → Merchants → More Users

---

## Risk Mitigation

### Regulatory Compliance

**Concern:** Gaming payments are highly regulated

**Mitigation:**
- CoinFlow (our infrastructure) already serves gaming clients
- We handle KYC/AML at player level
- Stake.US maintains sweepstakes model compliance
- Clear separation of purchased vs promotional currency
- State-by-state compliance monitoring

### Fraud & Chargebacks

**Concern:** Gaming has high fraud rates

**Mitigation:**
- Push payments (ACH, Bankroll) have zero chargebacks
- Real-time fraud detection (via CoinFlow)
- Player identity verification (KYC before withdrawal)
- Transaction monitoring and limits
- Bankroll's social graph reduces synthetic identity fraud

### Technical Integration

**Concern:** Complex integration with existing Stake.US stack

**Mitigation:**
- Simple REST API integration (days, not months)
- Hosted payment page option (zero frontend work)
- Webhook-based settlement notifications
- Sandbox environment for testing
- Reference implementations provided

### Network Liquidity

**Concern:** Network effect only works if both sides adopt

**Mitigation:**
- Stake.US brings 20M+ potential Bankroll users
- Instant deposits work even for non-network players (via CoinFlow)
- Gradual rollout: Start with deposits, add withdrawals later
- Marketing partnership to drive Bankroll adoption

---

## Financial Model

### Year 1 Projections (Conservative)

**Assumptions:**
- Stake.US processes $100M in Gold Coin purchases annually
- 10% of players adopt Bankroll in Year 1 (20K users)
- 30% of transactions become internal network transfers

| Metric | Value |
|--------|-------|
| **Total Payment Volume** | $100M |
| **Bankroll User Adoption** | 20,000 users (10%) |
| **Network Transfer Volume** | $30M (30%) |
| **External Transfer Volume** | $70M (70%) |
| **Revenue (Hedge)** | $2.75M |
| **Profit (Hedge)** | $1.05M |
| **Blended Margin** | 38% |
| **Cost Savings (Stake.US)** | $2.5M |

### Year 2 Projections (Network Effect)

**Assumptions:**
- Player adoption grows to 30% (60K users)
- Network transfers grow to 60%

| Metric | Value |
|--------|-------|
| **Total Payment Volume** | $150M (growth) |
| **Bankroll User Adoption** | 60,000 users (30%) |
| **Network Transfer Volume** | $90M (60%) |
| **External Transfer Volume** | $60M (40%) |
| **Revenue (Hedge)** | $3.0M |
| **Profit (Hedge)** | $2.0M |
| **Blended Margin** | 67% |
| **Cost Savings (Stake.US)** | $4.5M |

---

## Go-To-Market Strategy

### Phase 1: Pilot Launch (Month 1-2)

**Soft Launch:**
- Add "Pay with Bankroll" as option alongside existing methods
- No marketing push yet
- Monitor: conversion rates, fees, support tickets
- Target: 1,000 early adopter players

**Success Metrics:**
- Higher conversion rate than credit cards
- Lower support ticket volume than crypto
- Positive player feedback (NPS survey)

### Phase 2: Featured Rollout (Month 3-4)

**Marketing Push:**
- Feature Bankroll in Stake.US app
- Email campaign to existing players: "New way to deposit - instant & lower fees"
- Bonus promotion: "Fund Bankroll wallet, get 10% bonus Gold Coins"
- Target: 10,000 active Bankroll users

**Success Metrics:**
- 10% of new deposits via Bankroll
- $5M+ volume through Hedge
- <0.1% fraud rate

### Phase 3: Default Payment Method (Month 5-6)

**Full Integration:**
- Bankroll becomes primary/recommended payment method
- Wallet branding: "Stake.US Wallet powered by Bankroll"
- Add withdrawal support (Stake Cash → Bankroll)
- Target: 20,000+ active users

**Success Metrics:**
- 30% of deposits via Bankroll
- $30M+ volume through Hedge
- $2.5M+ cost savings for Stake.US

---

## The Ask

### Immediate Next Steps

**Week 1:**
1. Intro call with Stake.US payments/product team
2. Share Hedge Payments + Bankroll demo
3. Review integration requirements
4. Discuss compliance/regulatory concerns

**Week 2-4:**
1. Stake.US signs merchant agreement
2. Technical integration kickoff
3. Sandbox environment setup
4. API integration (deposits only)

**Month 2:**
1. Beta test with 100 players
2. Gather feedback, iterate
3. Prepare marketing materials
4. Launch to 10% of players

**Month 3:**
1. Full launch (deposits)
2. Monitor metrics
3. Plan withdrawal integration

**Quarter 2:**
1. Add withdrawal support
2. Scale to 30% adoption
3. Explore white-label wallet integration

---

## Why Now?

### Market Timing

**1. Stake.US is Growing Fast**
- Sweepstakes casino market exploding in US
- Stake.US is top 3 player
- Payment limitations are holding them back

**2. Crypto Gaming is Maturing**
- Solana gaming ecosystem taking off
- USDC becoming standard for settlements
- Players comfortable with crypto (but want fiat on-ramps)

**3. Traditional PSPs Don't Serve Gaming**
- Stripe, PayPal, Square all ban gambling
- Creates opportunity for specialized solutions
- CoinFlow + Bankroll fill this gap

**4. Network Effect is Real**
- The more players on Bankroll, the more valuable it becomes
- Stake.US can be the anchor tenant that kickstarts network
- First-mover advantage in social gaming wallet space

---

## Competitive Landscape

### Who Else is Solving This?

**Current Stake.US Stack:**
- Breeze (credit cards) - incumbent, expensive, limited
- Crypto wallets - niche audience, poor UX for mainstream

**Alternatives They Could Consider:**
- MoonPay/Banxa/Ramp - Crypto on-ramps, similar fees to Breeze
- Build in-house - Expensive, slow, regulatory complexity
- Partner with another gaming PSP - None with our network effect model

**Our Advantage:**
- Only solution with unified fiat + crypto + wallet experience
- Only solution with network effect economics (lower fees as adoption grows)
- Only solution purpose-built for social gaming
- Fastest time-to-market (30 days vs 6+ months to build)

---

## Conclusion

### The Opportunity

Stake.US is **constrained by limited payment options** in the US market. They're losing conversions, paying high fees, and delivering a subpar player experience.

Hedge Payments + Bankroll can:
- **Reduce their payment costs by 60-70%** ($3-4M savings annually)
- **Increase conversion rates** by adding ACH and wallet payments
- **Improve player retention** with instant deposits and withdrawals
- **Future-proof their payment stack** with Solana-native infrastructure

We get:
- **Massive volume partner** ($100M+ annually)
- **High-margin revenue** (50-80% profit margins)
- **Strategic wedge into gaming** (reference customer for industry)
- **Network effect catalyst** (20M+ potential Bankroll users)

### The Win-Win

**Stake.US saves millions. Players get better experience. Hedge builds a massive network.**

**This is the perfect partnership to launch the Hedge Payments network effect.**

---

## Next Steps

**Ready to discuss?**

Contact:
- Jackson Fitzgerald
- Hedge Payments / Bankroll
- [Contact info]

**What we need from Stake.US:**
1. Intro call with payments/product team (30 min)
2. Understanding of current payment volumes and costs
3. Technical contact for API integration
4. Compliance/regulatory contact

**What we'll provide:**
1. Full API documentation
2. Sandbox environment for testing
3. Reference implementation (React, React Native)
4. Compliance documentation
5. Dedicated integration support

**Timeline: Live in 30-60 days.**

Let's build the future of gaming payments together.
