const app = require('./app');
const config = require('./config/config');
const logger = require('./utils/logger');

const PORT = config.port;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║         🚀 Hedge Payments API Server Started 🚀          ║
  ║                                                           ║
  ║   Environment: ${config.env.padEnd(42)}║
  ║   Port:        ${String(PORT).padEnd(42)}║
  ║   URL:         http://localhost:${PORT}${' '.repeat(26)}║
  ║                                                           ║
  ║   Health:      http://localhost:${PORT}/health${' '.repeat(19)}║
  ║   API Docs:    http://localhost:${PORT}/api/docs${' '.repeat(16)}║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = server;
