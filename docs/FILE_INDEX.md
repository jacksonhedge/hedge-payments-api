# File Index - Hedge Payments API

A complete guide to every file in the project.

## 📁 Root Directory

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Project metadata, dependencies, scripts |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |
| `jest.config.js` | Jest testing configuration |
| `Dockerfile` | Docker image build instructions |
| `docker-compose.yml` | Docker container orchestration |
| `.dockerignore` | Docker build ignore rules |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `QUICK_START.md` | 5-minute setup guide |

---

## 📂 /src - Application Source Code

### /src (Root)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `app.js` | Express app setup | Middleware, routes, error handling |
| `server.js` | Server entry point | Start server, graceful shutdown |

### /src/config

| File | Purpose | Exports |
|------|---------|---------|
| `config.js` | App configuration | Server, JWT, Coinflow, CORS settings |

### /src/controllers

Request handlers that process HTTP requests and return responses.

| File | Purpose | Key Methods |
|------|---------|-------------|
| `authController.js` | Authentication logic | `login`, `refreshToken`, `generateApiKey`, `getCurrentUser`, `logout` |
| `paymentController.js` | Payment operations | `createPayment`, `getPayment`, `cancelPayment`, `refundPayment`, `handleWebhook` |
| `balanceController.js` | Balance management | `getBalance`, `getBalanceHistory`, `createPayout`, `getPayout`, `getPayouts` |
| `transactionController.js` | Transaction history | `getTransactions`, `getTransaction`, `getTransactionStats`, `exportTransactions` |
| `kycController.js` | KYC verification | `initiateKYC`, `getKYCStatus`, `submitDocuments`, `updateKYC`, `getKYCRequirements` |

### /src/middleware

Express middleware functions.

| File | Purpose | Functions |
|------|---------|-----------|
| `auth.js` | JWT authentication | `authenticate`, `optionalAuth` |
| `errorHandler.js` | Error handling | `errorHandler`, `notFound` |
| `validate.js` | Input validation | `validate` (Joi schema validator) |

### /src/routes

API route definitions.

| File | Purpose | Endpoints |
|------|---------|-----------|
| `authRoutes.js` | Auth routes | `/login`, `/refresh`, `/api-key`, `/me`, `/logout` |
| `paymentRoutes.js` | Payment routes | `/`, `/:paymentId`, `/:paymentId/cancel`, `/:paymentId/refund`, `/webhook` |
| `balanceRoutes.js` | Balance routes | `/`, `/history`, `/payout`, `/payouts`, `/payouts/:id` |
| `transactionRoutes.js` | Transaction routes | `/`, `/:transactionId`, `/stats/summary`, `/export/download` |
| `kycRoutes.js` | KYC routes | `/initiate`, `/status/:userId`, `/:userId/documents`, `/:userId`, `/requirements` |

### /src/services

Business logic and external service integrations.

| File | Purpose | Key Methods |
|------|---------|-------------|
| `coinflowService.js` | Coinflow API wrapper | `createPayment`, `getPayment`, `cancelPayment`, `refundPayment`, `getBalance`, `getTransactions`, `initiateKYC`, `getKYCStatus`, `createPayout`, `verifyWebhookSignature` |
| `authService.js` | Auth business logic | `generateToken`, `verifyToken`, `hashPassword`, `comparePassword`, `authenticate`, `refreshToken` |

### /src/validators

Joi validation schemas.

| File | Purpose | Schemas |
|------|---------|---------|
| `authValidators.js` | Auth validation | `loginSchema`, `refreshTokenSchema`, `generateApiKeySchema` |
| `paymentValidators.js` | Payment validation | `createPaymentSchema`, `getPaymentSchema`, `cancelPaymentSchema`, `refundPaymentSchema` |
| `transactionValidators.js` | Transaction validation | `getTransactionsSchema`, `getTransactionSchema` |
| `kycValidators.js` | KYC validation | `initiateKYCSchema`, `submitDocumentsSchema`, `getKYCStatusSchema` |

### /src/utils

Helper functions and utilities.

| File | Purpose | Exports |
|------|---------|---------|
| `logger.js` | Winston logger | Configured logger instance |
| `errors.js` | Custom error classes | `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `ExternalServiceError` |

---

## 🧪 /tests - Test Files

| File | Purpose | Test Cases |
|------|---------|------------|
| `auth.test.js` | Auth endpoint tests | Login, get user, refresh token, API key generation |
| `payments.test.js` | Payment endpoint tests | Create payment, get payment, validation tests |
| `health.test.js` | Health check tests | Health endpoint, API info, 404 handler |

---

## 📚 /docs - Documentation

| File | Purpose |
|------|---------|
| `PROJECT_SUMMARY.md` | High-level project overview |
| `FILE_INDEX.md` | This file - complete file reference |
| `claude-connector.json` | Claude AI connector specification |
| `chatgpt-action.json` | ChatGPT action OpenAPI spec |
| `gemini-extension.json` | Gemini extension specification |

---

## 📊 File Count by Directory

```
Root:              8 files
src/               2 files
src/config:        1 file
src/controllers:   5 files
src/middleware:    3 files
src/routes:        5 files
src/services:      2 files
src/validators:    4 files
src/utils:         2 files
tests:             3 files
docs:              5 files
----------------------------
Total:            40 files
```

---

## 🔍 Finding What You Need

### "I need to..."

| Task | Go To |
|------|-------|
| Add a new endpoint | 1. Create controller method<br>2. Add route in routes/<br>3. Add validator if needed |
| Change authentication | `src/middleware/auth.js`, `src/services/authService.js` |
| Modify Coinflow integration | `src/services/coinflowService.js` |
| Add input validation | `src/validators/` (create or edit schema) |
| Change error messages | `src/middleware/errorHandler.js`, `src/utils/errors.js` |
| Configure environment | `.env` and `src/config/config.js` |
| Add tests | `tests/` (create new .test.js file) |
| Update API docs | `README.md`, AI connector files in `docs/` |
| Change logging | `src/utils/logger.js` |
| Modify startup behavior | `src/server.js` |
| Add middleware | `src/middleware/` and `src/app.js` |

---

## 📖 Code Flow Examples

### Creating a Payment

```
Client Request
    ↓
app.js (Express middleware: helmet, cors, rate limit, body parser)
    ↓
routes/paymentRoutes.js (POST /)
    ↓
middleware/auth.js (authenticate)
    ↓
middleware/validate.js (validate with paymentValidators.createPaymentSchema)
    ↓
controllers/paymentController.js (createPayment)
    ↓
services/coinflowService.js (createPayment)
    ↓
Coinflow API
    ↓
Response back through chain
    ↓
Client receives response
```

### Error Handling Flow

```
Error occurs anywhere
    ↓
next(error) or throw error
    ↓
middleware/errorHandler.js (errorHandler)
    ↓
utils/logger.js (log error)
    ↓
Formatted error response sent to client
```

---

## 🎯 Key File Relationships

### Dependencies

```
server.js
  └── app.js
       ├── config/config.js
       ├── utils/logger.js
       ├── middleware/errorHandler.js
       ├── middleware/auth.js (uses services/authService.js)
       └── routes/*
            ├── controllers/*
            │    └── services/*
            ├── middleware/validate.js
            └── validators/*
```

### Import Chains

Most files follow this pattern:
1. External dependencies (express, joi, etc.)
2. Internal services
3. Utilities (logger, errors)
4. Validators (if needed)

---

## 🔧 Most Commonly Edited Files

For typical development, you'll mostly work with:

1. **Controllers** (`src/controllers/`) - Business logic
2. **Routes** (`src/routes/`) - Endpoint definitions
3. **Validators** (`src/validators/`) - Input validation
4. **Services** (`src/services/`) - External integrations
5. **Tests** (`tests/`) - Test coverage

Rarely need to edit:
- `src/middleware/` - Once set, rarely changes
- `src/utils/` - Stable utilities
- `src/config/` - Config structure is stable

---

## 📝 File Naming Conventions

- **Controllers**: `*Controller.js` (e.g., `paymentController.js`)
- **Routes**: `*Routes.js` (e.g., `paymentRoutes.js`)
- **Services**: `*Service.js` (e.g., `coinflowService.js`)
- **Validators**: `*Validators.js` (e.g., `paymentValidators.js`)
- **Middleware**: Descriptive names (e.g., `auth.js`, `errorHandler.js`)
- **Tests**: `*.test.js` (e.g., `payments.test.js`)
- **Utils**: Descriptive names (e.g., `logger.js`, `errors.js`)

---

This index should help you navigate the codebase efficiently. For detailed API documentation, see `README.md`.
