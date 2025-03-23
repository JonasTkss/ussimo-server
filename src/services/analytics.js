/**
 * Analytics Service
 * This service provides methods to process WooCommerce data into analytics
 */

const woocommerceService = require('./woocommerce');
const logger = require('../utils/logger');

/**
 * Get summary analytics for orders
 * @param {Object} options - Query parameters
 * @param {string} options.period - Time period (today, 7d, 30d, thisYear, allTime)
 * @param {string} options.status - Order status to filter (optional)
 * @returns {Promise<Object>} - Analytics summary
 */
async function getOrdersSummary(options = {}) {
  try {
    const { period = '30d', status } = options;
    logger.info(`Getting orders summary for period: ${period}`);
    
    // Format parameters for WC API based on period
    let reportParams = {};
    
    switch(period) {
      case 'today':
        reportParams.period = 'today';
        break;
      case '7d':
        reportParams.period = 'week';
        break;
      case '30d':
        reportParams.period = 'month';
        break;
      case 'thisYear':
        reportParams.period = 'year';
        break;
      case 'allTime':
        // Explicitly don't set any date parameters to get all data
        break;
      default:
        reportParams.period = 'month'; // Default to 30 days/month
    }
    
    logger.info(`Analytics request params: ${JSON.stringify(reportParams)}`);
    
    // Fetch sales report and order totals in parallel
    const [salesReport, ordersTotals] = await Promise.all([
      woocommerceService.getSalesReport(reportParams),
      woocommerceService.getOrdersTotals()
    ]);
    
    if (!salesReport || !Array.isArray(salesReport) || salesReport.length === 0) {
      return {
        totalOrders: 0,
        totalAmount: 0,
        averageOrderValue: 0,
        ordersProcessed: 0,
        pendingOrders: 0
      };
    }
    
    const report = salesReport[0];
    
    // Calculate processed orders using the orders totals report
    const processedOrders = ordersTotals
      .filter(status => ['completed', 'processing'].includes(status.slug))
      .reduce((total, status) => total + status.total, 0);
    
    const pendingOrders = ordersTotals
      .filter(status => ['pending', 'on-hold'].includes(status.slug))
      .reduce((total, status) => total + status.total, 0);
    
    return {
      totalOrders: report.total_orders || 0,
      totalAmount: parseFloat(report.total_sales || 0),
      averageOrderValue: parseFloat(report.average_sales || 0),
      ordersProcessed: processedOrders,
      pendingOrders: pendingOrders
    };
  } catch (error) {
    logger.error('Error getting orders summary:', error);
    throw error;
  }
}

/**
 * Get revenue data for charts
 * @param {Object} options - Query parameters
 * @param {string} options.period - Time period (today, 7d, 30d, thisYear, allTime)
 * @param {string} options.status - Order status to filter (optional) 
 * @returns {Promise<Object>} - Chart data for revenue
 */
async function getRevenueChartData(options = {}) {
  try {
    const { period = '30d', status } = options;
    logger.info(`Getting revenue chart data for period: ${period}`);
    
    // Format parameters for WC API based on period
    let reportParams = {};
    
    switch(period) {
      case 'today':
        reportParams.period = 'today';
        break;
      case '7d':
        reportParams.period = 'week';
        break;
      case '30d':
        reportParams.period = 'month';
        break;
      case 'thisYear':
        reportParams.period = 'year';
        break;
      case 'allTime':
        // Explicitly don't set any date parameters to get all data
        break;
      default:
        reportParams.period = 'month'; // Default to 30 days/month
    }
    
    logger.info(`Revenue chart request params: ${JSON.stringify(reportParams)}`);
    
    const salesReport = await woocommerceService.getSalesReport(reportParams);
    
    if (!salesReport || !Array.isArray(salesReport) || salesReport.length === 0 || !salesReport[0].totals) {
      return [];
    }
    
    const report = salesReport[0];
    const { totals } = report;
    
    // Convert the totals object to an array of data points
    const chartData = Object.entries(totals).map(([date, data]) => ({
      date,
      value: parseFloat(data.sales || 0)
    }));
    
    // Sort by date
    chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return chartData;
  } catch (error) {
    logger.error('Error getting revenue chart data:', error);
    throw error;
  }
}

/**
 * Get popular products analytics
 * @param {Object} options - Query parameters
 * @param {string} options.period - Time period (today, 7d, 30d, thisYear, allTime)
 * @param {number} options.limit - Number of top products to return
 * @returns {Promise<Object>} - Popular products data
 */
async function getPopularProducts(options = {}) {
  try {
    const { period = '30d', limit = 10 } = options;
    logger.info(`Getting popular products for period: ${period}`);
    
    // Format parameters for WC API based on period
    let reportParams = {
      limit
    };
    
    switch(period) {
      case 'today':
        reportParams.period = 'today';
        break;
      case '7d':
        reportParams.period = 'week';
        break;
      case '30d':
        reportParams.period = 'month';
        break;
      case 'thisYear':
        reportParams.period = 'year';
        break;
      case 'allTime':
        // Explicitly don't set any date parameters to get all data
        break;
      default:
        reportParams.period = 'month'; // Default to 30 days/month
    }
    
    logger.info(`Popular products request params: ${JSON.stringify(reportParams)}`);
    
    const topSellers = await woocommerceService.getTopSellersReport(reportParams);
    
    if (!topSellers || !Array.isArray(topSellers)) {
      return [];
    }
    
    // For the top sellers, fetch product details to get pricing information
    // Limit to 5 products to avoid too many API calls
    const productDetailsPromises = topSellers.slice(0, 5).map(async (product) => {
      try {
        // Fetch product details to get price information
        const productDetails = await woocommerceService.getProductDetails(product.product_id);
        
        // Calculate approximate revenue
        const price = parseFloat(productDetails.price || 0);
        const revenue = price * parseInt(product.quantity, 10);
        
        return {
          id: product.product_id,
          name: product.title || productDetails.name,
          quantity: parseInt(product.quantity, 10),
          revenue: revenue,
          // Add image URL if available
          imageUrl: productDetails.images && productDetails.images.length > 0 
            ? productDetails.images[0].src 
            : undefined
        };
      } catch (error) {
        // If we can't get product details, return with basic info and null revenue
        logger.error(`Error fetching details for product ${product.product_id}:`, error.message);
        return {
          id: product.product_id,
          name: product.title,
          quantity: parseInt(product.quantity, 10),
          revenue: null
        };
      }
    });
    
    // Process remaining products without fetching details
    const remainingProducts = topSellers.slice(5).map(product => ({
      id: product.product_id,
      name: product.title,
      quantity: parseInt(product.quantity, 10),
      revenue: null
    }));
    
    // Wait for all product detail requests to complete
    const productsWithDetails = await Promise.all(productDetailsPromises);
    
    // Combine products with and without details
    return [...productsWithDetails, ...remainingProducts];
  } catch (error) {
    logger.error('Error getting popular products:', error);
    throw error;
  }
}

module.exports = {
  getOrdersSummary,
  getRevenueChartData,
  getPopularProducts
}; 