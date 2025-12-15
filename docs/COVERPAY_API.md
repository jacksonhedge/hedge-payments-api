# CoverPay API Documentation

> Intelligent BNPL Orchestration Layer - Maximize approval rates across 6 Buy Now Pay Later providers

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Process Checkout](#process-checkout)
  - [Get Transaction](#get-transaction)
  - [List Transactions](#list-transactions)
  - [Get Analytics](#get-analytics)
  - [Get Provider Stats](#get-provider-stats)
  - [Webhooks](#webhooks)
- [Strategies](#strategies)
- [Provider Configuration](#provider-configuration)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

CoverPay is an intelligent orchestration layer that routes BNPL (Buy Now Pay Later) checkout requests across multiple providers to maximize approval rates. Instead of integrating with each BNPL provider separately, you integrate once with CoverPay and get access to all 6 providers.

### Supported Providers

- **Klarna** - Leading European BNPL provider
- **Affirm** - Popular US-based installment payments
- **Afterpay** - Global BNPL with strong presence in US, AU, UK
- **Sezzle** - US-focused BNPL for smaller purchases
- **Zip** - Australian-based, expanding globally
- **PayPal Pay in 4** - PayPal's BNPL offering

### Key Benefits

- **40-60% higher approval rates** compared to single-provider integration
- **One integration** instead of managing 6 separate SDKs
- **Smart routing** based on historical performance
- **Real-time analytics** with Supabase backend
- **Waterfall & split strategies** for maximum flexibility

---

## Getting Started

### Base URL

```
Production: https://your-domain.com/api/coverpay
Development: http://localhost:3000/api/coverpay
```

### Quick Start

```bash
# 1. Set environment variables
COVERPAY_MOCK_MODE=true  # For testing without credentials

# Or configure real providers
KLARNA_API_KEY=your_key
KLARNA_API_SECRET=your_secret
AFFIRM_PUBLIC_KEY=your_key
# ... etc for each provider

# 2. Test health check
curl https://your-domain.com/api/coverpay/health

# 3. Process your first checkout
curl -X POST https://your-domain.com/api/coverpay/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 29999, "currency": "USD", ...}'
```

---

## Authentication

All endpoints (except `/health` and `/webhook`) require JWT authentication.

### Headers

```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Getting a Token

Obtain a JWT token from the main authentication endpoint:

```bash
POST /api/auth/login
{
  "email": "merchant@example.com",
  "password": "your-password",
  "merchantId": "merchant123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

---

## Endpoints

### Health Check

Check if the CoverPay service is operational and see which providers are enabled.

**Endpoint:** `GET /api/coverpay/health`

**Auth Required:** No

**Example Request:**

```bash
curl https://your-domain.com/api/coverpay/health
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "service": "CoverPay BNPL Orchestration",
    "status": "operational",
    "database": "connected",
    "providers": ["klarna", "affirm", "afterpay", "sezzle", "zip", "paypal"],
    "providerCount": 6
  }
}
```

---

### Process Checkout

Process a BNPL checkout using waterfall or split strategy.

**Endpoint:** `POST /api/coverpay/checkout`

**Auth Required:** Yes

**Request Body:**

```typescript
{
  amount: number;           // Amount in cents (required)
  currency: string;         // Currency code, default: "USD"
  strategy: string;         // "waterfall" or "split", default: "waterfall"
  merchantOrderId?: string; // Your order reference ID

  customer: {
    email: string;          // Required
    phone: string;          // Required, E.164 format (+14155551234)
    name?: string;          // Full name
    firstName?: string;
    lastName?: string;
    billingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;      // 2-letter code, default: "US"
    };
    shippingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };

  merchant: {
    returnUrl: string;      // Required - success redirect URL
    cancelUrl: string;      // Required - cancel redirect URL
    webhookUrl?: string;    // Optional webhook endpoint
    itemDescription?: string;
  };

  items?: [{
    name: string;
    quantity: number;
    unitPrice: number;      // In cents
    sku?: string;
    category?: string;
  }];

  metadata?: object;        // Custom data
}
```

**Example Request:**

```bash
curl -X POST https://your-domain.com/api/coverpay/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29999,
    "currency": "USD",
    "strategy": "waterfall",
    "merchantOrderId": "order_12345",
    "customer": {
      "email": "customer@example.com",
      "phone": "+14155551234",
      "name": "John Doe",
      "billingAddress": {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "US"
      }
    },
    "merchant": {
      "returnUrl": "https://yourstore.com/checkout/success",
      "cancelUrl": "https://yourstore.com/checkout/cancel",
      "webhookUrl": "https://yourstore.com/webhooks/coverpay",
      "itemDescription": "Premium Wireless Headphones"
    },
    "items": [
      {
        "name": "Wireless Headphones",
        "quantity": 1,
        "unitPrice": 29999,
        "sku": "WH-1000XM5",
        "category": "Electronics"
      }
    ],
    "metadata": {
      "orderId": "12345",
      "source": "web"
    }
  }'
```

**Success Response (Approved):**

```json
{
  "success": true,
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "provider": "klarna",
    "sessionId": "klarna_session_abc123xyz",
    "redirectUrl": "https://klarna.com/checkout/abc123xyz",
    "strategy": "waterfall",
    "split": false,
    "attempts": 1
  }
}
```

**Success Response (Split Payment):**

```json
{
  "success": true,
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "strategy": "split",
    "split": true,
    "sessions": [
      {
        "provider": "klarna",
        "sessionId": "klarna_session_abc",
        "redirectUrl": "https://klarna.com/checkout/abc",
        "amount": 14999,
        "order": 1
      },
      {
        "provider": "affirm",
        "sessionId": "affirm_session_xyz",
        "redirectUrl": "https://affirm.com/checkout/xyz",
        "amount": 15000,
        "order": 2
      }
    ],
    "attempts": 2
  }
}
```

**Declined Response:**

```json
{
  "success": false,
  "error": "BNPL_DECLINED",
  "message": "No BNPL provider approved this transaction",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "attempts": [
      {
        "provider": "klarna",
        "status": "declined",
        "reason": "Customer not approved",
        "responseTimeMs": 245
      },
      {
        "provider": "affirm",
        "status": "declined",
        "reason": "Amount exceeds limit",
        "responseTimeMs": 198
      }
      // ... up to 6 attempts
    ]
  }
}
```

---

### Get Transaction

Get details for a specific transaction including all provider attempts.

**Endpoint:** `GET /api/coverpay/transactions/:transactionId`

**Auth Required:** Yes

**Example Request:**

```bash
curl https://your-domain.com/api/coverpay/transactions/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "merchantOrderId": "order_12345",
    "status": "approved",
    "amount": 29999,
    "currency": "USD",
    "strategy": "waterfall",
    "finalProvider": "klarna",
    "isSplit": false,
    "redirectUrl": "https://klarna.com/checkout/abc123",
    "customerEmail": "customer@example.com",
    "createdAt": "2025-12-15T10:30:00.000Z",
    "updatedAt": "2025-12-15T10:30:02.000Z",
    "completedAt": "2025-12-15T10:35:00.000Z",
    "attempts": [
      {
        "id": "attempt_001",
        "provider": "klarna",
        "status": "approved",
        "amount": 29999,
        "responseTimeMs": 245,
        "attemptedAt": "2025-12-15T10:30:01.000Z"
      }
    ]
  }
}
```

---

### List Transactions

Get paginated list of transactions for your merchant account.

**Endpoint:** `GET /api/coverpay/transactions`

**Auth Required:** Yes

**Query Parameters:**

- `limit` (number, default: 50) - Number of transactions per page
- `offset` (number, default: 0) - Pagination offset
- `status` (string, optional) - Filter by status: `approved`, `declined`, `pending`, `failed`, `cancelled`

**Example Request:**

```bash
curl "https://your-domain.com/api/coverpay/transactions?limit=20&offset=0&status=approved" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "merchantOrderId": "order_12345",
        "status": "approved",
        "amount": 29999,
        "currency": "USD",
        "finalProvider": "klarna",
        "customerEmail": "customer@example.com",
        "createdAt": "2025-12-15T10:30:00.000Z"
      }
      // ... more transactions
    ],
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

### Get Analytics

Get approval rates, volume, and provider performance analytics.

**Endpoint:** `GET /api/coverpay/analytics`

**Auth Required:** Yes

**Query Parameters:**

- `startDate` (ISO date, optional) - Start date for analytics period
- `endDate` (ISO date, optional) - End date for analytics period
- `provider` (string, optional) - Filter by specific provider: `klarna`, `affirm`, `afterpay`, `sezzle`, `zip`, `paypal`

**Example Request:**

```bash
curl "https://your-domain.com/api/coverpay/analytics?startDate=2025-12-01&endDate=2025-12-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTransactions": 1250,
      "approved": 875,
      "declined": 325,
      "pending": 35,
      "failed": 15,
      "approvalRate": 70.0,
      "totalVolume": 387500,
      "approvedVolume": 312500,
      "splitPayments": 45
    },
    "byProvider": [
      {
        "provider": "klarna",
        "transactions": 450,
        "approved": 360,
        "declined": 90,
        "approvalRate": 80.0,
        "volume": 156000,
        "avgResponseTimeMs": 245
      },
      {
        "provider": "affirm",
        "transactions": 380,
        "approved": 270,
        "declined": 110,
        "approvalRate": 71.0,
        "volume": 128500,
        "avgResponseTimeMs": 312
      }
      // ... other providers
    ]
  }
}
```

---

### Get Provider Stats

Get detailed performance statistics for each provider over a time period.

**Endpoint:** `GET /api/coverpay/providers/stats`

**Auth Required:** Yes

**Query Parameters:**

- `days` (number, default: 30) - Number of days to look back (1-365)

**Example Request:**

```bash
curl "https://your-domain.com/api/coverpay/providers/stats?days=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "providers": [
      {
        "provider": "klarna",
        "totalAttempts": 1250,
        "approved": 1000,
        "declined": 250,
        "approvalRate": 80.0,
        "totalVolume": 437500,
        "avgAmount": 350.0,
        "avgResponseTimeMs": 245,
        "position": 1
      }
      // ... other providers
    ]
  }
}
```

---

### Webhooks

Receive real-time updates about transaction status changes from BNPL providers.

**Endpoint:** `POST /api/coverpay/webhook`

**Alternative:** `POST /api/coverpay/webhook/:provider` (provider-specific)

**Auth Required:** No (verified by provider signature)

**Supported Events:**

- `checkout.completed` - Customer completed checkout
- `checkout.cancelled` - Customer cancelled checkout
- `checkout.failed` - Checkout failed
- `order.approved` - Order approved by provider
- `order.declined` - Order declined by provider
- `order.cancelled` - Order cancelled
- `payment.captured` - Payment captured
- `payment.failed` - Payment failed

**Webhook Payload:**

```json
{
  "provider": "klarna",
  "event": "checkout.completed",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "klarna_session_abc123",
  "status": "completed",
  "data": {
    // Provider-specific data
  }
}
```

**Example Webhook Handler:**

```javascript
// Express.js example
app.post('/webhooks/coverpay', express.json(), async (req, res) => {
  const { provider, event, transactionId, status } = req.body;

  console.log(`Received ${event} from ${provider} for transaction ${transactionId}`);

  // Update your database
  await updateOrderStatus(transactionId, status);

  // Send confirmation email
  if (event === 'checkout.completed') {
    await sendConfirmationEmail(transactionId);
  }

  res.status(200).json({ success: true });
});
```

---

## Strategies

### Waterfall Strategy (Recommended)

Tries providers sequentially until one approves. Providers are attempted in order based on historical approval rates.

**How it works:**

1. Try Provider 1 (e.g., Klarna)
2. If declined, try Provider 2 (e.g., Affirm)
3. Continue until approved or all providers exhausted
4. Log all attempts to database

**Best for:**

- Standard checkouts
- Maximizing approval rates
- Single payment flow

**Example:**

```json
{
  "amount": 29999,
  "strategy": "waterfall",
  "customer": { ... },
  "merchant": { ... }
}
```

### Split Strategy

Divides payment across 2 providers. Increases approval odds for larger purchases by requesting smaller amounts from each provider.

**How it works:**

1. Split total amount in half
2. Request both providers in parallel
3. If both approve, customer completes 2 checkouts
4. If either fails, fallback to waterfall strategy

**Best for:**

- Large purchases ($500+)
- High-value transactions
- Customers near credit limits

**Example:**

```json
{
  "amount": 99999,
  "strategy": "split",
  "customer": { ... },
  "merchant": { ... }
}
```

**Result:**

```json
{
  "success": true,
  "split": true,
  "sessions": [
    {
      "provider": "klarna",
      "amount": 49999,
      "redirectUrl": "https://klarna.com/checkout/abc"
    },
    {
      "provider": "affirm",
      "amount": 50000,
      "redirectUrl": "https://affirm.com/checkout/xyz"
    }
  ]
}
```

---

## Provider Configuration

### Environment Variables

Configure each provider with environment variables:

#### Klarna

```bash
KLARNA_API_KEY=your_api_key
KLARNA_API_SECRET=your_api_secret
KLARNA_REGION=US              # US, EU, or OC
KLARNA_ENVIRONMENT=sandbox    # sandbox or production
```

#### Affirm

```bash
AFFIRM_PUBLIC_KEY=your_public_key
AFFIRM_PRIVATE_KEY=your_private_key
AFFIRM_ENVIRONMENT=sandbox    # sandbox or production
```

#### Afterpay

```bash
AFTERPAY_MERCHANT_ID=your_merchant_id
AFTERPAY_SECRET_KEY=your_secret_key
AFTERPAY_REGION=US            # US, AU, UK, or EU
AFTERPAY_ENVIRONMENT=sandbox  # sandbox or production
```

#### Sezzle

```bash
SEZZLE_PUBLIC_KEY=your_public_key
SEZZLE_PRIVATE_KEY=your_private_key
SEZZLE_ENVIRONMENT=sandbox    # sandbox or production
```

#### Zip

```bash
ZIP_API_KEY=your_api_key
ZIP_API_SECRET=your_api_secret
ZIP_MERCHANT_ID=your_merchant_id
ZIP_ENVIRONMENT=sandbox       # sandbox or production
```

#### PayPal Pay in 4

```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox    # sandbox or production
```

### Mock Mode (Testing)

Enable mock mode to test without real provider credentials:

```bash
COVERPAY_MOCK_MODE=true
```

In mock mode:
- All providers are enabled automatically
- Realistic approval/decline simulation
- No actual API calls to providers
- Perfect for development and testing

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "data": {
    // Additional error context
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `TRANSACTION_NOT_FOUND` | 404 | Transaction ID doesn't exist |
| `BNPL_DECLINED` | 422 | All providers declined |
| `PROVIDER_ERROR` | 502 | Provider API error |
| `DATABASE_ERROR` | 500 | Database connection issue |

### Example Error Responses

**Validation Error:**

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "\"amount\" must be a positive number",
  "data": {
    "field": "amount",
    "value": -100
  }
}
```

**Authorization Error:**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**All Providers Declined:**

```json
{
  "success": false,
  "error": "BNPL_DECLINED",
  "message": "No BNPL provider approved this transaction",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "attempts": [
      {
        "provider": "klarna",
        "status": "declined",
        "reason": "Customer not approved"
      }
      // ... more attempts
    ]
  }
}
```

---

## Examples

### Complete Checkout Flow

```javascript
// 1. Create checkout session
const response = await fetch('https://your-api.com/api/coverpay/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 29999,
    currency: 'USD',
    strategy: 'waterfall',
    merchantOrderId: 'order_12345',
    customer: {
      email: 'customer@example.com',
      phone: '+14155551234',
      name: 'John Doe',
      billingAddress: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'US'
      }
    },
    merchant: {
      returnUrl: 'https://yourstore.com/success',
      cancelUrl: 'https://yourstore.com/cancel',
      webhookUrl: 'https://yourstore.com/webhooks/coverpay'
    },
    items: [
      {
        name: 'Wireless Headphones',
        quantity: 1,
        unitPrice: 29999
      }
    ]
  })
});

const result = await response.json();

if (result.success) {
  // 2. Redirect customer to provider
  window.location.href = result.data.redirectUrl;

  // 3. Provider handles checkout
  // 4. Customer redirected back to returnUrl
  // 5. Webhook notification received
} else {
  // Handle decline
  console.error('BNPL checkout declined:', result.message);
  // Show alternative payment methods
}
```

### Split Payment Flow

```javascript
const response = await fetch('https://your-api.com/api/coverpay/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 99999,
    strategy: 'split',
    customer: { /* ... */ },
    merchant: { /* ... */ }
  })
});

const result = await response.json();

if (result.success && result.data.split) {
  // Customer needs to complete 2 checkouts
  console.log('Complete payment 1:', result.data.sessions[0].redirectUrl);
  console.log('Complete payment 2:', result.data.sessions[1].redirectUrl);

  // Redirect to first provider
  window.location.href = result.data.sessions[0].redirectUrl;

  // After first completion, redirect to second provider
  // Both sessions must be completed for order fulfillment
}
```

### Check Transaction Status

```javascript
const transactionId = '550e8400-e29b-41d4-a716-446655440000';

const response = await fetch(
  `https://your-api.com/api/coverpay/transactions/${transactionId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const result = await response.json();

console.log('Transaction status:', result.data.status);
console.log('Provider:', result.data.finalProvider);
console.log('Attempts:', result.data.attempts.length);
```

### Get Analytics Dashboard Data

```javascript
// Last 30 days analytics
const response = await fetch(
  'https://your-api.com/api/coverpay/analytics?startDate=2025-11-15&endDate=2025-12-15',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const analytics = await response.json();

console.log('Approval rate:', analytics.data.summary.approvalRate + '%');
console.log('Total volume:', '$' + (analytics.data.summary.totalVolume / 100));
console.log('Top provider:', analytics.data.byProvider[0].provider);
```

---

## Testing

### Demo Page

Visit the interactive demo at `/public/coverpay-demo.html` to:

- Test checkout flows without coding
- Visualize waterfall routing
- See example API requests/responses
- Test both waterfall and split strategies

### Mock Mode

Enable mock mode for testing:

```bash
# .env
COVERPAY_MOCK_MODE=true
```

Mock mode features:
- No real provider credentials needed
- Realistic approval/decline simulation (~75% approval rate)
- Instant responses (simulated network delays)
- All 6 providers enabled
- Full database logging

### Example Test Cases

```javascript
// Test successful waterfall
const test1 = await processCheckout({
  amount: 29999,
  strategy: 'waterfall',
  customer: { email: 'test@example.com', phone: '+14155551234' }
});
// Expect: approved on 1st or 2nd provider

// Test split payment
const test2 = await processCheckout({
  amount: 99999,
  strategy: 'split',
  customer: { email: 'test@example.com', phone: '+14155551234' }
});
// Expect: 2 sessions returned

// Test all providers decline (rare in mock mode)
// Simulate by setting mock approval rates to 0%
```

---

## Database Schema

Transactions are stored in Supabase with the following structure:

### bnpl_transactions table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Transaction ID (PK) |
| merchant_id | varchar | Merchant identifier |
| merchant_order_id | varchar | Order reference |
| customer_email | varchar | Customer email |
| customer_phone | varchar | Customer phone |
| customer_name | varchar | Customer name |
| amount | integer | Amount in cents |
| currency | varchar | Currency code |
| status | varchar | approved, declined, pending, failed, cancelled |
| strategy | varchar | waterfall or split |
| final_provider | varchar | Provider that approved |
| is_split | boolean | Split payment flag |
| redirect_url | text | Provider redirect URL |
| metadata | jsonb | Custom data |
| created_at | timestamp | Created timestamp |
| updated_at | timestamp | Updated timestamp |
| completed_at | timestamp | Completion timestamp |

### bnpl_attempts table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Attempt ID (PK) |
| transaction_id | uuid | FK to transactions |
| provider | varchar | Provider name |
| amount | integer | Amount attempted |
| attempt_order | integer | Sequence number |
| status | varchar | approved or declined |
| provider_session_id | varchar | Provider session ID |
| provider_redirect_url | text | Provider URL |
| response_time_ms | integer | Response time |
| error_code | varchar | Error code if declined |
| error_message | text | Error message |
| provider_response | jsonb | Full provider response |
| attempted_at | timestamp | Attempt timestamp |

---

## Support

For questions, issues, or feature requests:

- **Documentation:** This file
- **Demo:** `/public/coverpay-demo.html`
- **Email:** jacksonfitzgerald25@gmail.com
- **GitHub:** Create an issue in the repository

---

## Changelog

### v1.0.0 (2025-12-15)

- Initial release
- 6 BNPL providers integrated
- Waterfall and split strategies
- Supabase database integration
- REST API endpoints
- Mock mode for testing
- Real-time analytics
- Webhook support

---

**Built with love for AI-powered payment processing**
