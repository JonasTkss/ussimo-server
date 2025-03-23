const cron = require('node-cron');
const woocommerceService = require('./services/woocommerce');
// const meritService = require('./services/merit'); // Commented out for UI testing
const logger = require('./utils/logger');
const dataTransformer = require('./utils/dataTransformer');
const config = require('./config');

// Store processed orders to avoid duplicates
const processedOrders = new Set();

// Store sync state
let isSyncing = false;
let lastSyncTime = null;
let schedulerJob = null;

/**
 * Synchronize orders from WooCommerce to invoices in Merit Aktiva
 * @param {Date} fromDate - Start date for orders to sync
 * @param {Date} toDate - End date for orders to sync
 */
async function syncOrdersToInvoices(fromDate, toDate) {
  try {
    // Prevent concurrent syncs
    if (isSyncing) {
      logger.warn('Sync already in progress, skipping new sync request');
      return { status: 'skipped', reason: 'Sync already in progress' };
    }
    
    isSyncing = true;
    logger.info(`Starting order synchronization from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    // Fetch orders from specified date range
    const after = fromDate.toISOString();
    const before = toDate.toISOString();
    const { orders } = await woocommerceService.getOrders({ after, before, status: 'completed' });
    logger.info(`Found ${orders.length} orders to process`);
    
    // Process each order
    const results = {
      total: orders.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      succeeded: 0
    };
    
    for (const order of orders) {
      // Skip if already processed
      if (processedOrders.has(order.id)) {
        logger.info(`Order ${order.id} already processed, skipping`);
        results.skipped++;
        continue;
      }
      
      // Only process paid orders
      if (order.status !== 'completed') {
        logger.info(`Order ${order.id} is not completed (status: ${order.status}), skipping`);
        results.skipped++;
        continue;
      }
      
      try {
        // Fetch detailed order info
        const orderDetail = await woocommerceService.getOrderById(order.id);
        
        // Transform order to invoice format
        const invoiceData = await dataTransformer.transformOrderToInvoice(orderDetail);
        
        // Create invoice in Merit Aktiva - DISABLED FOR UI TESTING
        // const invoiceResult = await meritService.createInvoice(invoiceData);
        
        // For UI testing, we'll just log and pretend it worked
        logger.info(`[MOCK] Would create invoice for order ${order.id} in Merit Aktiva`);
        const mockInvoiceResult = { invoiceNo: `MOCK-${Math.floor(Math.random() * 10000)}` };
        
        // Mark as processed
        processedOrders.add(order.id);
        
        logger.info(`Successfully processed order ${order.id} to invoice ${mockInvoiceResult.invoiceNo || 'unknown'}`);
        results.succeeded++;
        results.processed++;
      } catch (error) {
        logger.error(`Failed to process order ${order.id}: ${error.message}`);
        results.failed++;
        results.processed++;
        // You might want to implement retry logic here
      }
    }
    
    lastSyncTime = new Date();
    logger.info(`Order synchronization completed. Results: ${JSON.stringify(results)}`);
    return results;
  } catch (error) {
    logger.error(`Order synchronization failed: ${error.message}`);
    throw error;
  } finally {
    isSyncing = false;
  }
}

/**
 * Start the scheduler with the configuration from config file
 */
function startScheduler() {
  if (schedulerJob) {
    logger.warn('Scheduler already running, stopping previous instance');
    schedulerJob.stop();
  }
  
  const cronSchedule = config.scheduler.schedule || '0 * * * *';
  schedulerJob = scheduleSync(cronSchedule);
  return schedulerJob;
}

/**
 * Schedule automatic synchronization
 * @param {string} cronSchedule - Cron schedule expression (default: every hour)
 */
function scheduleSync(cronSchedule = '0 * * * *') {
  const job = cron.schedule(cronSchedule, async () => {
    try {
      // Calculate date range (last 24 hours by default)
      const toDate = new Date();
      const fromDate = new Date(toDate);
      fromDate.setHours(fromDate.getHours() - 24);
      
      await syncOrdersToInvoices(fromDate, toDate);
    } catch (error) {
      logger.error(`Scheduled sync failed: ${error.message}`);
    }
  });
  
  logger.info(`Order synchronization scheduled with cron pattern: ${cronSchedule}`);
  return job;
}

/**
 * Check if a sync operation is currently running
 * @returns {boolean} - True if sync is running
 */
function isSyncRunning() {
  return isSyncing;
}

/**
 * Get the timestamp of the last completed sync
 * @returns {Date|null} - Timestamp of last sync or null if no sync completed
 */
function getLastSyncTime() {
  return lastSyncTime;
}

module.exports = {
  scheduleSync,
  syncOrdersToInvoices,
  startScheduler,
  isSyncRunning,
  getLastSyncTime
}; 