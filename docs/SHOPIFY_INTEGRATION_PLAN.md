# CoverPay Shopify Integration Plan

**Date:** 2025-12-16
**Status:** Ready to build

---

## Integration Options

| Option | Requirements | Distribution | Timeline |
|--------|--------------|--------------|----------|
| **Standard App (Start here)** | Partner account | All 4M+ stores | 2-4 weeks |
| **Payments Platform Partner** | Invite + $1M processed | Native checkout | 3-6 months |
| **Checkout UI Extension** | Shopify Plus only | ~40k stores | 2-4 weeks |

---

## Recommended Path: Standard App First

### How It Works

```
1. Merchant installs CoverPay app from Shopify App Store
2. App adds "Pay with CoverPay" button at checkout
3. Customer clicks button → redirects to CoverPay hosted checkout
4. Customer completes BNPL flow (split across providers)
5. Returns to Shopify with order confirmed
```

### Tech Stack

- **Framework:** Shopify CLI + Node.js (or Remix)
- **Frontend:** Theme App Extension (injects checkout button)
- **Backend:** Connect to existing hedge-payments-api
- **Auth:** Shopify OAuth for merchant installation

### Build Steps

1. Create Shopify Partner account
2. Scaffold app with `shopify app init`
3. Build theme extension for checkout button
4. Create merchant onboarding flow (connect to CoverPay)
5. Build redirect checkout flow
6. Handle order confirmation webhook
7. Submit to Shopify App Store

---

## Revenue Model

```
Transaction: $500
├── Merchant pays CoverPay: 2.5% = $12.50
├── Shopify takes (if Payments Partner): ~15-20%
└── CoverPay keeps: $10-12.50
```

Without Payments Partner status, you keep 100% of fees.

---

## Graduation to Payments Partner

Once you hit:
- 50+ Shopify stores using CoverPay
- $1,000,000+ processed volume

You can apply for official Payments Partner status for native checkout integration.

---

## Resources

- Shopify Partner Signup: https://partners.shopify.com
- Payments Extensions Docs: https://shopify.dev/docs/apps/build/payments
- Checkout UI Extensions: https://shopify.dev/docs/api/checkout-ui-extensions
- App Store Review: https://shopify.dev/docs/apps/build/payments/payments-extension-review

---

## Tomorrow's Tasks

- [ ] Create Shopify Partner account
- [ ] Run `npm init @shopify/app` to scaffold
- [ ] Design checkout button UI
- [ ] Map CoverPay API to Shopify order flow
- [ ] Build merchant dashboard for Shopify settings
