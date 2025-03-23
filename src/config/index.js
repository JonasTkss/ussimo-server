require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  montonio: {
    apiUrl: process.env.MONTONIO_API_URL,
    apiKey: process.env.MONTONIO_API_KEY
  },
  
  merit: {
    apiUrl: process.env.MERIT_API_URL,
    apiKey: process.env.MERIT_API_KEY
  },
  
  security: {
    manualTriggerKey: process.env.MANUAL_TRIGGER_KEY
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
}; 