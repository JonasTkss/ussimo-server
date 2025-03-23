/**
 * WooCommerce API Routes
 */

const express = require('express');
const router = express.Router();
const woocommerceService = require('../services/woocommerce');
const meritService = require('../services/merit');
const logger = require('../utils/logger');
const config = require('../config');

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
    
    // Fetch order from WooCommerce
    const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
    
    logger.info(`Initializing WooCommerce API with URL: ${config.woocommerce.apiUrl}`);
    
    const api = new WooCommerceRestApi({
      url: config.woocommerce.apiUrl,
      consumerKey: config.woocommerce.apiKey,
      consumerSecret: config.woocommerce.apiSecret,
      version: 'wc/v3'
    });
    
    // Get the order
    logger.info(`Fetching WooCommerce order #${orderId}`);
    const { data: order } = await api.get(`orders/${orderId}`);
    
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

module.exports = router; 