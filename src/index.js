require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const scheduler = require('./scheduler');
const woocommerceRoutes = require('./routes/woocommerce');
const analyticsRoutes = require('./routes/analytics');
const meritRoutes = require('./routes/merit');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is running' });
});

// Mount WooCommerce routes
app.use('/api/woocommerce', woocommerceRoutes);

// Mount Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Mount Merit routes
app.use('/api/merit', meritRoutes);

// Get sync status or history
app.get('/api/woocommerce-sync/status', (req, res) => {
  // This would normally fetch from a database
  res.json({ 
    success: true, 
    data: {
      lastSync: scheduler.getLastSyncTime(),
      isRunning: scheduler.isSyncRunning(),
      isScheduled: config.scheduler.enabled,
      schedule: config.scheduler.schedule
    } 
  });
});

// Trigger a sync operation manually
app.post('/api/woocommerce-sync', async (req, res) => {
  try {
    const { days = 1 } = req.body;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days));
    
    // Trigger sync in background
    scheduler.syncOrdersToInvoices(fromDate, toDate)
      .then(result => {
        logger.info(`Manual sync completed: ${JSON.stringify(result)}`);
      })
      .catch(err => {
        logger.error(`Manual sync failed: ${err.message}`);
      });
    
    res.json({ success: true, message: 'Synchronization initiated' });
  } catch (error) {
    logger.error(`Error initiating sync: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to initiate synchronization' });
  }
});

// Keep old routes for backward compatibility
app.get('/api/sync/status', (req, res) => {
  res.redirect('/api/woocommerce-sync/status');
});

app.post('/api/sync', (req, res) => {
  // Redirect to the new endpoint
  req.url = '/api/woocommerce-sync';
  app._router.handle(req, res);
});

// Start scheduler if enabled
if (config.scheduler.enabled) {
  scheduler.startScheduler();
  logger.info(`Scheduler started with schedule: ${config.scheduler.schedule}`);
} else {
  logger.info('Automatic synchronization is disabled');
}

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API-only mode enabled`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
}); 