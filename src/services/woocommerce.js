/**
 * WooCommerce Service
 * This service provides methods to interact with the WooCommerce API
 */

const WooCommerceAPI = require('woocommerce-api');
const logger = require('../utils/logger');

// Create WooCommerce API client
const WooCommerce = new WooCommerceAPI({
  url: process.env.WOOCOMMERCE_URL || 'https://ussimo.eu',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || 'ck_5b4d129a229ccc034e57cd97783b6fd3c5af2c14',
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || 'cs_19659dcf76a920c50bd04c928d8bfbf407442860',
  wpAPI: true,
  version: 'wc/v3',
  queryStringAuth: true // Force Basic Authentication as query string for non-HTTPS sites
});

/**
 * Fetch orders from WooCommerce
 * @param {Object} options - Query parameters
 * @param {number} options.page - Page number
 * @param {number} options.per_page - Items per page
 * @param {string} options.status - Order status filter
 * @param {string} options.after - ISO8601 date string for orders after date
 * @param {string} options.before - ISO8601 date string for orders before date
 * @returns {Promise<Array>} - Array of orders
 */
async function getOrders(options = {}) {
  try {
    // Construct the query string from options
    const queryParams = new URLSearchParams();
    
    if (options.page) queryParams.append('page', options.page);
    if (options.per_page) queryParams.append('per_page', options.per_page);
    if (options.status) queryParams.append('status', options.status);
    if (options.after) queryParams.append('after', options.after);
    if (options.before) queryParams.append('before', options.before);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `orders?${queryString}` : 'orders';
    
    logger.info(`Fetching WooCommerce orders with params: ${queryString}`);
    
    // Use the promisified version of get
    const result = await WooCommerce.getAsync(endpoint);
    const response = JSON.parse(result.toJSON().body);
    
    return {
      orders: response,
      total: result.headers['x-wp-total'],
      totalPages: result.headers['x-wp-totalpages']
    };
  } catch (error) {
    logger.error('Error fetching WooCommerce orders:', error);
    throw error;
  }
}

/**
 * Fetch a single order by ID
 * @param {number} orderId - WooCommerce order ID
 * @returns {Promise<Object>} - Order object
 */
async function getOrderById(orderId) {
  try {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    
    logger.info(`Fetching WooCommerce order: ${orderId}`);
    
    const result = await WooCommerce.getAsync(`orders/${orderId}`);
    return JSON.parse(result.toJSON().body);
  } catch (error) {
    logger.error(`Error fetching WooCommerce order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Fetch products from WooCommerce
 * @param {Object} options - Query parameters
 * @param {number} options.page - Page number
 * @param {number} options.per_page - Items per page
 * @returns {Promise<Array>} - Array of products
 */
async function getProducts(options = {}) {
  try {
    // Construct the query string from options
    const queryParams = new URLSearchParams();
    
    if (options.page) queryParams.append('page', options.page);
    if (options.per_page) queryParams.append('per_page', options.per_page);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `products?${queryString}` : 'products';
    
    logger.info(`Fetching WooCommerce products with params: ${queryString}`);
    
    const result = await WooCommerce.getAsync(endpoint);
    const response = JSON.parse(result.toJSON().body);
    
    return {
      products: response,
      total: result.headers['x-wp-total'],
      totalPages: result.headers['x-wp-totalpages']
    };
  } catch (error) {
    logger.error('Error fetching WooCommerce products:', error);
    throw error;
  }
}

/**
 * Fetch customers from WooCommerce
 * @param {Object} options - Query parameters
 * @param {number} options.page - Page number
 * @param {number} options.per_page - Items per page
 * @returns {Promise<Array>} - Array of customers
 */
async function getCustomers(options = {}) {
  try {
    // Construct the query string from options
    const queryParams = new URLSearchParams();
    
    if (options.page) queryParams.append('page', options.page);
    if (options.per_page) queryParams.append('per_page', options.per_page);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `customers?${queryString}` : 'customers';
    
    const result = await WooCommerce.getAsync(endpoint);
    const response = JSON.parse(result.toJSON().body);
    
    return {
      customers: response,
      total: result.headers['x-wp-total'],
      totalPages: result.headers['x-wp-totalpages']
    };
  } catch (error) {
    console.error('Error fetching WooCommerce customers:', error);
    throw error;
  }
}

/**
 * Fetch sales reports
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Sales report data
 */
async function getSalesReport(params = {}) {
  try {
    // Construct the query string from options
    const queryParams = new URLSearchParams();
    
    if (params.date_min) queryParams.append('date_min', params.date_min);
    if (params.date_max) queryParams.append('date_max', params.date_max);
    if (params.period) queryParams.append('period', params.period);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `reports/sales?${queryString}` : 'reports/sales';
    
    logger.info(`Fetching WooCommerce sales report with params: ${JSON.stringify(params)}`);
    
    const result = await WooCommerce.getAsync(endpoint);
    return JSON.parse(result.toJSON().body);
  } catch (error) {
    logger.error('Error fetching WooCommerce sales report:', error.message);
    throw error;
  }
}

/**
 * Fetch top sellers report
 * @param {Object} params - Query parameters (period, date_min, date_max)
 * @returns {Promise<Object>} - Top sellers report data
 */
async function getTopSellersReport(params = {}) {
  try {
    // Construct the query string from options
    const queryParams = new URLSearchParams();
    
    if (params.date_min) queryParams.append('date_min', params.date_min);
    if (params.date_max) queryParams.append('date_max', params.date_max);
    if (params.period) queryParams.append('period', params.period);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `reports/top_sellers?${queryString}` : 'reports/top_sellers';
    
    logger.info(`Fetching WooCommerce top sellers report with params: ${JSON.stringify(params)}`);
    
    const result = await WooCommerce.getAsync(endpoint);
    return JSON.parse(result.toJSON().body);
  } catch (error) {
    logger.error('Error fetching WooCommerce top sellers report:', error.message);
    throw error;
  }
}

/**
 * Fetch orders totals report
 * @returns {Promise<Object>} - Orders totals data
 */
async function getOrdersTotals() {
  try {
    logger.info('Fetching WooCommerce orders totals');
    
    const result = await WooCommerce.getAsync('reports/orders/totals');
    return JSON.parse(result.toJSON().body);
  } catch (error) {
    logger.error('Error fetching WooCommerce orders totals:', error.message);
    throw error;
  }
}

/**
 * Fetch product details
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} - Product details
 */
async function getProductDetails(productId) {
  try {
    logger.info(`Fetching WooCommerce product details for ID: ${productId}`);
    
    const result = await WooCommerce.getAsync(`products/${productId}`);
    return JSON.parse(result.toJSON().body);
  } catch (error) {
    logger.error(`Error fetching WooCommerce product details for ID ${productId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getOrders,
  getOrderById,
  getProducts,
  getCustomers,
  getSalesReport,
  getTopSellersReport,
  getOrdersTotals,
  getProductDetails
};
