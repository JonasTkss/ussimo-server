require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  
  montonio: {
    apiUrl: process.env.MONTONIO_API_URL || 'https://sandbox-api.montonio.com',
    apiKey: process.env.MONTONIO_API_KEY || 'demo-key'
  },
  
  merit: {
    apiUrl: process.env.MERIT_API_URL || 'https://aktiva.merit.ee',
    apiId: process.env.MERIT_API_ID || 'c113c6ed-6cd0-46b2-a9e3-6afd4179187c',
    apiKey: process.env.MERIT_API_KEY || 'GhNBsBpUVPHr9xdG+gtWemHQfcwXEi03ZkoVTXGbjUM=',
    vatRegNumber: process.env.MERIT_VAT_REG_NUMBER || '16540715',
    vatTaxId: process.env.MERIT_VAT_TAX_ID,
  },
  
  scheduler: {
    enabled: process.env.ENABLE_AUTO_SYNC === 'true',
    schedule: process.env.SYNC_SCHEDULE || '0 * * * *'  // Default: every hour
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  woocommerce: {
    apiUrl: process.env.WOOCOMMERCE_URL || process.env.WOOCOMMERCE_API_URL,
    apiKey: process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.WOOCOMMERCE_API_KEY,
    apiSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.WOOCOMMERCE_API_SECRET,
    webhookSecret: process.env.WOOCOMMERCE_WEBHOOK_SECRET
  }
}; 