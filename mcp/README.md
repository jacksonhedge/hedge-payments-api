# 🔌 Hedge Payments MCP Server

**Model Context Protocol (MCP) server for Hedge Payments API integration with Claude Desktop**

Enable Claude to process payments and manage merchant balances through natural language using the Hedge Payments API.

---

## 🎯 Overview

This MCP server exposes Hedge Payments API functionality to Claude Desktop, allowing users to:

- **Process Payments**: Create payment transactions in multiple currencies (USD, EUR, GBP, BTC, ETH, USDC, USDT)
- **Check Balances**: View merchant account balances (available, pending, total)

The server handles OAuth2 authentication, token management, and provides type-safe tool interfaces.

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│  Claude Desktop │◄───────►│   MCP Server     │◄───────►│  Hedge Payments API │
│                 │  MCP    │  (This Project)  │  REST   │ (Main API)          │
│  Natural Lang.  │  HTTP   │  OAuth2 + Tools  │  JSON   │  JWT Auth           │
└─────────────────┘         └──────────────────┘         └─────────────────────┘
```

### Components

1. **HTTP Transport** (`src/index.ts`)
   - Express server on port 3001
   - `/mcp` endpoint for tool calls
   - `/health` for monitoring

2. **OAuth2 Client** (`src/oauth.ts`)
   - Exchanges merchant email/password for JWT token
   - Token caching with automatic refresh
   - Token validation

3. **MCP Tools** (`src/tools/`)
   - `process_payment`: Create payment transactions
   - `get_balance`: Retrieve account balances

4. **Type Safety** (`src/types.ts`)
   - TypeScript interfaces for all API interactions
   - Zod schemas for input validation

---

## 🚀 Quick Start

### 1. Installation

```bash
cd ~/Documents/hedge-payments-api/mcp
npm install
```

### 2. Configuration

Create `.env` file:

```bash
PORT=3001
API_BASE_URL=https://hedge-payments-api.onrender.com
NODE_ENV=production
```

### 3. Build & Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Development mode (watch & rebuild)
npm run dev
```

### 4. Test Locally

```bash
# Health check
curl http://localhost:3001/health

# Authenticate
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "authenticate",
    "params": {
      "email": "merchant@example.com",
      "password": "yourpassword"
    }
  }'

# List available tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list",
    "params": {}
  }'
```

---

## 🔧 Claude Desktop Configuration

### Method 1: Configure claude_desktop_config.json

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hedge-payments": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamable-http",
      "auth": {
        "type": "oauth2",
        "credentials": {
          "email": "your-merchant@example.com",
          "password": "your-password"
        }
      }
    }
  }
}
```

### Method 2: Production Deployment (Recommended)

Use the deployed Render URL:

```json
{
  "mcpServers": {
    "hedge-payments": {
      "url": "https://hedge-payments-mcp.onrender.com/mcp",
      "transport": "streamable-http",
      "auth": {
        "type": "oauth2",
        "credentials": {
          "email": "your-merchant@example.com",
          "password": "your-password"
        }
      }
    }
  }
}
```

**Important**: Replace `your-merchant@example.com` and `your-password` with your actual Hedge Payments merchant credentials.

### Restart Claude Desktop

After configuration, restart Claude Desktop to load the MCP server.

---

## 🛠️ Available Tools

### 1. `process_payment`

Create a new payment transaction.

**Parameters:**
- `amount` (number, required): Payment amount (must be positive)
- `currency` (string, required): One of: USD, EUR, GBP, BTC, ETH, USDC, USDT
- `description` (string, optional): Payment description
- `metadata` (object, optional): Additional metadata

**Example (Natural Language in Claude):**
```
Create a payment for $99.99 USD for "Premium Subscription"
```

**Example (Direct API Call):**
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "process_payment",
      "arguments": {
        "amount": 99.99,
        "currency": "USD",
        "description": "Premium Subscription"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123",
    "amount": 99.99,
    "currency": "USD",
    "status": "pending",
    "checkoutUrl": "https://checkout.coinflow.cash/...",
    "createdAt": "2025-10-30T12:00:00Z"
  }
}
```

### 2. `get_balance`

Retrieve merchant account balance.

**Parameters:** None

**Example (Natural Language in Claude):**
```
What's my current balance?
```

**Example (Direct API Call):**
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_balance",
      "arguments": {}
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "available": [
      { "amount": 1500.00, "currency": "USD" },
      { "amount": 0.05, "currency": "BTC" }
    ],
    "pending": [
      { "amount": 250.00, "currency": "USD" }
    ],
    "total": [
      { "amount": 1750.00, "currency": "USD" },
      { "amount": 0.05, "currency": "BTC" }
    ]
  }
}
```

---

## 🔐 Authentication Flow

1. **Initial Authentication**
   - MCP server receives merchant email/password
   - Calls `/api/auth/login` on main Hedge Payments API
   - Receives JWT token with expiration time

2. **Token Caching**
   - Token stored in memory with expiration timestamp
   - Automatically reused for subsequent tool calls
   - Refreshed when expired (with 5-minute buffer)

3. **Tool Execution**
   - Each tool call includes `Authorization: Bearer <token>` header
   - API validates token and processes request
   - Returns data to MCP server → Claude Desktop

---

## 📁 Project Structure

```
mcp/
├── src/
│   ├── index.ts              # Express server with /mcp endpoint
│   ├── mcp-server.ts         # MCP Server implementation
│   ├── oauth.ts              # OAuth2 authentication client
│   ├── types.ts              # TypeScript type definitions
│   └── tools/
│       ├── process_payment.ts  # Payment tool implementation
│       └── get_balance.ts      # Balance tool implementation
│
├── build/                    # Compiled JavaScript (generated)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── Dockerfile                # Docker image for deployment
├── .env.example              # Environment variable template
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

---

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t hedge-payments-mcp .
```

### Run Container

```bash
docker run -d \
  -p 3001:3001 \
  -e API_BASE_URL=https://hedge-payments-api.onrender.com \
  -e NODE_ENV=production \
  --name mcp-server \
  hedge-payments-mcp
```

### Health Check

```bash
docker exec mcp-server curl http://localhost:3001/health
```

---

## 🚢 Production Deployment (Render)

### Option 1: Deploy via GitHub

1. **Commit MCP server code:**
   ```bash
   cd ~/Documents/hedge-payments-api
   git add mcp/
   git commit -m "Add MCP server for Claude Desktop integration"
   git push
   ```

2. **Create new Web Service on Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect to `jacksonhedge/hedge-payments-api`
   - Configure:
     - **Name**: hedge-payments-mcp
     - **Root Directory**: `mcp`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Port**: 3001

3. **Set environment variables:**
   - `API_BASE_URL=https://hedge-payments-api.onrender.com`
   - `NODE_ENV=production`

4. **Deploy**: Click "Create Web Service"

### Option 2: Single Deployment (Main API + MCP)

Modify main API's Dockerfile to run both services (advanced).

---

## 🧪 Testing with MCP Inspector

The MCP SDK includes an inspector tool for testing:

```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Run inspector against your MCP server
mcp-inspector http://localhost:3001/mcp
```

This opens a web UI to test authentication and tool calls.

---

## 📊 Monitoring & Logging

### Console Logs

The server logs all operations:

```
[OAuth2] Authenticating merchant: merchant@example.com
[OAuth2] Authentication successful
[ProcessPayment] Creating payment: { amount: 99.99, currency: 'USD' }
[ProcessPayment] Payment created successfully: pay_abc123
```

### Health Endpoint

```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "success": true,
  "message": "Hedge Payments MCP Server is running",
  "version": "1.0.0",
  "timestamp": "2025-10-30T12:00:00Z"
}
```

---

## 🛡️ Security Considerations

### ✅ Implemented

- **Token Caching**: Reduces authentication requests
- **HTTPS**: Use HTTPS in production (Render provides this)
- **Input Validation**: Zod schemas validate all inputs
- **Error Sanitization**: No sensitive data in error messages
- **Token Expiry**: Automatic token refresh before expiration

### ⚠️ Recommendations

1. **Credential Storage**: Never commit `.env` with real credentials
2. **Rate Limiting**: Monitor API usage to avoid abuse
3. **Audit Logging**: Log all payment operations for compliance
4. **Token Rotation**: Implement regular credential rotation
5. **IP Whitelisting**: Restrict MCP server access (if self-hosted)

---

## 🔧 Troubleshooting

### Issue: Authentication fails

**Solution:**
- Verify merchant credentials are correct
- Check API_BASE_URL is set correctly
- Ensure main Hedge Payments API is running
- Check network connectivity

```bash
# Test authentication manually
curl -X POST https://hedge-payments-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

### Issue: Claude Desktop doesn't see tools

**Solution:**
- Verify `claude_desktop_config.json` syntax is valid
- Restart Claude Desktop completely
- Check MCP server is running: `curl http://localhost:3001/health`
- Review Claude Desktop logs (Help → Show Logs)

### Issue: Payment creation fails

**Solution:**
- Ensure merchant is authenticated first
- Verify currency is supported (USD, EUR, GBP, BTC, ETH, USDC, USDT)
- Check amount is positive
- Review API error message in response

---

## 📚 Related Documentation

- **Main API Documentation**: `/README.md`
- **Quick Start Guide**: `/QUICK_START.md`
- **Deployment Guide**: `/DEPLOYMENT.md`
- **MCP Protocol Spec**: https://modelcontextprotocol.io
- **Coinflow API Docs**: https://docs.coinflow.cash

---

## 🤝 Support

### For API Issues
- **Email**: jacksonfitzgerald25@gmail.com
- **GitHub Issues**: https://github.com/jacksonhedge/hedge-payments-api/issues

### For MCP Protocol Questions
- **MCP Documentation**: https://modelcontextprotocol.io/docs
- **MCP Discord**: https://discord.gg/modelcontextprotocol

---

## 📝 License

MIT License - See main project LICENSE file

---

## 🎉 Example Usage in Claude Desktop

Once configured, you can interact with Claude naturally:

**User:** "I need to create a payment for $149.99 for a yearly subscription"

**Claude:** "I'll create that payment for you using the Hedge Payments API."

*Claude calls `process_payment` tool with the parameters*

**Claude:** "✅ Payment created successfully!

- **Payment ID**: pay_abc123
- **Amount**: $149.99 USD
- **Status**: Pending
- **Checkout URL**: https://checkout.coinflow.cash/...

Share this checkout URL with your customer to complete the payment."

---

**User:** "What's my current balance?"

**Claude:** "Let me check your merchant balance."

*Claude calls `get_balance` tool*

**Claude:** "💰 Your current balances:

**Available:**
- $1,500.00 USD
- 0.05 BTC

**Pending:**
- $250.00 USD

**Total:**
- $1,750.00 USD
- 0.05 BTC"

---

## 🚀 Next Steps

1. ✅ **Test Locally**: Run the server and test with curl
2. ✅ **Deploy to Render**: Make MCP server publicly accessible
3. ✅ **Configure Claude Desktop**: Add MCP server to config
4. ✅ **Test in Claude**: Try natural language payment commands
5. ⏳ **Add More Tools**: Extend with transaction history, refunds, etc.
6. ⏳ **Monitor Usage**: Track API calls and performance
7. ⏳ **Implement Webhooks**: Real-time payment status updates

---

**Built with ❤️ by Claude Code for Jackson Fitzgerald**

**Version**: 1.0.0
**Last Updated**: October 30, 2025
