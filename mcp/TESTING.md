# 🧪 MCP Server Testing Guide

Complete testing guide for the Hedge Payments MCP Server.

---

## 🎯 Test Checklist

### ✅ Local Testing
- [ ] Health endpoint responds
- [ ] API info endpoint responds
- [ ] Tools list endpoint works
- [ ] Authentication succeeds with valid credentials
- [ ] Authentication fails with invalid credentials
- [ ] Payment tool creates transaction
- [ ] Balance tool retrieves balances
- [ ] Error handling works correctly

### ✅ Deployment Testing
- [ ] Render build succeeds
- [ ] Health checks pass
- [ ] Environment variables configured
- [ ] HTTPS endpoint accessible
- [ ] Auto-deploy works on git push

### ✅ Claude Desktop Testing
- [ ] Config file valid JSON
- [ ] MCP server connects
- [ ] Tools appear in Claude
- [ ] Natural language commands work
- [ ] Payment creation succeeds
- [ ] Balance retrieval succeeds

---

## 🔧 Local Testing

### 1. Start the Server

```bash
cd ~/Documents/hedge-payments-api/mcp
npm run build
npm start
```

Expected output:
```
🚀 Hedge Payments MCP Server running on port 3001
📡 MCP endpoint: http://localhost:3001/mcp
💚 Health check: http://localhost:3001/health
🔗 API Base URL: https://hedge-payments-api.onrender.com
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "success": true,
  "message": "Hedge Payments MCP Server is running",
  "version": "1.0.0",
  "timestamp": "2025-10-30T12:00:00Z"
}
```

### 3. Test API Info

```bash
curl http://localhost:3001/
```

Expected response:
```json
{
  "success": true,
  "name": "Hedge Payments MCP Server",
  "version": "1.0.0",
  "description": "Model Context Protocol server for Hedge Payments API",
  "endpoints": {
    "health": "/health",
    "mcp": "/mcp (POST)"
  }
}
```

### 4. Test Tools List

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "process_payment",
        "description": "Create a new payment transaction...",
        "inputSchema": { ... }
      },
      {
        "name": "get_balance",
        "description": "Retrieve the merchant account balance...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### 5. Test Authentication (Valid Credentials)

**Note:** Replace with actual merchant credentials that exist in your main API.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "authenticate",
    "params": {
      "email": "merchant@example.com",
      "password": "yourpassword"
    }
  }'
```

Expected response (success):
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

### 6. Test Authentication (Invalid Credentials)

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "authenticate",
    "params": {
      "email": "invalid@example.com",
      "password": "wrongpassword"
    }
  }'
```

Expected response (error):
```json
{
  "success": false,
  "error": "Authentication failed: Invalid credentials"
}
```

### 7. Test Process Payment Tool

**Important:** Must authenticate first (see step 5).

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
        "description": "Test Payment"
      }
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"data\":{\"id\":\"pay_...\",\"amount\":99.99,...}}"
      }
    ]
  }
}
```

### 8. Test Get Balance Tool

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

Expected response:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"data\":{\"available\":[...],\"pending\":[...]}}"
      }
    ]
  }
}
```

---

## 🚀 Production Testing (Render)

### 1. Verify Deployment

After deploying to Render:

```bash
# Replace with your actual Render URL
export MCP_URL="https://hedge-payments-mcp.onrender.com"

# Test health
curl $MCP_URL/health

# Test info
curl $MCP_URL/

# Test tools list
curl -X POST $MCP_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}'
```

### 2. Test Authentication Flow

```bash
# Authenticate
curl -X POST $MCP_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "authenticate",
    "params": {
      "email": "your-merchant@example.com",
      "password": "your-password"
    }
  }'

# Create payment (must authenticate first)
curl -X POST $MCP_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "process_payment",
      "arguments": {
        "amount": 149.99,
        "currency": "USD",
        "description": "Production Test Payment"
      }
    }
  }'
```

### 3. Monitor Logs

1. Go to Render Dashboard
2. Click on `hedge-payments-mcp`
3. Click "Logs"
4. Look for:
   - `[OAuth2] Authenticating merchant:`
   - `[OAuth2] Authentication successful`
   - `[ProcessPayment] Creating payment:`
   - `[ProcessPayment] Payment created successfully:`

---

## 🖥️ Claude Desktop Testing

### 1. Verify Configuration

**macOS:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Should contain:**
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

### 2. Restart Claude Desktop

- **macOS**: Cmd+Q to quit, then reopen
- **Windows**: Right-click taskbar icon → Quit, then reopen

### 3. Test Natural Language Commands

Open Claude Desktop and try these commands:

**Test 1: Payment Creation**
```
Create a payment for $99.99 USD for "Premium Subscription"
```

Expected: Claude calls `process_payment` tool and shows payment details.

**Test 2: Balance Check**
```
What's my current balance?
```

Expected: Claude calls `get_balance` tool and shows balances.

**Test 3: Complex Payment**
```
I need to create a payment for €249.50 EUR for an annual enterprise license
```

Expected: Claude calls `process_payment` with correct parameters.

**Test 4: Multi-Currency Balance**
```
Show me my balances across all currencies
```

Expected: Claude calls `get_balance` and formats results nicely.

### 4. Verify Tool Responses

Claude should:
- ✅ Acknowledge the request
- ✅ Call the appropriate MCP tool
- ✅ Parse the JSON response
- ✅ Present results in natural language
- ✅ Include payment ID and checkout URL
- ✅ Format currency amounts correctly

---

## 🔍 Error Testing

### Test Invalid Amount

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "process_payment",
      "arguments": {
        "amount": -50,
        "currency": "USD"
      }
    }
  }'
```

Expected: Validation error (amount must be positive)

### Test Invalid Currency

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "process_payment",
      "arguments": {
        "amount": 100,
        "currency": "XYZ"
      }
    }
  }'
```

Expected: Validation error (invalid currency)

### Test Unauthenticated Tool Call

```bash
# Don't authenticate first
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "process_payment",
      "arguments": {
        "amount": 100,
        "currency": "USD"
      }
    }
  }'
```

Expected: 401 error (not authenticated)

---

## 📊 Performance Testing

### Cold Start Time (Free Tier)

```bash
# After 15 min of inactivity
time curl https://hedge-payments-mcp.onrender.com/health
```

Expected: ~50 seconds first request, <200ms subsequent

### Warm Performance

```bash
# Make 10 requests in succession
for i in {1..10}; do
  time curl -s https://hedge-payments-mcp.onrender.com/health > /dev/null
done
```

Expected: All requests <500ms

---

## 🐛 Troubleshooting Tests

### Issue: Tools not appearing in Claude

**Test 1: Verify config syntax**
```bash
python3 -m json.tool ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Should not error.

**Test 2: Verify URL is accessible**
```bash
curl https://hedge-payments-mcp.onrender.com/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}'
```

Should return tools list.

**Test 3: Check Claude Desktop logs**
- macOS: Help → Show Logs
- Look for MCP server connection errors

### Issue: Authentication fails

**Test 1: Verify credentials**
```bash
curl -X POST https://hedge-payments-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

Should return JWT token.

**Test 2: Check MCP server logs**
```bash
# In Render Dashboard → Logs
# Look for: [OAuth2] Authentication failed
```

**Test 3: Verify API_BASE_URL**
```bash
# In Render Dashboard → Environment
# Verify: API_BASE_URL=https://hedge-payments-api.onrender.com
```

---

## ✅ Complete Test Script

Save this as `test_mcp.sh`:

```bash
#!/bin/bash

MCP_URL="${1:-http://localhost:3001}"

echo "🧪 Testing MCP Server: $MCP_URL"
echo ""

# Test 1: Health
echo "1️⃣ Health Check"
curl -s $MCP_URL/health | python3 -m json.tool
echo ""

# Test 2: API Info
echo "2️⃣ API Info"
curl -s $MCP_URL/ | python3 -m json.tool
echo ""

# Test 3: Tools List
echo "3️⃣ Tools List"
curl -s -X POST $MCP_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}' | python3 -m json.tool
echo ""

echo "✅ Basic tests complete!"
```

Usage:
```bash
# Local
chmod +x test_mcp.sh
./test_mcp.sh http://localhost:3001

# Production
./test_mcp.sh https://hedge-payments-mcp.onrender.com
```

---

## 📈 Success Criteria

### ✅ All Tests Pass When:

1. **Health endpoint** returns 200 with success message
2. **Tools list** returns both payment and balance tools
3. **Authentication** succeeds with valid credentials
4. **Authentication** fails with invalid credentials
5. **Payment tool** creates transaction successfully
6. **Balance tool** retrieves merchant balances
7. **Error handling** returns proper error messages
8. **Claude Desktop** connects and shows tools
9. **Natural language** commands execute correctly
10. **Performance** meets expectations (<500ms warm requests)

---

## 🎉 Test Results Template

Use this template to document your test results:

```
# MCP Server Test Results

**Date**: [DATE]
**Tester**: [YOUR NAME]
**Environment**: [local/production]
**URL**: [MCP SERVER URL]

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| Health Endpoint | ✅/❌ | |
| API Info | ✅/❌ | |
| Tools List | ✅/❌ | |
| Authentication (Valid) | ✅/❌ | |
| Authentication (Invalid) | ✅/❌ | |
| Process Payment | ✅/❌ | |
| Get Balance | ✅/❌ | |
| Error Handling | ✅/❌ | |
| Claude Desktop Config | ✅/❌ | |
| Natural Language Commands | ✅/❌ | |

## Issues Found

[List any issues discovered]

## Recommendations

[List any improvements or next steps]
```

---

**Version**: 1.0.0
**Last Updated**: October 30, 2025
