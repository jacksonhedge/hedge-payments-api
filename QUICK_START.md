# ⚡ Quick Start Guide

Get the Hedge Payments API running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Coinflow API credentials (or use sandbox mode)
- Terminal/Command Line access

## Step 1: Setup (2 minutes)

```bash
# Navigate to project directory
cd ~/Documents/hedge-payments-api

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

## Step 2: Configure Environment (1 minute)

Edit `.env` file with your credentials:

```env
# Minimum required configuration
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-key-at-least-32-characters-long

# Coinflow (use sandbox for testing)
COINFLOW_API_KEY=your-api-key-or-leave-empty-for-now
COINFLOW_API_SECRET=your-api-secret-or-leave-empty-for-now
COINFLOW_ENVIRONMENT=sandbox
```

**Note**: The API will work without Coinflow credentials in development mode, but actual payment processing will be mocked.

## Step 3: Start Server (1 minute)

```bash
# Start development server
npm run dev
```

You should see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         🚀 Hedge Payments API Server Started 🚀          ║
║                                                           ║
║   Environment: development                                ║
║   Port:        3000                                       ║
║   URL:         http://localhost:3000                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Step 4: Test the API (1 minute)

### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Hedge Payments API is running",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "development"
}
```

### Get API Information

```bash
curl http://localhost:3000/
```

### Login and Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "merchantId": "test-merchant"
  }'
```

Save the token from the response for next steps.

### Create a Payment

```bash
# Replace YOUR_TOKEN with the token from login
curl -X POST http://localhost:3000/api/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "customerEmail": "customer@example.com",
    "description": "Test payment"
  }'
```

## 🎉 Success!

Your API is now running! Here's what you can do next:

### Explore All Endpoints

```bash
# Get your user info
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get balance
curl -X GET http://localhost:3000/api/balance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get transactions
curl -X GET http://localhost:3000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get KYC requirements
curl -X GET http://localhost:3000/api/kyc/requirements \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📋 Available Scripts

```bash
npm run dev          # Start development server with auto-reload
npm start            # Start production server
npm test             # Run tests
npm run docker:build # Build Docker image
npm run docker:run   # Run with Docker
```

## 🔧 Common Issues

### Port Already in Use

If port 3000 is already in use, change it in `.env`:

```env
PORT=3001
```

### Missing Dependencies

```bash
npm install
```

### Permission Errors

```bash
sudo npm install
# or use nvm to manage Node.js without sudo
```

## 📚 Next Steps

1. **Read Full Documentation**: `README.md`
2. **Review API Endpoints**: See all available routes
3. **Configure Coinflow**: Add real API credentials
4. **Run Tests**: `npm test`
5. **Deploy**: Check deployment guides in README

## 🚀 Quick Deploy to Production

### Using Docker

```bash
# 1. Build
npm run docker:build

# 2. Run
npm run docker:run

# Your API is now running on port 3000!
```

### Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start src/server.js --name hedge-payments-api

# Check status
pm2 status

# View logs
pm2 logs hedge-payments-api
```

## 🤖 AI Connector Setup

Want to use this with Claude, ChatGPT, or Gemini?

1. **Get your API URL** (local or deployed)
2. **Generate API key**: POST `/api/auth/api-key`
3. **Check connector docs** in `/docs` folder
4. **Submit to AI platform** (Claude, OpenAI, Google)

## 💡 Pro Tips

- Use Postman or Insomnia for easier API testing
- Enable logging: `LOG_LEVEL=debug` in `.env`
- Run tests before deploying: `npm test`
- Use environment-specific `.env` files (`.env.production`, `.env.staging`)

## 📞 Need Help?

- Check `README.md` for detailed documentation
- Review error logs in `logs/` folder
- Check GitHub issues
- Email: jacksonfitzgerald25@gmail.com

---

**You're all set! Happy coding! 🎊**
