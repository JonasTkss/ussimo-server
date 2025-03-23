/**
 * Analytics API Routes
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analytics');
const logger = require('../utils/logger');

/**
 * @route   GET /api/analytics/summary
 * @desc    Get summary analytics for orders
 * @access  Public
 */
router.get('/summary', async (req, res) => {
  try {
    const { period, status } = req.query;
    
    const summary = await analyticsService.getOrdersSummary({
      period,
      status
    });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error in /api/analytics/summary:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch analytics summary' 
    });
  }
});

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue data for charts
 * @access  Public
 */
router.get('/revenue', async (req, res) => {
  try {
    const { period, status } = req.query;
    
    const chartData = await analyticsService.getRevenueChartData({
      period,
      status
    });
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    logger.error('Error in /api/analytics/revenue:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch revenue chart data' 
    });
  }
});

/**
 * @route   GET /api/analytics/popular-products
 * @desc    Get popular products data
 * @access  Public
 */
router.get('/popular-products', async (req, res) => {
  try {
    const { period, limit } = req.query;
    
    const popularProducts = await analyticsService.getPopularProducts({
      period,
      limit: parseInt(limit) || undefined
    });
    
    res.json({
      success: true,
      data: popularProducts
    });
  } catch (error) {
    logger.error('Error in /api/analytics/popular-products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch popular products data' 
    });
  }
});

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get combined dashboard analytics
 * @access  Public
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Fetch summary, revenue chart, and popular products in parallel
    const [summary, revenueChart, popularProducts] = await Promise.all([
      analyticsService.getOrdersSummary({ period }),
      analyticsService.getRevenueChartData({ period }),
      analyticsService.getPopularProducts({ period, limit: 5 })
    ]);
    
    // Combine results
    const dashboard = {
      summary,
      revenueChart,
      popularProducts
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error in /api/analytics/dashboard:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch dashboard analytics' 
    });
  }
});

module.exports = router; 