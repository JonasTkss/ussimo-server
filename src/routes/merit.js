const express = require('express');
const meritService = require('../services/merit');
const logger = require('../utils/logger');
const axios = require('axios');
const config = require('../config');
const crypto = require('crypto');
const router = express.Router();

/**
 * @route GET /api/merit/invoices
 * @desc Get a list of invoices from Merit Aktiva
 * @access Private
 */
router.get('/invoices', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      unpaidOnly, 
      customerName,
      page = 1,
      limit = 10
    } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate and endDate are required'
      });
    }
    
    // Parse boolean and numeric values
    const unpaidOnlyBool = unpaidOnly === 'true';
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const options = {
      startDate,
      endDate,
      unpaidOnly: unpaidOnlyBool,
      customerName,
      page: pageNum,
      limit: limitNum
    };
    
    logger.info(`Fetching invoices with options: ${JSON.stringify(options)}`);
    
    const result = await meritService.getInvoices(options);
    
    return res.json({
      success: true,
      count: result.pagination.total,
      data: result.invoices,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error.message);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch invoices from Merit Aktiva: ${error.message}`
    });
  }
});

/**
 * @route GET /api/merit/private-invoices
 * @desc Get a list of private person invoices from Merit Aktiva
 * @access Private
 */
router.get('/private-invoices', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      unpaidOnly,
      page = 1,
      limit = 10
    } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate and endDate are required'
      });
    }
    
    // Parse boolean and numeric values
    const unpaidOnlyBool = unpaidOnly === 'true';
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const options = {
      startDate,
      endDate,
      unpaidOnly: unpaidOnlyBool,
      customerName: 'Eraisik', // Specifically filter for private persons
      page: pageNum,
      limit: limitNum
    };
    
    logger.info(`Fetching private person invoices with options: ${JSON.stringify(options)}`);
    
    const result = await meritService.getInvoices(options);
    
    return res.json({
      success: true,
      count: result.pagination.total,
      data: result.invoices,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching private person invoices:', error.message);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch private person invoices from Merit Aktiva: ${error.message}`
    });
  }
});

/**
 * @route GET /api/merit/test-connection
 * @desc Test the connection to the Merit API
 * @access Private
 */
router.get('/test-connection', async (req, res) => {
  try {
    // Create a simple test payload
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Format dates as YYYYMMDD
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Use the service to make the request properly
    const payload = {
      PeriodStart: startDate,
      PeriodEnd: endDate,
      UnPaid: false
    };
    
    const result = await meritService.makeRequest('getinvoices', payload);
    
    // Return connection success with response details
    return res.json({
      success: true,
      message: 'Successfully connected to Merit API',
      dataReceived: Array.isArray(result) ? `Received ${result.length} invoices` : 'Received data (not an array)',
      sampleData: Array.isArray(result) && result.length > 0 ? result[0] : result
    });
  } catch (error) {
    logger.error('Merit API connection test failed:', error.message);
    
    // Prepare detailed error response
    const errorResponse = {
      success: false,
      error: `Merit API connection test failed: ${error.message}`
    };
    
    // Add response details if available
    if (error.response) {
      errorResponse.statusCode = error.response.status;
      errorResponse.statusText = error.response.statusText;
      errorResponse.responseData = error.response.data;
    }
    
    return res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/merit/debug
 * @desc Test different Merit API endpoints with proper authentication
 * @access Private
 */
router.get('/debug', async (req, res) => {
  // Create crypto utility function similar to the PHP example
  function generateSignature(apiId, apiKey, timestamp, jsonPayload) {
    const signable = apiId + timestamp + jsonPayload;
    const hmac = crypto.createHmac('sha256', apiKey);
    hmac.update(signable);
    return hmac.digest('base64');
  }
  
  // Prepare test data
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  // Format dates as YYYYMMDD
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');
  const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const payload = {
    PeriodStart: startDate,
    PeriodEnd: endDate,
    UnPaid: false
  };
  
  const jsonPayload = JSON.stringify(payload);
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHmmss format
  const signature = generateSignature(
    config.merit.apiId,
    config.merit.apiKey,
    timestamp,
    jsonPayload
  );
  
  // Test different endpoint versions
  const endpoints = [
    {
      name: 'API v1 getinvoices',
      url: `${config.merit.apiUrl}/api/v1/getinvoices?ApiId=${config.merit.apiId}&timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
    },
    {
      name: 'API v2 getinvoices',
      url: `${config.merit.apiUrl}/api/v2/getinvoices?ApiId=${config.merit.apiId}&timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
    },
    {
      name: 'API v2 getinvoices2',
      url: `${config.merit.apiUrl}/api/v2/getinvoices2?ApiId=${config.merit.apiId}&timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
    }
  ];
  
  const results = {
    timestamp,
    signature: signature.substring(0, 10) + '...',
    attempts: []
  };
  
  // Try each endpoint
  for (const endpoint of endpoints) {
    try {
      logger.info(`Testing endpoint: ${endpoint.name}`);
      
      const response = await axios({
        method: 'post',
        url: endpoint.url,
        headers: {
          'Content-Type': 'application/json'
        },
        data: payload
      });
      
      results.attempts.push({
        name: endpoint.name,
        success: true,
        status: response.status,
        dataCount: Array.isArray(response.data) ? response.data.length : 'Not an array',
        sampleData: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : (typeof response.data === 'object' ? 'Object response' : response.data)
      });
    } catch (error) {
      results.attempts.push({
        name: endpoint.name,
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }
  
  return res.json(results);
});

module.exports = router; 