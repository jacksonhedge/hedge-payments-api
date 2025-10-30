const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const config = require('./config/config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const kycRoutes = require('./routes/kycRoutes');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger
if (config.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hedge Payments API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'Hedge Payments API',
    version: '1.0.0',
    description: 'Production-ready payment processing API with Coinflow integration',
    endpoints: {
      auth: '/api/auth',
      payments: '/api/payments',
      balance: '/api/balance',
      transactions: '/api/transactions',
      kyc: '/api/kyc',
    },
    documentation: '/api/docs',
    health: '/health',
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/kyc', kycRoutes);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
