/**
 * Authentication middleware
 */
const logger = require('../utils/logger');

/**
 * Authenticate API requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = (req, res, next) => {
  try {
    // Get auth header
    const authHeader = req.headers.authorization;
    
    // Check if there is an auth header
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    // Extract the token (Bearer token format)
    const token = authHeader.split(' ')[1];
    
    // Validate the token against API key
    const validApiKey = process.env.API_SECRET_KEY || 'your-secret-api-key';
    
    if (token !== validApiKey) {
      logger.warn(`Invalid API key used to access: ${req.originalUrl}`);
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // If everything is valid, proceed
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  authenticate
}; 