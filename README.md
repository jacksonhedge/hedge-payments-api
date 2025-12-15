# Hedge Payments API

> Production-ready payment processing API with Coinflow integration, designed for AI assistants (Claude, ChatGPT, Gemini)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 🚀 Quick Start

```bash
# 1. Clone and setup
cd hedge-payments-api
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Coinflow credentials

# 3. Start development server
npm run dev

# Server runs at http://localhost:3000
```

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Testing](#testing)
- [Deployment](#deployment)
- [AI Connectors](#ai-connectors)
- [Contributing](#contributing)

## ✨ Features

- **🔐 JWT Authentication** - Secure token-based auth
- **💳 Payment Processing** - Create, cancel, refund payments via Coinflow
- **🛒 CoverPay BNPL** - Intelligent Buy Now Pay Later orchestration across 6 providers (Klarna, Affirm, Afterpay, Sezzle, Zip, PayPal)
- **💰 Balance Management** - Check balances, create payouts
- **📊 Transaction History** - Complete transaction tracking and filtering
- **✅ KYC Verification** - Full KYC workflow integration
- **🛡️ Security** - Helmet, CORS, rate limiting, input validation
- **📝 Logging** - Winston logger with file/console output
- **🧪 Testing** - Jest tests with >80% coverage
- **🐳 Docker** - Ready for containerization
- **🤖 AI-Ready** - Optimized for Claude, ChatGPT, Gemini connectors

## 🏗️ Architecture

```
hedge-payments-api/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic & external services
│   ├── utils/           # Helper functions
│   ├── validators/      # Joi validation schemas
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── tests/               # Jest test files
├── logs/                # Application logs
└── docs/                # Additional documentation
```

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Coinflow API credentials

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env file with your credentials
nano .env
```

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Coinflow
COINFLOW_API_KEY=your-api-key
COINFLOW_API_SECRET=your-api-secret
COINFLOW_BASE_URL=https://api.coinflow.cash
COINFLOW_ENVIRONMENT=sandbox
COINFLOW_MERCHANT_ID=your-merchant-id
```

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### Get Token

```bash
POST /api/auth/login
{
  "email": "user@example.com",
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
    "expiresIn": "24h",
    "tokenType": "Bearer"
  }
}
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

## 🔌 Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | Login and get JWT token | ❌ |
| POST | `/refresh` | Refresh JWT token | ❌ |
| POST | `/api-key` | Generate API key | ✅ |
| GET | `/me` | Get current user info | ✅ |
| POST | `/logout` | Logout user | ✅ |

### Payments (`/api/payments`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new payment | ✅ |
| GET | `/:paymentId` | Get payment details | ✅ |
| POST | `/:paymentId/cancel` | Cancel payment | ✅ |
| POST | `/:paymentId/refund` | Refund payment | ✅ |
| POST | `/webhook` | Handle webhooks | ❌ (verified) |

### Balance (`/api/balance`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get account balance | ✅ |
| GET | `/history` | Get balance history | ✅ |
| POST | `/payout` | Create payout | ✅ |
| GET | `/payouts` | Get all payouts | ✅ |
| GET | `/payouts/:id` | Get payout details | ✅ |

### Transactions (`/api/transactions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all transactions | ✅ |
| GET | `/:transactionId` | Get transaction details | ✅ |
| GET | `/stats/summary` | Get transaction stats | ✅ |
| GET | `/export/download` | Export transactions | ✅ |

### KYC (`/api/kyc`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/initiate` | Initiate KYC verification | ✅ |
| GET | `/status/:userId` | Get KYC status | ✅ |
| POST | `/:userId/documents` | Submit KYC documents | ✅ |
| PUT | `/:userId` | Update KYC info | ✅ |
| GET | `/requirements` | Get KYC requirements | ✅ |

### CoverPay BNPL (`/api/coverpay`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | CoverPay service health check | ❌ |
| POST | `/checkout` | Process BNPL checkout (waterfall/split) | ✅ |
| GET | `/transactions` | Get merchant transactions | ✅ |
| GET | `/transactions/:id` | Get transaction details | ✅ |
| GET | `/analytics` | Get approval rates & analytics | ✅ |
| GET | `/providers/stats` | Get provider performance stats | ✅ |
| POST | `/webhook` | Handle provider webhooks | ❌ (verified) |

**Demo:** [public/coverpay-demo.html](public/coverpay-demo.html) | **Docs:** [docs/COVERPAY_API.md](docs/COVERPAY_API.md)

## 📝 Example Requests

### Create Payment

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "description": "Product purchase"
  }'
```

### Get Transactions

```bash
curl -X GET "http://localhost:3000/api/transactions?page=1&limit=20&status=completed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Balance

```bash
curl -X GET "http://localhost:3000/api/balance?currency=USD" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Process BNPL Checkout (CoverPay)

```bash
curl -X POST http://localhost:3000/api/coverpay/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29999,
    "currency": "USD",
    "strategy": "waterfall",
    "customer": {
      "email": "customer@example.com",
      "phone": "+14155551234",
      "name": "John Doe"
    },
    "merchant": {
      "returnUrl": "https://yourstore.com/success",
      "cancelUrl": "https://yourstore.com/cancel"
    }
  }'
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm test -- --coverage
```

## 🐳 Docker Deployment

### Build and Run

```bash
# Build image
npm run docker:build

# Start container
npm run docker:run

# Stop container
npm run docker:stop
```

### Manual Docker Commands

```bash
# Build
docker build -t hedge-payments-api .

# Run
docker run -p 3000:3000 --env-file .env hedge-payments-api

# With docker-compose
docker-compose up -d
```

## 🚀 Production Deployment

### Heroku

```bash
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
# ... set other env vars
git push heroku main
```

### AWS / DigitalOcean / Other

1. Set up Node.js environment (>= 18.0.0)
2. Clone repository
3. Configure environment variables
4. Install dependencies: `npm ci --production`
5. Start server: `npm start`

## 🤖 AI Connectors

This API is designed to work seamlessly with AI assistants:

### Claude Connector
See `/docs/claude-connector.json`

### ChatGPT Action
See `/docs/chatgpt-action.json`

### Gemini Extension
See `/docs/gemini-extension.json`

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "success": true,
  "message": "Hedge Payments API is running",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "production"
}
```

### Logs

Logs are stored in `logs/` directory:
- `logs/app.log` - All logs
- `logs/error.log` - Error logs only

## 🔒 Security

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - 100 requests per minute per IP
- **JWT** - Token-based authentication
- **Input Validation** - Joi schema validation
- **Error Handling** - Consistent error responses

## 📈 Rate Limits

- **Default**: 100 requests per minute
- **Configurable**: Set via environment variables

## 🛠️ Development

```bash
# Start dev server with auto-reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

## 📄 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

Jackson Fitzgerald

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: jacksonfitzgerald25@gmail.com

## 🗺️ Roadmap

- [ ] Add database integration (PostgreSQL/MongoDB)
- [ ] Implement user management
- [ ] Add email notifications
- [ ] Create admin dashboard
- [ ] Add more payment providers
- [ ] Implement webhooks management UI
- [ ] Add GraphQL support

---

Built with ❤️ for AI-powered payment processing
