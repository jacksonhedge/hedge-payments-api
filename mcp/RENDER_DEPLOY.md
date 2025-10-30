# 🚀 Deploy MCP Server to Render

This guide walks through deploying the Hedge Payments MCP Server to Render.

---

## 📋 Prerequisites

- ✅ GitHub repository with MCP code pushed
- ✅ Render account (free tier works)
- ✅ Main Hedge Payments API already deployed

---

## 🔧 Step-by-Step Deployment

### 1. Create New Web Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect to your GitHub repository: `jacksonhedge/hedge-payments-api`

### 2. Configure Service Settings

**Basic Info:**
- **Name**: `hedge-payments-mcp`
- **Region**: Oregon (US West) - same as main API
- **Branch**: `main`
- **Root Directory**: `mcp`

**Build & Deploy:**
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Instance:**
- **Instance Type**: Free (512 MB RAM, 0.1 CPU)

### 3. Set Environment Variables

Click "Advanced" → "Add Environment Variable" and add:

| Key | Value |
|-----|-------|
| `PORT` | `3001` |
| `API_BASE_URL` | `https://hedge-payments-api.onrender.com` |
| `NODE_ENV` | `production` |

### 4. Configure Health Check

- **Health Check Path**: `/health`
- **Health Check Grace Period**: 60 seconds

### 5. Deploy

1. Click "Create Web Service"
2. Wait for initial deployment (~3-5 minutes)
3. Monitor build logs for any errors

---

## ✅ Verify Deployment

Once deployed, test the endpoints:

```bash
# Replace with your actual Render URL
MCP_URL="https://hedge-payments-mcp.onrender.com"

# Test health check
curl $MCP_URL/health

# Expected: {"success":true,"message":"Hedge Payments MCP Server is running",...}

# Test API info
curl $MCP_URL/

# Test tools list
curl -X POST $MCP_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}'
```

---

## 🔗 Get Your MCP Server URL

After deployment completes, your MCP server will be available at:

```
https://hedge-payments-mcp.onrender.com
```

Copy this URL - you'll need it for Claude Desktop configuration.

---

## 🖥️ Configure Claude Desktop

### macOS

1. Open `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add your MCP server:

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

3. Replace credentials with your actual Hedge Payments merchant account

4. Restart Claude Desktop

### Windows

1. Open `%APPDATA%\Claude\claude_desktop_config.json`
2. Follow same JSON configuration as macOS
3. Restart Claude Desktop

---

## 🧪 Test in Claude Desktop

After configuration, open Claude Desktop and try:

**Example 1: Create a payment**
```
Create a payment for $99.99 USD for "Premium Subscription"
```

**Example 2: Check balance**
```
What's my current balance?
```

Claude should automatically call your MCP server tools and display results.

---

## 📊 Monitor Your Deployment

### View Logs

1. Go to Render Dashboard
2. Click on `hedge-payments-mcp` service
3. Click "Logs" tab
4. View real-time logs

### Check Metrics

- **Dashboard**: Shows CPU, memory, bandwidth usage
- **Events**: Deployment history
- **Settings**: Modify environment variables

---

## 🔄 Update Deployment

To deploy changes:

```bash
cd ~/Documents/hedge-payments-api/mcp

# Make changes to TypeScript files
# ...

# Commit and push
git add .
git commit -m "Update MCP server"
git push

# Render will automatically detect and deploy
```

---

## 💰 Cost Breakdown

### Current Setup (FREE)

- **Render Free Tier**: $0/month
  - 512 MB RAM
  - 0.1 CPU
  - Spins down after 15 min inactivity
  - 750 hours/month
  - First request after sleep: ~50 seconds

### Upgrade Options

**Render Starter - $7/month**
- Always-on (no cold starts)
- 512 MB RAM
- 0.5 CPU
- Recommended for production

**Render Standard - $25/month**
- 2 GB RAM
- 1 CPU
- Auto-scaling
- Priority support

---

## 🛠️ Troubleshooting

### Issue: Build fails

**Check:**
- Root directory is set to `mcp`
- Build command includes `npm run build`
- TypeScript compiles locally without errors

**Solution:**
```bash
cd ~/Documents/hedge-payments-api/mcp
npm install
npm run build
# Fix any TypeScript errors
git push
```

### Issue: Health check fails

**Check:**
- `PORT` environment variable is set to `3001`
- Start command is `npm start`
- `/health` endpoint exists and returns 200

**Solution:**
Test locally first:
```bash
npm start
curl http://localhost:3001/health
```

### Issue: Cold starts are slow

**Problem:** Free tier spins down after 15 min inactivity

**Solutions:**
1. **Upgrade to Starter**: $7/month for always-on
2. **Keep-alive ping**: Set up external monitor to ping `/health` every 10 minutes
3. **Accept cold starts**: First request takes 50 sec, subsequent requests are fast

### Issue: Claude Desktop doesn't see tools

**Check:**
1. Config file syntax is valid JSON
2. URL is correct (must include `/mcp` endpoint)
3. Credentials are valid Hedge Payments account
4. Restart Claude Desktop completely

**Debug:**
```bash
# Test authentication manually
curl -X POST https://hedge-payments-mcp.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "authenticate",
    "params": {
      "email": "your@email.com",
      "password": "yourpassword"
    }
  }'
```

---

## 🔐 Security Best Practices

### ✅ Already Implemented

- HTTPS enforced by Render
- OAuth2 token exchange
- Environment variables for secrets
- Input validation with Zod
- Error sanitization

### 🔒 Recommended

1. **Rotate Credentials**: Change merchant password regularly
2. **Monitor Logs**: Watch for unusual activity
3. **Rate Limiting**: Consider adding to protect from abuse
4. **API Key Rotation**: Implement regular token refresh
5. **Audit Trail**: Log all payment operations

---

## 📈 Next Steps

### Immediate (This Week)

1. ✅ Deploy MCP server to Render
2. ✅ Configure Claude Desktop
3. ✅ Test payment creation and balance checking
4. ⏳ Monitor logs for errors
5. ⏳ Test with real merchant credentials

### Short-term (Next 2 Weeks)

6. ⏳ Add transaction history tool
7. ⏳ Add payment refund tool
8. ⏳ Implement webhook notifications
9. ⏳ Add KYC status checking tool
10. ⏳ Consider upgrading to paid tier

### Long-term (1-3 Months)

11. ⏳ Add comprehensive error handling
12. ⏳ Implement rate limiting
13. ⏳ Add analytics and monitoring
14. ⏳ Create admin dashboard
15. ⏳ Scale to multiple merchant support

---

## 🆘 Support

### MCP Server Issues
- **GitHub Issues**: https://github.com/jacksonhedge/hedge-payments-api/issues
- **Email**: jacksonfitzgerald25@gmail.com

### Render Platform Issues
- **Documentation**: https://render.com/docs
- **Support**: https://render.com/support

### MCP Protocol Questions
- **Docs**: https://modelcontextprotocol.io/docs
- **Discord**: https://discord.gg/modelcontextprotocol

---

## 📚 Related Documentation

- **MCP Server README**: `/mcp/README.md`
- **Main API Documentation**: `/README.md`
- **Deployment Guide**: `/DEPLOYMENT.md`
- **Quick Start**: `/QUICK_START.md`

---

**Version**: 1.0.0
**Last Updated**: October 30, 2025
**Status**: Ready for Production ✅
