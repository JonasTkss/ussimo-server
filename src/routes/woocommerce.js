/**
 * WooCommerce API Routes
 */

const express = require('express');
const router = express.Router();
const woocommerceService = require('../services/woocommerce');
const meritService = require('../services/merit');
const logger = require('../utils/logger');
const config = require('../config');

// Track the auto-sync state
const autoSyncState = {
  isRunning: false,
  startOrderId: null,
  currentOrderId: null, 
  lastSyncTime: null,
  intervalId: null
};

/**
 * @route   GET /api/woocommerce/orders
 * @desc    Get WooCommerce orders with pagination and filtering
 * @access  Public
 */
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, per_page = 20, status, after, before } = req.query;
    
    const orders = await woocommerceService.getOrders({
      page: parseInt(page),
      per_page: parseInt(per_page),
      status,
      after,
      before
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Error in /api/woocommerce/orders:', error);
    res.status(500).json({ error: 'Failed to fetch WooCommerce orders' });
  }
});

/**
 * @route   GET /api/woocommerce/orders/:id
 * @desc    Get a single WooCommerce order by ID
 * @access  Public
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await woocommerceService.getOrderById(id);
    
    res.json(order);
  } catch (error) {
    console.error(`Error in /api/woocommerce/orders/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch WooCommerce order' });
  }
});

/**
 * @route   GET /api/woocommerce/products
 * @desc    Get WooCommerce products with pagination
 * @access  Public
 */
router.get('/products', async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    
    const products = await woocommerceService.getProducts({
      page: parseInt(page),
      per_page: parseInt(per_page)
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error in /api/woocommerce/products:', error);
    res.status(500).json({ error: 'Failed to fetch WooCommerce products' });
  }
});

/**
 * Validate WooCommerce webhook signature
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether signature is valid
 */
function validateWooCommerceWebhook(req) {
  // Check if webhook validation is enabled
  if (!config.woocommerce?.webhookSecret) {
    logger.warn('WooCommerce webhook validation is disabled - webhook secret not configured');
    return true;
  }

  try {
    const signature = req.headers['x-wc-webhook-signature'];
    if (!signature) {
      logger.warn('Missing WooCommerce webhook signature');
      return false;
    }

    // WooCommerce uses HMAC-SHA256 to sign the payload
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', config.woocommerce.webhookSecret);
    const payload = JSON.stringify(req.body);
    const calculatedSignature = hmac.update(payload).digest('base64');

    const valid = signature === calculatedSignature;
    if (!valid) {
      logger.warn('Invalid WooCommerce webhook signature');
    }
    return valid;
  } catch (error) {
    logger.error(`Error validating webhook signature: ${error.message}`);
    return false;
  }
}

/**
 * Handle WooCommerce order webhook
 * Create a Merit invoice from a WooCommerce order
 */
router.post('/webhook/order', async (req, res) => {
  try {
    logger.info('Received WooCommerce order webhook');
    
    // Validate webhook signature if needed
    if (!validateWooCommerceWebhook(req)) {
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }
    
    const order = req.body;
    
    // Check if this is a valid order with the right status
    if (!order || !order.id) {
      return res.status(400).json({ success: false, error: 'Invalid order data' });
    }
    
    // Only process orders with specific statuses (completed, processing)
    const validStatuses = ['completed', 'processing'];
    if (!validStatuses.includes(order.status)) {
      logger.info(`Skipping order #${order.id} with status "${order.status}"`);
      return res.status(200).json({ 
        success: true, 
        message: `Skipped order with status "${order.status}"` 
      });
    }
    
    // Create Merit invoice from WooCommerce order
    const invoice = await meritService.createInvoiceFromWooCommerceOrder(order);
    
    logger.info(`Created Merit invoice for WooCommerce order #${order.id}: Invoice number ${invoice.InvoiceNo || 'unknown'}`);
    
    return res.status(200).json({
      success: true,
      message: `Invoice created successfully with number ${invoice.InvoiceNo || 'unknown'}`,
      invoice
    });
  } catch (error) {
    logger.error(`Error processing WooCommerce webhook: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Manually create a Merit invoice from a WooCommerce order
 */
router.post('/orders/:orderId/create-invoice', async (req, res) => {
  try {
    const { orderId } = req.params;
    logger.info(`Manually creating invoice for WooCommerce order #${orderId}`);
    
    // Check if order data was provided in the request body
    if (req.body && req.body.order) {
      logger.info(`Using order data from request body for order #${orderId}`);
      const order = req.body.order;
      
      // Validate the essential order data
      if (!order.id || !order.billing || !order.line_items) {
        logger.error('Invalid order data provided in request body');
        return res.status(400).json({
          success: false,
          error: 'Invalid order data. Required fields: id, billing, line_items'
        });
      }
      
      // Create Merit invoice using the provided order data
      logger.info(`Creating Merit invoice for WooCommerce order #${orderId} from provided data`);
      const invoice = await meritService.createInvoiceFromWooCommerceOrder(order);
      
      logger.info(`Successfully created Merit invoice for WooCommerce order #${orderId}: Invoice number ${invoice.InvoiceNo || 'unknown'}`);
      
      return res.status(200).json({
        success: true,
        message: `Invoice created successfully with number ${invoice.InvoiceNo || 'unknown'}`,
        invoice
      });
    }
    
    // If no order data was provided, try to fetch from WooCommerce API
    logger.info(`No order data provided in request body, attempting to fetch from WooCommerce API`);
    
    // Check if we have woocommerce API configured
    logger.info(`WooCommerce config: URL=${config.woocommerce?.apiUrl}, Key=${config.woocommerce?.apiKey ? 'Set' : 'Not Set'}, Secret=${config.woocommerce?.apiSecret ? 'Set' : 'Not Set'}`);
    
    if (!config.woocommerce?.apiUrl || !config.woocommerce?.apiKey || !config.woocommerce?.apiSecret) {
      logger.error(`WooCommerce API not configured. URL: ${config.woocommerce?.apiUrl}, Key: ${config.woocommerce?.apiKey ? 'Present' : 'Missing'}, Secret: ${config.woocommerce?.apiSecret ? 'Present' : 'Missing'}`);
      return res.status(500).json({ 
        success: false, 
        error: 'WooCommerce API not configured. Please provide order data in the request body.' 
      });
    }
    
    // Get the order using the woocommerceService
    logger.info(`Fetching WooCommerce order #${orderId}`);
    const order = await woocommerceService.getOrderById(orderId);
    
    if (!order || !order.id) {
      logger.error(`Order #${orderId} not found in WooCommerce`);
      return res.status(404).json({ 
        success: false, 
        error: `Order #${orderId} not found`
      });
    }
    
    // Create Merit invoice
    logger.info(`Creating Merit invoice for WooCommerce order #${orderId}`);
    const invoice = await meritService.createInvoiceFromWooCommerceOrder(order);
    
    logger.info(`Successfully created Merit invoice for WooCommerce order #${orderId}: Invoice number ${invoice.InvoiceNo || 'unknown'}`);
    
    return res.status(200).json({
      success: true,
      message: `Invoice created successfully with number ${invoice.InvoiceNo || 'unknown'}`,
      invoice
    });
  } catch (error) {
    logger.error(`Error creating invoice for order: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    if (error.response) {
      logger.error(`API response data: ${JSON.stringify(error.response.data)}`);
    }
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Start automatic creation of Merit invoices from WooCommerce orders
 * @route POST /api/woocommerce/auto-sync/start
 */
router.post('/auto-sync/start', async (req, res) => {
  try {
    const { startOrderId } = req.body;
    
    if (!startOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: startOrderId'
      });
    }
    
    // Check if auto-sync is already running
    if (autoSyncState.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Auto-sync is already running',
        syncState: autoSyncState
      });
    }
    
    // Check if WooCommerce API is configured
    if (!config.woocommerce?.apiUrl || !config.woocommerce?.apiKey || !config.woocommerce?.apiSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'WooCommerce API not configured.' 
      });
    }
    
    // Update state
    autoSyncState.isRunning = true;
    autoSyncState.startOrderId = startOrderId;
    autoSyncState.currentOrderId = startOrderId;
    autoSyncState.lastSyncTime = new Date();
    
    // Start initial sync in background and respond to client immediately
    res.status(200).json({
      success: true,
      message: `Auto-sync started from order ID ${startOrderId}`,
      syncState: autoSyncState
    });
    
    // Start the initial bulk sync process in the background
    processBulkOrders().then(() => {
      // After bulk processing is complete, set up interval for periodic checking
      autoSyncState.intervalId = setInterval(processNewOrders, 30 * 1000);
      logger.info('Initial bulk sync completed. Now checking for new orders every 30 seconds.');
    }).catch(err => {
      logger.error(`Error in bulk processing: ${err.message}`);
      // Even if bulk processing fails, still set up interval for future checks
      autoSyncState.intervalId = setInterval(processNewOrders, 30 * 1000);
    });
    
    /**
     * Process bulk orders from the starting ID up
     */
    async function processBulkOrders() {
      logger.info(`Starting bulk sync from order ID ${autoSyncState.startOrderId}`);
      
      // Get all existing Merit invoices to check for duplicates
      const meritInvoices = await fetchMeritInvoices();
      const existingOrderIds = extractOrderIdsFromInvoices(meritInvoices);
      logger.info(`Found ${existingOrderIds.size} existing Merit invoices to avoid duplicates`);
      
      let page = 1;
      let hasMoreOrders = true;
      let allFilteredOrders = [];
      const maxOrdersToProcess = 1000; // Set a safety limit
      
      // First, collect all orders that match our criteria
      // Fetch using 'desc' order so we get the newest orders first where our starting ID is likely to be found
      while (hasMoreOrders && allFilteredOrders.length < maxOrdersToProcess) {
        logger.info(`Fetching WooCommerce orders batch page ${page} in descending order...`);
        
        try {
          // Fetch a batch of orders using the woocommerceService
          const ordersResponse = await woocommerceService.getOrders({
            page: page,
            per_page: 100,
            order: 'desc' // Get newest orders first
          });
          
          const orders = ordersResponse.orders;
          
          if (!orders || orders.length === 0) {
            hasMoreOrders = false;
            logger.info('No more orders to fetch.');
            break;
          }
          
          // Filter orders based on the starting ID and exclude cancelled orders
          const filteredOrders = orders.filter(order => 
            parseInt(order.id) >= parseInt(autoSyncState.startOrderId) && 
            order.status !== 'cancelled'
          );
          allFilteredOrders = [...allFilteredOrders, ...filteredOrders];
          
          logger.info(`Found ${filteredOrders.length} valid orders matching criteria on page ${page}`);
          
          // If we got a full page of orders, there might be more
          hasMoreOrders = orders.length === 100;
          page++;
          
          // If we have enough orders or we've gone through enough pages, stop fetching
          if (allFilteredOrders.length >= maxOrdersToProcess || page > 10) {
            logger.info(`Reached collection limit. Stopping order fetch.`);
            hasMoreOrders = false;
          }
          
        } catch (error) {
          logger.error(`Error fetching WooCommerce orders (page ${page}): ${error.message}`);
          // If we encounter an error, stop processing
          hasMoreOrders = false;
        }
      }
      
      // Sort all collected orders by ID in ascending order
      allFilteredOrders.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      
      logger.info(`Collected ${allFilteredOrders.length} valid orders to process`);
      logger.info(`Order ID range: ${allFilteredOrders.length > 0 ? `${allFilteredOrders[0].id} to ${allFilteredOrders[allFilteredOrders.length-1].id}` : 'none'}`);
      
      // Process each order in ascending order
      for (const order of allFilteredOrders) {
        try {
          // Skip if we've already created an invoice for this order
          if (existingOrderIds.has(order.id.toString())) {
            logger.info(`Order #${order.id} already has a Merit invoice. Skipping.`);
            continue;
          }
          
          // Process the order if it doesn't have an invoice yet
          logger.info(`Creating Merit invoice for WooCommerce order #${order.id}`);
          const invoice = await meritService.createInvoiceFromWooCommerceOrder(order);
          logger.info(`Successfully created Merit invoice for order #${order.id}: Invoice number ${invoice.InvoiceNo || 'unknown'}`);
          
          // Update current order ID in state
          autoSyncState.currentOrderId = order.id;
          
          // Add to our local cache of processed orders
          existingOrderIds.add(order.id.toString());
          
          // Short delay to avoid overwhelming the Merit API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error processing order #${order.id}: ${error.message}`);
          // Continue to the next order
        }
      }
      
      // Update the last sync time
      autoSyncState.lastSyncTime = new Date();
      logger.info(`Bulk sync completed at ${autoSyncState.lastSyncTime.toISOString()}`);
    }
    
    /**
     * Process new orders that have been created since the last sync
     */
    async function processNewOrders() {
      try {
        logger.info(`Checking for new orders since ${autoSyncState.lastSyncTime.toISOString()}`);
        
        // Always fetch latest Merit invoices first to ensure we have up-to-date data
        const meritInvoices = await fetchMeritInvoices();
        const existingOrderIds = extractOrderIdsFromInvoices(meritInvoices);
        logger.info(`Fetched ${existingOrderIds.size} existing Merit invoices to check for duplicates`);
        
        // Fetch orders created after the last sync time
        const ordersResponse = await woocommerceService.getOrders({
          after: autoSyncState.lastSyncTime.toISOString(),
          per_page: 100,
          order: 'asc'
        });
        
        const orders = ordersResponse.orders;
        
        if (!orders || orders.length === 0) {
          logger.info('No new orders found. Will check again in 30 seconds.');
          autoSyncState.lastSyncTime = new Date();
          return;
        }
        
        // Filter out cancelled orders
        const validOrders = orders.filter(order => order.status !== 'cancelled');
        logger.info(`Found ${validOrders.length} valid new order(s) to process (${orders.length - validOrders.length} cancelled orders skipped)`);
        
        // Process orders in sequence
        for (const order of validOrders) {
          try {
            // Skip if we've already created an invoice for this order
            if (existingOrderIds.has(order.id.toString())) {
              logger.info(`Order #${order.id} already has a Merit invoice. Skipping.`);
              continue;
            }
            
            // Process the order if it doesn't have an invoice yet
            logger.info(`Creating Merit invoice for WooCommerce order #${order.id}`);
            const invoice = await meritService.createInvoiceFromWooCommerceOrder(order);
            logger.info(`Successfully created Merit invoice for order #${order.id}: Invoice number ${invoice.InvoiceNo || 'unknown'}`);
            
            // Update current order ID in state
            autoSyncState.currentOrderId = order.id;
            
            // Add to our local cache of processed orders
            existingOrderIds.add(order.id.toString());
            
            // Short delay to avoid overwhelming the Merit API
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            logger.error(`Error processing order #${order.id}: ${error.message}`);
            // Continue to the next order
          }
        }
        
        // Update the last sync time
        autoSyncState.lastSyncTime = new Date();
        logger.info(`Periodic sync completed at ${autoSyncState.lastSyncTime.toISOString()}`);
        
      } catch (error) {
        logger.error(`Error in periodic sync: ${error.message}`);
      }
    }
    
    /**
     * Fetch recent invoices from Merit
     */
    async function fetchMeritInvoices() {
      // Look back 3 months
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      
      const endDate = new Date();
      
      // Format dates as YYYYMMDD for Merit API
      const startDateFormat = startDate.toISOString().slice(0, 10).replace(/-/g, '');
      const endDateFormat = endDate.toISOString().slice(0, 10).replace(/-/g, '');
      
      const options = {
        startDate: startDateFormat,
        endDate: endDateFormat,
        unpaidOnly: false,
        limit: 1000 // Get more invoices to reduce API calls
      };
      
      return await meritService.getInvoices(options);
    }
    
    /**
     * Extract order IDs from Merit invoices
     */
    function extractOrderIdsFromInvoices(meritInvoices) {
      const orderIds = new Set();
      
      if (meritInvoices && meritInvoices.invoices && meritInvoices.invoices.length > 0) {
        meritInvoices.invoices.forEach(invoice => {
          const extractedOrderNumber = meritService.extractOrderNumberFromHComment(invoice.HComment);
          if (extractedOrderNumber) {
            orderIds.add(extractedOrderNumber);
          }
        });
      }
      
      return orderIds;
    }
    
  } catch (error) {
    logger.error(`Error starting auto-sync: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop automatic creation of Merit invoices
 * @route POST /api/woocommerce/auto-sync/stop
 */
router.post('/auto-sync/stop', (req, res) => {
  if (!autoSyncState.isRunning) {
    return res.status(400).json({
      success: false,
      error: 'Auto-sync is not running'
    });
  }
  
  // Clear the interval
  if (autoSyncState.intervalId) {
    clearInterval(autoSyncState.intervalId);
    autoSyncState.intervalId = null;
  }
  
  // Update state
  autoSyncState.isRunning = false;
  
  return res.status(200).json({
    success: true,
    message: 'Auto-sync stopped',
    syncState: autoSyncState
  });
});

/**
 * Get the current status of auto-sync
 * @route GET /api/woocommerce/auto-sync/status
 */
router.get('/auto-sync/status', (req, res) => {
  return res.status(200).json({
    success: true,
    syncState: {
      isRunning: autoSyncState.isRunning,
      startOrderId: autoSyncState.startOrderId,
      currentOrderId: autoSyncState.currentOrderId,
      lastSyncTime: autoSyncState.lastSyncTime
    }
  });
});

module.exports = router; 