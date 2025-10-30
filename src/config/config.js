require('dotenv').config();

module.exports = {
  // Server Configuration
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Coinflow API Configuration
  coinflow: {
    apiKey: process.env.COINFLOW_API_KEY || '',
    apiSecret: process.env.COINFLOW_API_SECRET || '',
    baseUrl: process.env.COINFLOW_BASE_URL || 'https://api.coinflow.cash',
    environment: process.env.COINFLOW_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
    merchantId: process.env.COINFLOW_MERCHANT_ID || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};
