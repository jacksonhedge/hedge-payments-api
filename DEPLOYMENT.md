# 🚀 Deployment Guide - Hedge Payments API

Complete guide for deploying the Hedge Payments API to production.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Heroku Deployment](#heroku-deployment)
- [AWS Deployment](#aws-deployment)
- [DigitalOcean Deployment](#digitalocean-deployment)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [Post-Deployment](#post-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Coinflow API credentials (production)
- [ ] Strong JWT secret (min 32 characters)
- [ ] Domain name (optional but recommended)
- [ ] SSL certificate (HTTPS required for production)
- [ ] Monitoring setup (logs, alerts)
- [ ] Backup strategy
- [ ] Tested all endpoints locally

---

## Heroku Deployment

### Quick Deploy (5 minutes)

```bash
# 1. Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Login to Heroku
heroku login

# 3. Create new Heroku app
heroku create your-hedge-payments-api

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-production-secret-min-32-chars
heroku config:set COINFLOW_API_KEY=your-production-key
heroku config:set COINFLOW_API_SECRET=your-production-secret
heroku config:set COINFLOW_ENVIRONMENT=production
heroku config:set COINFLOW_MERCHANT_ID=your-merchant-id
heroku config:set PORT=3000

# 5. Deploy
git add .
git commit -m "Prepare for production"
git push heroku main

# 6. Open your app
heroku open
```

### Verify Deployment

```bash
# Check logs
heroku logs --tail

# Test health endpoint
curl https://your-app-name.herokuapp.com/health

# Check app status
heroku ps
```

---

## AWS Deployment

### Using EC2 (Recommended)

#### 1. Launch EC2 Instance

```bash
# Choose: Ubuntu Server 22.04 LTS
# Instance type: t3.micro (free tier) or t3.small
# Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (API)
```

#### 2. Connect and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx
```

#### 3. Deploy Application

```bash
# Clone your repository
cd /var/www
sudo git clone https://github.com/your-username/hedge-payments-api.git
cd hedge-payments-api

# Install dependencies
sudo npm ci --production

# Create .env file
sudo nano .env
# Paste production environment variables

# Start with PM2
sudo pm2 start src/server.js --name hedge-payments-api

# Save PM2 process list
sudo pm2 save

# Setup PM2 to start on boot
sudo pm2 startup
```

#### 4. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/hedge-payments-api
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/hedge-payments-api /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 5. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## DigitalOcean Deployment

### Using Droplet

#### 1. Create Droplet

- **Distribution**: Ubuntu 22.04 LTS
- **Plan**: Basic ($6/month)
- **Region**: Choose closest to your users
- **Add SSH key**

#### 2. Follow AWS EC2 steps 2-5 above

Same process as AWS EC2.

### Using DigitalOcean App Platform (Easiest)

```bash
# 1. Push code to GitHub

# 2. Go to DigitalOcean Dashboard
# 3. Click "Create" → "Apps"
# 4. Connect GitHub repository
# 5. Configure:
#    - Name: hedge-payments-api
#    - Environment: Node.js
#    - Build Command: npm install
#    - Run Command: npm start
#    - HTTP Port: 3000

# 6. Add environment variables in dashboard

# 7. Deploy!
```

---

## Docker Deployment

### Local Docker

```bash
# Build image
docker build -t hedge-payments-api .

# Run container
docker run -d \
  -p 3000:3000 \
  --name hedge-payments-api \
  --env-file .env \
  --restart unless-stopped \
  hedge-payments-api

# Check logs
docker logs -f hedge-payments-api

# Stop container
docker stop hedge-payments-api
```

### Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Push to Docker Hub

```bash
# Login
docker login

# Tag image
docker tag hedge-payments-api your-username/hedge-payments-api:1.0.0

# Push
docker push your-username/hedge-payments-api:1.0.0
```

---

## Environment Configuration

### Production `.env` Template

```env
# Server
NODE_ENV=production
PORT=3000

# JWT (CRITICAL: Change in production!)
JWT_SECRET=your-super-secret-production-key-min-32-characters-long
JWT_EXPIRES_IN=24h

# Coinflow (Production credentials)
COINFLOW_API_KEY=your-production-api-key
COINFLOW_API_SECRET=your-production-api-secret
COINFLOW_BASE_URL=https://api.coinflow.cash
COINFLOW_ENVIRONMENT=production
COINFLOW_MERCHANT_ID=your-production-merchant-id

# CORS (Set to your domain)
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong, random secrets
- [ ] Set CORS_ORIGIN to specific domain
- [ ] Enable HTTPS
- [ ] Use production Coinflow credentials
- [ ] Set NODE_ENV=production
- [ ] Review rate limits
- [ ] Enable logging
- [ ] Backup .env file securely

---

## Post-Deployment

### Verify Deployment

```bash
# Health check
curl https://your-domain.com/health

# API info
curl https://your-domain.com/

# Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "merchantId": "your-merchant-id"
  }'
```

### Monitor Logs

```bash
# Heroku
heroku logs --tail

# AWS/DigitalOcean with PM2
pm2 logs hedge-payments-api

# Docker
docker logs -f hedge-payments-api

# Or check log files
tail -f logs/app.log
tail -f logs/error.log
```

---

## Monitoring & Maintenance

### Setup Monitoring

1. **Uptime Monitoring**
   - UptimeRobot: https://uptimerobot.com
   - Pingdom: https://www.pingdom.com

2. **Application Monitoring**
   - New Relic
   - DataDog
   - PM2 Plus

3. **Log Management**
   - Papertrail
   - Loggly
   - CloudWatch (AWS)

### Regular Maintenance Tasks

#### Daily
- [ ] Check error logs
- [ ] Monitor API response times
- [ ] Review failed requests

#### Weekly
- [ ] Check disk space
- [ ] Review rate limit hits
- [ ] Analyze traffic patterns
- [ ] Update dependencies (if needed)

#### Monthly
- [ ] Security updates
- [ ] Performance optimization
- [ ] Backup review
- [ ] Cost analysis

### Scaling

#### Horizontal Scaling

```bash
# Heroku
heroku ps:scale web=3

# AWS/DigitalOcean
# Use load balancer with multiple instances
```

#### Database Scaling (Future)

When you add a database:
- Use managed databases (RDS, DigitalOcean Managed DB)
- Setup read replicas
- Implement caching (Redis)

---

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### SSL Certificate Issues
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

#### PM2 Issues
```bash
# Restart app
pm2 restart hedge-payments-api

# Delete and recreate
pm2 delete hedge-payments-api
pm2 start src/server.js --name hedge-payments-api

# Check status
pm2 status
pm2 monit
```

#### Docker Issues
```bash
# Remove and rebuild
docker-compose down
docker-compose up -d --build

# Check container health
docker ps
docker inspect hedge-payments-api
```

---

## Backup & Recovery

### Backup Strategy

```bash
# Backup environment variables
cp .env .env.backup

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Backup code (if not using git)
tar -czf code-backup-$(date +%Y%m%d).tar.gz src/
```

### Recovery

```bash
# Restore from backup
cp .env.backup .env

# Restart services
pm2 restart all
# or
docker-compose restart
```

---

## CI/CD Pipeline (Future)

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"
```

---

## Cost Estimates

### Heroku
- **Free Tier**: Limited hours, sleeps after 30min
- **Hobby**: $7/month
- **Production**: $25-50/month

### AWS EC2
- **t3.micro (free tier)**: Free for 12 months
- **t3.small**: ~$15/month
- **t3.medium**: ~$30/month

### DigitalOcean
- **Basic Droplet**: $6/month
- **App Platform**: $12/month

### Docker (Self-hosted)
- **VPS**: $5-20/month depending on provider

---

## Support

### Need Help?

- **Documentation**: Check README.md and other docs
- **Logs**: Always check logs first
- **GitHub Issues**: Report bugs
- **Email**: jacksonfitzgerald25@gmail.com

---

**You're ready to deploy!** 🚀

Choose your deployment method and follow the steps above. Remember to test thoroughly before going live.
