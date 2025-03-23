const logger = require('./logger');
// const meritService = require('../services/merit'); // Commented out for UI testing

// Mock service for UI testing
const mockMeritService = {
  findCustomerByEmail: async (email) => {
    logger.info(`[MOCK] Looking up customer with email: ${email}`);
    // 50% chance to find a customer, 50% chance to create new
    if (Math.random() > 0.5) {
      return {
        id: `cust-${Math.floor(Math.random() * 10000)}`,
        name: email.split('@')[0],
        email: email
      };
    }
    return null;
  },
  createCustomer: async (customerData) => {
    logger.info(`[MOCK] Creating customer: ${customerData.name}`);
    return {
      id: `cust-${Math.floor(Math.random() * 10000)}`,
      ...customerData
    };
  }
};

/**
 * Transform an order to Merit Aktiva invoice format
 * @param {Object} order - The order data (originally from Montonio, now uses WooCommerce data mapped to Montonio format)
 * @returns {Promise<Object>} - Merit Aktiva invoice data
 */
async function transformOrderToInvoice(order) {
  try {
    logger.info(`Transforming order ${order.uuid} to invoice format`);
    
    // Check if customer exists in Merit or create/find one
    let customer = await findOrCreateCustomer(order);
    
    // Format invoice lines from order line items
    const invoiceLines = formatInvoiceLines(order.items || []);
    
    // Calculate due date (typically 14 days from order date)
    const orderDate = new Date(order.createdAt);
    const dueDate = new Date(orderDate);
    dueDate.setDate(dueDate.getDate() + 14);
    
    // Transform order data to Merit invoice format
    const invoice = {
      // Invoice header data
      customer: customer,
      documentDate: formatDate(orderDate),
      dueDate: formatDate(dueDate),
      reference: order.uuid,
      invoiceNumber: order.merchantReference,
      currencyCode: order.currency,
      
      // Invoice line items
      rows: invoiceLines,
      
      // Payment information
      paymentMethod: mapPaymentMethod(order.paymentMethodType),
      isPaid: order.paymentStatus === 'PAID',
      paidDate: order.paymentStatus === 'PAID' ? formatDate(orderDate) : null,
      
      // Additional information
      notes: `Order from WooCommerce. Order ID: ${order.uuid}`,
      
      // Any other fields required by Merit Aktiva API
    };
    
    logger.info(`Successfully transformed order ${order.uuid} to invoice format`);
    return invoice;
  } catch (error) {
    logger.error(`Error transforming order to invoice: ${error.message}`);
    throw error;
  }
}

/**
 * Find or create a customer in Merit Aktiva
 * @param {Object} order - Order containing customer information
 * @returns {Promise<Object>} - Merit Aktiva customer data
 */
async function findOrCreateCustomer(order) {
  try {
    // Attempt to find customer by email
    const email = order.customerEmail || order.billingEmail;
    if (!email) {
      throw new Error('Order does not contain customer email');
    }
    
    // Using mock service for UI testing
    let customer = await mockMeritService.findCustomerByEmail(email);
    
    // If customer doesn't exist, create a new one
    if (!customer) {
      logger.info(`Customer with email ${email} not found, creating new customer`);
      
      const newCustomer = {
        name: order.customerFullName || '',
        email: email,
        regNumber: '', // Business ID if available
        vatNumber: '', // VAT number if available
        address: formatAddress(order.billingAddress),
        phoneNumber: order.billingPhoneNumber || '',
        // Additional customer fields required by Merit Aktiva
      };
      
      // Using mock service for UI testing
      customer = await mockMeritService.createCustomer(newCustomer);
      logger.info(`Created new customer with ID: ${customer.id}`);
    } else {
      logger.info(`Found existing customer with ID: ${customer.id}`);
    }
    
    return customer;
  } catch (error) {
    logger.error(`Error finding/creating customer: ${error.message}`);
    throw error;
  }
}

/**
 * Format invoice lines from order line items
 * @param {Array} lineItems - Order line items
 * @returns {Array} - Merit Aktiva invoice lines
 */
function formatInvoiceLines(lineItems) {
  if (!lineItems || !Array.isArray(lineItems)) {
    logger.warn('No line items found in order or invalid format');
    return [];
  }
  
  return lineItems.map(item => {
    // In WooCommerce format (mapped to Montonio-compatible format)
    // we might have different field names
    const priceWithoutTax = item.unitPrice || parseFloat(item.price) || 0;
    const totalWithoutTax = item.totalAmount || parseFloat(item.total) || 0;
    const taxAmount = item.taxAmount || parseFloat(item.total_tax) || 0;
    const totalWithTax = totalWithoutTax + taxAmount;
    
    // Extract or calculate VAT rate
    const vatRate = item.taxRate || calculateVatRate(totalWithTax, totalWithoutTax);
    
    return {
      description: item.name,
      quantity: item.quantity || 1,
      price: priceWithoutTax,
      vatCode: mapVatRate(vatRate), // Map VAT rate to Merit Aktiva VAT code
      unit: item.unit || 'pc',
      productCode: item.sku || '',
      // Additional line item fields required by Merit Aktiva
    };
  });
}

/**
 * Calculate VAT rate from prices with and without tax
 * @param {number} priceWithTax - Price including tax
 * @param {number} priceWithoutTax - Price excluding tax
 * @returns {number} - VAT rate as percentage
 */
function calculateVatRate(priceWithTax, priceWithoutTax) {
  if (!priceWithTax || !priceWithoutTax || priceWithoutTax === 0) {
    // Default to 20% if we can't calculate
    return 20;
  }
  
  const vatRatio = (priceWithTax / priceWithoutTax) - 1;
  const vatPercentage = Math.round(vatRatio * 100);
  
  // Common VAT rates in Estonia: 0%, 9%, 20%, 22%
  if (vatPercentage <= 0) return 0;
  if (vatPercentage <= 10) return 9;
  if (vatPercentage <= 21) return 20;
  return 22;
}

/**
 * Map VAT rate to Merit Aktiva VAT code
 * @param {number} vatRate - VAT rate percentage
 * @returns {string} - Merit Aktiva VAT code
 */
function mapVatRate(vatRate) {
  // This mapping depends on how VAT codes are configured in Merit Aktiva
  // These are examples and should be adjusted based on actual configuration
  switch (vatRate) {
    case 0: return '0%';
    case 9: return '9%';
    case 22: return '22%';
    case 20:
    default: return '20%';
  }
}

/**
 * Map payment method to Merit Aktiva payment method
 * @param {string} paymentMethod - Payment method
 * @returns {string} - Merit Aktiva payment method
 */
function mapPaymentMethod(paymentMethod) {
  // This mapping depends on how payment methods are configured in Merit Aktiva
  // These are examples and should be adjusted based on actual configuration
  if (!paymentMethod) return 'BankTransfer';
  
  const method = paymentMethod.toLowerCase();
  
  if (method.includes('bank') || method.includes('transfer')) return 'BankTransfer';
  if (method.includes('card') || method.includes('credit') || method.includes('visa') || method.includes('mastercard')) return 'CreditCard';
  if (method.includes('paypal')) return 'PayPal';
  if (method.includes('cash')) return 'Cash';
  
  // Default
  return 'BankTransfer';
}

/**
 * Format address object to string
 * @param {Object} address - Address object
 * @returns {string} - Formatted address
 */
function formatAddress(address) {
  if (!address) return '';
  
  const parts = [];
  if (address.streetAddress || address.address_1) parts.push(address.streetAddress || address.address_1);
  if (address.city) parts.push(address.city);
  if (address.postalCode || address.postcode) parts.push(address.postalCode || address.postcode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
}

/**
 * Format date to YYYY-MM-DD format
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

module.exports = {
  transformOrderToInvoice
}; 