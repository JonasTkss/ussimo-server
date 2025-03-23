const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

class MeritService {
  constructor() {
    // We don't need to create a client with default headers
    // because we'll be adding authentication to the URL
    logger.info(`Merit API configured with URL: ${config.merit.apiUrl}`);
  }

  /**
   * Generate signature for Merit API similar to the PHP example
   * @param {string} apiId - API ID
   * @param {string} apiKey - API Key
   * @param {string} timestamp - Timestamp in format YmdHis
   * @param {string} jsonPayload - JSON payload as string
   * @returns {string} - Base64 encoded signature
   */
  generateSignature(apiId, apiKey, timestamp, jsonPayload) {
    const signable = apiId + timestamp + jsonPayload;
    const hmac = crypto.createHmac('sha256', apiKey);
    hmac.update(signable);
    return hmac.digest('base64');
  }

  /**
   * Make a request to Merit API with proper authentication
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} - API response
   */
  async makeRequest(endpoint, payload) {
    try {
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHmmss format
      const jsonPayload = JSON.stringify(payload);
      const signature = this.generateSignature(
        config.merit.apiId,
        config.merit.apiKey,
        timestamp,
        jsonPayload
      );
      
      const url = `${config.merit.apiUrl}/api/v1/${endpoint}?ApiId=${config.merit.apiId}&timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`;
      
      logger.info(`Making API request to: ${url}`);
      
      const response = await axios({
        method: 'post',
        url: url,
        headers: {
          'Content-Type': 'application/json'
        },
        data: payload
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Merit API request failed: ${error.message}`);
      
      if (error.response) {
        logger.error(`API response status: ${error.response.status}`);
        logger.error(`API response data: ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }

  /**
   * Find customer by email in Merit Aktiva
   * @param {string} email - Customer email
   * @returns {Promise<Object|null>} - Customer data or null if not found
   */
  async findCustomerByEmail(email) {
    logger.info(`[PLACEHOLDER] This is a placeholder method for finding customer by email: ${email}`);
    // This is just a placeholder - real implementation will be added later
    return null;
  }

  /**
   * Create a new customer in Merit Aktiva
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>} - Created customer data
   */
  async createCustomer(customerData) {
    logger.info(`[PLACEHOLDER] This is a placeholder method for creating customer: ${customerData.name}`);
    // This is just a placeholder - real implementation will be added later
    return { 
      id: 'placeholder-id', 
      ...customerData 
    };
  }

  /**
   * Create an invoice in Merit Aktiva
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} - Created invoice data
   */
  async createInvoice(invoiceData) {
    try {
      logger.info(`Creating invoice in Merit Aktiva for: ${invoiceData.Customer?.Name || 'Unknown customer'}`);
      
      // Make request to sendInvoice endpoint
      const response = await this.makeRequest('sendinvoice', invoiceData);
      
      logger.info(`Invoice created successfully: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      logger.error(`Error creating invoice in Merit Aktiva: ${error.message}`);
      
      // Log the invoice data that caused the error
      logger.error(`Invoice data that caused error: InvoiceNo=${invoiceData.InvoiceNo}, Total=${invoiceData.TotalAmount}, Rows=${invoiceData.InvoiceRow.length}`);
      
      // Calculate sum of rows for debugging
      const rowsSum = invoiceData.InvoiceRow.reduce((sum, row) => {
        return sum + (parseFloat(row.Price) * parseFloat(row.Quantity));
      }, 0);
      
      logger.error(`Invoice rows total: ${rowsSum.toFixed(2)}, Invoice total: ${invoiceData.TotalAmount}`);
      
      if (error.response?.data) {
        logger.error(`API error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get the latest invoice number from Merit Aktiva and increment by 1
   * @returns {Promise<string>} - Next invoice number to use
   */
  async getNextInvoiceNumber() {
    try {
      logger.info('Fetching latest invoice number from Merit Aktiva');
      
      // Get current date and 30 days ago
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      // Format dates as YYYYMMDD
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');
      const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Make request to get recent invoices
      const payload = {
        PeriodStart: startDate,
        PeriodEnd: endDate,
        UnPaid: false
      };
      
      const invoices = await this.makeRequest('getinvoices', payload);
      
      if (!Array.isArray(invoices) || invoices.length === 0) {
        logger.warn('No recent invoices found, starting with invoice number 1000');
        return '1000';
      }
      
      // Extract all invoice numbers and find the maximum
      const invoiceNumbers = invoices
        .map(invoice => invoice.InvoiceNo)
        .filter(invoiceNo => /^\d+$/.test(invoiceNo)) // Filter for numeric invoice numbers only
        .map(invoiceNo => parseInt(invoiceNo, 10));
      
      if (invoiceNumbers.length === 0) {
        logger.warn('No numeric invoice numbers found, starting with invoice number 1000');
        return '1000';
      }
      
      const maxInvoiceNumber = Math.max(...invoiceNumbers);
      const nextInvoiceNumber = (maxInvoiceNumber + 1).toString();
      
      logger.info(`Next invoice number will be: ${nextInvoiceNumber}`);
      return nextInvoiceNumber;
    } catch (error) {
      logger.error(`Error getting next invoice number: ${error.message}`);
      // Fallback to a default pattern if there's an error
      const timestamp = Date.now().toString().slice(-6);
      return `ERR${timestamp}`;
    }
  }

  /**
   * Get product information from our catalog by SKU
   * @param {string} sku - Product SKU
   * @returns {Object} - Product information with name and unit
   */
  getProductBySKU(sku) {
    // Define our product catalog with exact SKUs, names and units
    const productCatalog = {
      '10038': { name: 'Eesti postiteenus', unit: 'tk' },
      '10037': { name: 'Eesti postiteenus', unit: 'tk' },
      '10036': { name: 'Eesti postiteenus', unit: 'tk' },
      '10035': { name: 'Eesti postiteenus', unit: 'tk' },
      '10029': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10028': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10027': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10026': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10025': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10024': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10023': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10021': { name: 'Limiidi suurendamine', unit: 'tk' },
      '10020': { name: 'Ostuarve sisestamine', unit: 'tk' },
      '10019': { name: 'Ostuarve sisestamine', unit: 'tk' },
      '10012': { name: 'Omniva pakiautomaat', unit: 'tk' },
      '10007': { name: 'Eesti postiteenus', unit: 'tk' },
      '10006': { name: 'Tarkvarateenuse aktiveerimistasu', unit: 'tk' },
      '10005': { name: 'Tarkvarateenuse aktiveerimistasu', unit: 'tk' },
      '10003': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10002': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' },
      '10001': { name: 'Tarkvarateenuse kuutasu', unit: 'kuu' }
    };

    // If SKU exists in our catalog, return the product info
    if (productCatalog[sku]) {
      return {
        sku,
        name: productCatalog[sku].name,
        unit: productCatalog[sku].unit
      };
    }

    // If SKU doesn't exist in our catalog, return a default
    logger.warn(`SKU ${sku} not found in product catalog, using default product info`);
    return {
      sku,
      name: 'Teenus',
      unit: 'tk'
    };
  }

  /**
   * Prepare invoice rows from WooCommerce order
   * @param {Object} wooOrder - WooCommerce order data
   * @returns {Array} - Array of invoice rows for Merit
   */
  prepareInvoiceRowsFromWooOrder(wooOrder) {
    const vatTaxId = this.getVATTaxId();
    const rows = [];
    
    // Product name to Merit code/description mapping - with exact product codes from Merit
    const productMapping = {
      'Toalillemuld biohuumusega': { code: '4744278011219', name: 'Toalillemuld 2, 5 l', unit: 'tk' },
      'Biohuumuse kontsentraat mahekasvatuseks': { code: '4742022540015', name: 'Biohuumuse kontsentraat mahekasvatuseks, 500ml', unit: 'tk' },
      'Biohuumuse kontsentraat lilledele': { code: '4742022540022', name: 'Biohuumuse kontsentraat Lilledele, 500ml', unit: 'tk' },
      'Ettekasvatussegu biohuumusega': { code: '4744278011011', name: 'Ettekasvatussegu biohuumusega 5 l', unit: 'tk' },
      'Rammus püsikusegu biohuumusega': { code: '4744278011110', name: 'Rammus püsikusegu biohuumusega 5, 0 l', unit: 'tk' },
      'Biohuumus 2, 5 l Ussimo': { code: '4744278011318', name: 'Biohuumus 2, 5 l Ussimo', unit: 'tk' },
      'Biohuumus 5 l Ussimo': { code: '4744278010014', name: 'Biohuumus 5 l Ussimo', unit: 'tk' },
      'Biohuumus Universaalne Maheväetis 5l': { code: '4744278010014', name: 'Biohuumus 5 l Ussimo', unit: 'tk' },
      'Vertikaalne taimekast': { code: '4744278010038', name: 'Vertikaalne taimekast', unit: 'tk' }
    };
    
    // Process line items
    if (wooOrder.line_items && wooOrder.line_items.length > 0) {
      wooOrder.line_items.forEach(item => {
        // Get product info by name match
        const productName = item.name;
        
        // Special handling for "Toataimede Uus Algus" - replace with 2 different products
        if (productName === 'Toataimede Uus Algus') {
          logger.info(`Found special product "Toataimede Uus Algus" - replacing with component products`);
          
          // Calculate the original total price for this item
          const quantity = parseInt(item.quantity, 10);
          let totalPrice;
          
          if (item.total) {
            // WooCommerce total includes tax
            totalPrice = parseFloat(item.total);
            
            // If we have total_tax, we need to subtract it to get pre-tax amount
            if (item.total_tax) {
              const totalTax = parseFloat(item.total_tax);
              totalPrice = parseFloat((totalPrice - totalTax).toFixed(2));
              logger.info(`Calculating pre-tax amount: ${item.total} - ${totalTax} = ${totalPrice}`);
            } else if (wooOrder.prices_include_tax) {
              // If prices include tax but we don't have total_tax, calculate based on tax rate
              // Estonia VAT is 22%
              totalPrice = parseFloat((totalPrice / 1.22).toFixed(2));
              logger.info(`Calculating pre-tax amount using VAT rate: ${item.total} / 1.22 = ${totalPrice}`);
            }
          } else if (item.subtotal) {
            // Subtotal might also include tax
            totalPrice = parseFloat(item.subtotal);
            
            // If we have subtotal_tax, we need to subtract it
            if (item.subtotal_tax) {
              const subtotalTax = parseFloat(item.subtotal_tax);
              totalPrice = parseFloat((totalPrice - subtotalTax).toFixed(2));
              logger.info(`Calculating pre-tax amount from subtotal: ${item.subtotal} - ${subtotalTax} = ${totalPrice}`);
            } else if (wooOrder.prices_include_tax) {
              // If prices include tax but we don't have subtotal_tax
              totalPrice = parseFloat((totalPrice / 1.22).toFixed(2));
              logger.info(`Calculating pre-tax amount from subtotal using VAT rate: ${item.subtotal} / 1.22 = ${totalPrice}`);
            }
          } else if (item.price) {
            // Price might also include tax
            let unitPrice = parseFloat(item.price);
            
            // If prices include tax, we need to convert to pre-tax
            if (wooOrder.prices_include_tax) {
              unitPrice = parseFloat((unitPrice / 1.22).toFixed(2));
              logger.info(`Calculating pre-tax unit price: ${item.price} / 1.22 = ${unitPrice}`);
            }
            
            totalPrice = parseFloat((unitPrice * quantity).toFixed(2));
            logger.info(`Calculating pre-tax amount from price: ${unitPrice} × ${quantity} = ${totalPrice}`);
          } else {
            // Default pre-tax price for entire package is about 8.20 (10 EUR / 1.22)
            totalPrice = 8.20 * quantity;
            logger.info(`Using default campaign pre-tax price: 8.20 € × ${quantity} = ${totalPrice}`);
          }
          
          logger.info(`Original pre-tax total price for Toataimede Uus Algus: ${totalPrice.toFixed(2)}`);
          
          // Use actual retail prices for the components
          const soilRetailPrice = 2.15; // Actual retail price for soil (pre-tax)
          const concentrateRetailPrice = 2.99; // Actual retail price for concentrate (pre-tax)
          
          // Calculate how many units we get in total
          const soilUnits = 4 * quantity;
          const concentrateUnits = 2 * quantity;
          
          // Calculate total retail value
          const soilRetailTotal = soilUnits * soilRetailPrice;
          const concentrateRetailTotal = concentrateUnits * concentrateRetailPrice;
          const totalRetailValue = soilRetailTotal + concentrateRetailTotal;
          
          logger.info(`Retail component values:`);
          logger.info(`- Soil (${soilUnits} x ${soilRetailPrice}): ${soilRetailTotal.toFixed(2)}`);
          logger.info(`- Concentrate (${concentrateUnits} x ${concentrateRetailPrice}): ${concentrateRetailTotal.toFixed(2)}`);
          logger.info(`- Total retail value: ${totalRetailValue.toFixed(2)}`);
          
          // Calculate discount factor to match campaign price
          const discountFactor = totalPrice / totalRetailValue;
          logger.info(`Discount factor: ${discountFactor.toFixed(4)} (campaign price / retail price)`);
          
          // Calculate discounted prices
          const discountedSoilPrice = parseFloat((soilRetailPrice * discountFactor).toFixed(2));
          const discountedConcentratePrice = parseFloat((concentrateRetailPrice * discountFactor).toFixed(2));
          
          // Calculate the final prices to ensure exact total match
          const discountedSoilTotal = parseFloat((discountedSoilPrice * soilUnits).toFixed(2));
          const discountedConcentrateTotal = parseFloat((discountedConcentratePrice * concentrateUnits).toFixed(2));
          const discountedTotal = discountedSoilTotal + discountedConcentrateTotal;
          
          // Check if we still need a small adjustment to exactly match the total
          const difference = parseFloat((totalPrice - discountedTotal).toFixed(2));
          
          let finalSoilPrice = discountedSoilPrice;
          let finalConcentratePrice = discountedConcentratePrice;
          
          if (difference !== 0) {
            // Distribute the difference proportionally
            const soilProportion = soilRetailTotal / totalRetailValue;
            const soilAdjustment = parseFloat((difference * soilProportion / soilUnits).toFixed(2));
            
            finalSoilPrice = parseFloat((discountedSoilPrice + soilAdjustment).toFixed(2));
            
            // Recalculate final totals
            const finalSoilTotal = parseFloat((finalSoilPrice * soilUnits).toFixed(2));
            const finalConcentrateTotal = parseFloat((finalConcentratePrice * concentrateUnits).toFixed(2));
            const finalTotal = parseFloat((finalSoilTotal + finalConcentrateTotal).toFixed(2));
            
            logger.info(`Fine-tuned prices to match total exactly. Difference: ${difference}`);
            logger.info(`Final total check: ${finalTotal.toFixed(2)} (should equal ${totalPrice.toFixed(2)})`);
          }
          
          logger.info(`Final component prices (pre-tax):`);
          logger.info(`- Soil adjusted price: ${finalSoilPrice} (${(finalSoilPrice / soilRetailPrice * 100).toFixed(1)}% of retail)`);
          logger.info(`- Concentrate adjusted price: ${finalConcentratePrice} (${(finalConcentratePrice / concentrateRetailPrice * 100).toFixed(1)}% of retail)`);
          
          // Define the replacement products with adjusted prices
          const replacements = [
            {
              name: 'Ussimo Toalillemuld Biohuumusega',
              code: '4744278011219',
              description: 'Toalillemuld 2, 5 l',
              unit: 'tk',
              quantity: soilUnits,
              price: finalSoilPrice
            },
            {
              name: 'Ussimo Biohuumuse Kontsentraat Lilledele',
              code: '4742022540022',
              description: 'Biohuumuse kontsentraat Lilledele, 500ml',
              unit: 'tk',
              quantity: concentrateUnits,
              price: finalConcentratePrice
            }
          ];
          
          // Add each replacement product as a separate line item
          replacements.forEach(product => {
            logger.info(`Replacement product: ${product.name}`);
            logger.info(`- Quantity: ${product.quantity}`);
            logger.info(`- Unit price: ${product.price.toFixed(2)}`);
            logger.info(`- Total price: ${(product.price * product.quantity).toFixed(2)}`);
            
            rows.push({
              Item: {
                Code: product.code,
                Description: product.description,
                Type: 3,
                UOMName: product.unit
              },
              Quantity: product.quantity.toString(),
              Price: product.price.toFixed(2),
              DiscountPct: 0,
              DiscountAmount: 0,
              TaxId: vatTaxId,
              LocationCode: 1
            });
          });
          
          return; // Skip the regular product processing for this item
        }
        
        // Regular product processing for all other products
        let productInfo;
        
        // If product is in our mapping, use that data
        if (productMapping[productName]) {
          productInfo = productMapping[productName];
        } else {
          // For unknown products, use item data
          // If SKU exists, use it; otherwise use product_id
          const code = item.sku || (item.product_id ? item.product_id.toString() : 'NOSKU');
          productInfo = {
            code,
            name: productName,
            unit: 'tk'
          };
        }
        
        // Get price and quantity
        const quantity = parseInt(item.quantity, 10);
        
        // IMPORTANT: Use the exact subtotal from WooCommerce, divided by quantity
        // Ensure we use the exact values that are sent to the customer
        let price;
        if (item.subtotal && quantity > 0) {
          // Check if prices include tax and subtract tax if needed
          if (wooOrder.prices_include_tax && item.subtotal_tax) {
            // Calculate pre-tax subtotal
            const preTaxSubtotal = parseFloat(item.subtotal) - parseFloat(item.subtotal_tax);
            // Use the pre-tax subtotal divided by quantity, rounded to 2 decimal places
            price = parseFloat((preTaxSubtotal / quantity).toFixed(2));
          } else {
            // Use the pre-tax subtotal divided by quantity, rounded to 2 decimal places
            price = parseFloat((parseFloat(item.subtotal) / quantity).toFixed(2));
          }
        } else if (item.price) {
          // Check if prices include tax
          if (wooOrder.prices_include_tax) {
            // Convert price to pre-tax amount (Estonia VAT is 22%)
            price = parseFloat((parseFloat(item.price) / 1.22).toFixed(2));
          } else {
            // Use price as is
            price = parseFloat(parseFloat(item.price).toFixed(2));
          }
        } else {
          price = 0;
        }
        
        // Log the original and final price for debugging
        logger.info(`Item: ${productName}, Original price: ${item.price}, Calculated price: ${price}`);
        logger.info(`Line item: Code=${productInfo.code}, Name=${productInfo.name}, Quantity=${quantity}, Price=${price}, Total=${(price * quantity).toFixed(2)}`);
        
        rows.push({
          Item: {
            Code: productInfo.code,
            Description: productInfo.name,
            Type: 3,
            UOMName: productInfo.unit
          },
          Quantity: quantity.toString(),
          Price: price.toString(),
          DiscountPct: 0,
          DiscountAmount: 0,
          TaxId: vatTaxId,
          LocationCode: 1
        });
      });
    }
    
    // Add shipping as a line item if present
    if (wooOrder.shipping_lines && wooOrder.shipping_lines.length > 0) {
      wooOrder.shipping_lines.forEach(shipping => {
        let shippingTotal = parseFloat(parseFloat(shipping.total || 0).toFixed(2));
        
        // Skip if shipping is free
        if (shippingTotal <= 0) {
          return;
        }
        
        // If prices include tax and we have shipping_tax_total, subtract it
        if (wooOrder.prices_include_tax && shipping.total_tax) {
          const shippingTax = parseFloat(shipping.total_tax);
          shippingTotal = parseFloat((shippingTotal - shippingTax).toFixed(2));
          logger.info(`Adjusted shipping price from ${shipping.total} to ${shippingTotal} (removed tax)`);
        }
        
        logger.info(`Shipping: Transport Pakiautomaat, Price=${shippingTotal.toFixed(2)}`);
        
        rows.push({
          Item: {
            Code: 'Transport',
            Description: 'Pakiautomaat',
            Type: 3,
            UOMName: 'tk'
          },
          Quantity: '1',
          Price: shippingTotal.toString(),
          DiscountPct: 0,
          DiscountAmount: 0,
          TaxId: vatTaxId,
          LocationCode: 1
        });
      });
    }
    
    // Process coupon lines as negative line items if present
    if (wooOrder.coupon_lines && wooOrder.coupon_lines.length > 0) {
      wooOrder.coupon_lines.forEach(coupon => {
        const couponCode = coupon.code || 'Discount';
        let discountAmount = parseFloat(coupon.discount || 0);
        
        // Skip if discount is zero
        if (discountAmount <= 0) {
          return;
        }
        
        // If prices include tax and we have discount_tax, subtract it
        if (wooOrder.prices_include_tax && coupon.discount_tax) {
          const discountTax = parseFloat(coupon.discount_tax);
          discountAmount = parseFloat((discountAmount - discountTax).toFixed(2));
          logger.info(`Adjusted discount from ${coupon.discount} to ${discountAmount} (removed tax)`);
        }
        
        // Create a negative line item for the discount
        const negativeAmount = -Math.abs(discountAmount);
        logger.info(`Discount: ${couponCode}, Amount=${negativeAmount.toFixed(2)}`);
        
        rows.push({
          Item: {
            Code: 'DISCOUNT',
            Description: `Allahindlus (${couponCode})`,
            Type: 3,
            UOMName: 'tk'
          },
          Quantity: '1',
          Price: negativeAmount.toFixed(2),
          DiscountPct: 0,
          DiscountAmount: 0,
          TaxId: vatTaxId,
          LocationCode: 1
        });
      });
    }
    
    return rows;
  }

  /**
   * Get the VAT tax ID for Estonia (20%)
   * @returns {string} - Tax ID
   */
  getVATTaxId() {
    if (config.merit.vatTaxId) {
      return config.merit.vatTaxId;
    }
    
    // If not configured, return default value (should be updated with actual tax ID)
    logger.warn('Merit VAT tax ID not configured, using default value');
    return '307000b4-f1f2-4bc7-a110-24cb18d77212';
  }
  
  /**
   * Format date for Merit API (YYYYMMDDHHmmss)
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  formatDateForMerit(date) {
    const pad2 = n => (n > 9 ? '' + n : '0' + n);
    
    const yyyy = date.getFullYear();
    const MM = pad2(date.getMonth() + 1);
    const dd = pad2(date.getDate());
    const HH = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  /**
   * Get list of invoices from Merit Aktiva
   * @param {Object} options - Query options
   * @param {string} options.startDate - Start date in YYYYMMDD format
   * @param {string} options.endDate - End date in YYYYMMDD format
   * @param {boolean} options.unpaidOnly - Get only unpaid invoices
   * @param {string} options.customerName - Filter by customer name (optional)
   * @param {number} options.page - Page number (starting from 1)
   * @param {number} options.limit - Number of items per page
   * @returns {Promise<Object>} - List of invoices with pagination info
   */
  async getInvoices(options = {}) {
    try {
      const { 
        startDate, 
        endDate, 
        unpaidOnly = false, 
        customerName,
        page = 1,
        limit = 10
      } = options;
      
      // Validate required parameters
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
      }
      
      // Prepare request payload
      const payload = {
        PeriodStart: startDate,
        PeriodEnd: endDate,
        UnPaid: unpaidOnly
      };
      
      logger.info(`Fetching invoices from Merit Aktiva: ${JSON.stringify(payload)}`);
      
      // Make the request with proper authentication
      const invoices = await this.makeRequest('getinvoices', payload);
      
      if (!Array.isArray(invoices)) {
        logger.error(`Unexpected response format: ${JSON.stringify(invoices)}`);
        throw new Error('Unexpected response format from Merit API');
      }
      
      // Filter for "Eraisik" only as requested
      let filteredInvoices = invoices.filter(invoice => 
        invoice.CustomerName === 'Eraisik'
      );
      
      // Additional filtering by customer name if provided
      if (customerName && customerName.trim() !== '') {
        const searchTerm = customerName.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice => {
          // Extract customer name from HComment if available
          const extractedName = this.extractCustomerNameFromHComment(invoice.HComment);
          return extractedName && extractedName.toLowerCase().includes(searchTerm);
        });
      }
      
      // Get total count before pagination
      const totalCount = filteredInvoices.length;
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
      
      // Format dates and extract customer names for better readability
      const formattedInvoices = paginatedInvoices.map(invoice => {
        const extractedName = this.extractCustomerNameFromHComment(invoice.HComment);
        const extractedOrderNumber = this.extractOrderNumberFromHComment(invoice.HComment);
        
        return {
          ...invoice,
          DocumentDate: this.formatDate(invoice.DocumentDate),
          TransactionDate: this.formatDate(invoice.TransactionDate),
          DueDate: this.formatDate(invoice.DueDate),
          EmailSent: this.formatDate(invoice.EmailSent),
          isPastDue: new Date(invoice.DueDate) < new Date() && (!invoice.Paid || invoice.PaidAmount < invoice.TotalAmount),
          // Add the extracted customer name as a new field
          realCustomerName: extractedName || 'Unknown',
          // Add the extracted order number as a new field
          extractedOrderNumber: extractedOrderNumber || ''
        };
      });
      
      // Return pagination info along with the invoices
      return {
        invoices: formattedInvoices,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching invoices from Merit Aktiva:', error.message);
      throw error;
    }
  }
  
  /**
   * Format date from API format to readable format
   * @param {string} dateString - Date string
   * @returns {string} - Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Convert ISO date string to DD.MM.YYYY format
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Extract customer name from HComment field
   * Format example: "Ussimo \n#1736\nMalle Tammekivi"
   * @param {string} comment - HComment field from invoice
   * @returns {string|null} - Extracted customer name or null if not found
   */
  extractCustomerNameFromHComment(comment) {
    if (!comment) return null;
    
    try {
      // Split by newline and get the last part
      const parts = comment.split('\n');
      if (parts.length >= 3) {
        return parts[parts.length - 1].trim();
      } else if (parts.length === 1) {
        // If there's only one line, try to extract after "Ussimo #"
        const match = comment.match(/Ussimo\s+#\d+\s+(.+)/i);
        return match ? match[1].trim() : comment.trim();
      }
      return comment.trim();
    } catch (error) {
      logger.error(`Error extracting customer name from comment: ${error.message}`, comment);
      return null;
    }
  }

  /**
   * Extract order number from HComment field
   * Format example: "Ussimo \n#1736\nMalle Tammekivi"
   * @param {string} comment - HComment field from invoice
   * @returns {string|null} - Extracted order number or null if not found
   */
  extractOrderNumberFromHComment(comment) {
    if (!comment) return null;
    
    try {
      // Look for #XXXX pattern in the comment
      const match = comment.match(/#(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      logger.error(`Error extracting order number from comment: ${error.message}`, comment);
      return null;
    }
  }

  /**
   * Get invoice details from Merit Aktiva
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} - Invoice details
   */
  async getInvoiceDetails(invoiceId) {
    try {
      logger.info(`Fetching invoice details for ID: ${invoiceId}`);
      
      const payload = {
        Id: invoiceId
      };
      
      const response = await this.makeRequest('getinvoice', payload);
      return response;
    } catch (error) {
      logger.error(`Error fetching invoice details: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete invoice from Merit Aktiva
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} - Response data
   */
  async deleteInvoice(invoiceId) {
    try {
      logger.info(`Deleting invoice with ID: ${invoiceId}`);
      
      const payload = {
        Id: invoiceId
      };
      
      const response = await this.makeRequest('deleteinvoice', payload);
      logger.info(`Invoice deleted successfully: ${invoiceId}`);
      return response;
    } catch (error) {
      logger.error(`Error deleting invoice: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an invoice in Merit Aktiva from a WooCommerce order with verification and adjustment
   * @param {Object} wooOrder - WooCommerce order data
   * @returns {Promise<Object>} - Created invoice data
   */
  async createInvoiceFromWooCommerceOrder(wooOrder) {
    try {
      logger.info(`Processing WooCommerce order #${wooOrder.id} to create Merit invoice`);
      logger.info(`Order details: Currency: ${wooOrder.currency}, Total: ${wooOrder.total}, Subtotal: ${wooOrder.subtotal}, Tax: ${wooOrder.total_tax}`);
      
      // Make sure we have a valid order total
      const wooTotal = parseFloat(parseFloat(wooOrder.total).toFixed(2));
      if (isNaN(wooTotal) || wooTotal <= 0) {
        throw new Error(`Invalid WooCommerce order total: ${wooOrder.total}`);
      }
      
      // VAT rate for Estonia (22%)
      const VAT_RATE = 0.22;
      
      // Prepare invoice rows
      let invoiceRows = this.prepareInvoiceRowsFromWooOrder(wooOrder);
      
      // Calculate row sum (pre-tax amount)
      const rowsTotal = invoiceRows.reduce((sum, row) => {
        const price = parseFloat(row.Price);
        const quantity = parseFloat(row.Quantity);
        const rowTotal = price * quantity;
        logger.info(`Row total for ${row.Item.Description}: ${price} × ${quantity} = ${rowTotal.toFixed(2)}`);
        return sum + rowTotal;
      }, 0);
      
      // Round to exactly 2 decimal places
      const rowsTotalRounded = parseFloat(rowsTotal.toFixed(2));
      
      // Calculate tax amount
      let taxAmount = parseFloat((rowsTotalRounded * VAT_RATE).toFixed(2));
      
      // Calculate our total with tax
      const meritTotal = parseFloat((rowsTotalRounded + taxAmount).toFixed(2));
      
      // Calculate difference between WooCommerce total and Merit calculated total
      const totalDifference = parseFloat((wooTotal - meritTotal).toFixed(2));
      
      logger.info(`INITIAL TOTALS COMPARISON:`);
      logger.info(`- WooCommerce total (expected): ${wooTotal.toFixed(2)}`);
      logger.info(`- Rows total without VAT: ${rowsTotalRounded.toFixed(2)}`);
      logger.info(`- VAT amount (22%): ${taxAmount.toFixed(2)}`);
      logger.info(`- Merit calculated total: ${meritTotal.toFixed(2)}`);
      logger.info(`- Difference: ${totalDifference.toFixed(2)}`);
      
      // If there's a difference, adjust the item prices instead of using RoundingAmount
      if (totalDifference !== 0) {
        logger.info(`Adjusting item prices to match the expected total instead of using RoundingAmount`);
        
        // Find the largest item to adjust (to minimize rounding issues)
        let largestItemIndex = -1;
        let largestItemTotal = 0;
        
        invoiceRows.forEach((row, index) => {
          const price = parseFloat(row.Price);
          const quantity = parseFloat(row.Quantity);
          const total = price * quantity;
          
          if (total > largestItemTotal) {
            largestItemTotal = total;
            largestItemIndex = index;
          }
        });
        
        if (largestItemIndex >= 0) {
          // Calculate the exact pre-tax amount needed to achieve the exact total with VAT
          // wooTotal = preTaxTotal * (1 + VAT_RATE)
          // So preTaxTotal = wooTotal / (1 + VAT_RATE)
          const targetPreTaxTotal = parseFloat((wooTotal / (1 + VAT_RATE)).toFixed(2));
          
          // Calculate how much we need to adjust the pre-tax amount by
          const currentPreTaxTotal = rowsTotalRounded;
          const exactPreTaxDifference = parseFloat((targetPreTaxTotal - currentPreTaxTotal).toFixed(2));
          
          const row = invoiceRows[largestItemIndex];
          const quantity = parseFloat(row.Quantity);
          const currentPrice = parseFloat(row.Price);
          const currentTotal = currentPrice * quantity;
          
          // Adjust the price of the largest item with precise calculation
          const adjustedItemTotal = parseFloat((currentTotal + exactPreTaxDifference).toFixed(2));
          // Calculate the precise unit price - internal calculation can use higher precision
          const calculatedPrice = adjustedItemTotal / quantity;
          // But for Merit, always round to exactly 2 decimal places
          const adjustedPrice = parseFloat(calculatedPrice.toFixed(2));
          
          logger.info(`Precise adjustment to match WooCommerce total exactly:`);
          logger.info(`- Target pre-tax total: ${targetPreTaxTotal.toFixed(2)}`);
          logger.info(`- Current pre-tax total: ${currentPreTaxTotal.toFixed(2)}`);
          logger.info(`- Required pre-tax adjustment: ${exactPreTaxDifference.toFixed(2)}`);
          logger.info(`Adjusting price of item "${row.Item.Description}" from ${currentPrice} to ${adjustedPrice.toFixed(2)}`);
          logger.info(`- Original item total: ${currentTotal.toFixed(2)}`);
          logger.info(`- Adjusted item total: ${adjustedItemTotal.toFixed(2)}`);
          
          // Update the price in the row - always format with 2 decimal places
          invoiceRows[largestItemIndex].Price = adjustedPrice.toFixed(2);
          
          // Recalculate totals
          const newRowsTotal = invoiceRows.reduce((sum, row) => {
            const price = parseFloat(row.Price);
            const quantity = parseFloat(row.Quantity);
            return sum + (price * quantity);
          }, 0);
          
          const newRowsTotalRounded = parseFloat(newRowsTotal.toFixed(2));
          const newTaxAmount = parseFloat((newRowsTotalRounded * VAT_RATE).toFixed(2));
          const newMeritTotal = parseFloat((newRowsTotalRounded + newTaxAmount).toFixed(2));
          
          logger.info(`FINAL TOTALS AFTER PRICE ADJUSTMENT:`);
          logger.info(`- Adjusted rows total without VAT: ${newRowsTotalRounded.toFixed(2)}`);
          logger.info(`- Adjusted VAT amount (22%): ${newTaxAmount.toFixed(2)}`);
          logger.info(`- Adjusted Merit calculated total: ${newMeritTotal.toFixed(2)}`);
          logger.info(`- WooCommerce total (expected): ${wooTotal.toFixed(2)}`);
          logger.info(`- New difference: ${parseFloat((wooTotal - newMeritTotal).toFixed(6)).toFixed(6)}`);
          
          // Update tax amount
          taxAmount = newTaxAmount;
          
          // Final verification to ensure EXACT match with WooCommerce total
          // If there's still a penny difference, make a micro-adjustment
          const finalDifference = parseFloat((wooTotal - newMeritTotal).toFixed(2));
          if (finalDifference !== 0) {
            logger.info(`Still detected a small difference of ${finalDifference.toFixed(2)}. Making final micro-adjustment.`);
            
            // Calculate the exact tax amount needed to achieve the WooCommerce total
            const exactTaxNeeded = parseFloat((wooTotal - newRowsTotalRounded).toFixed(2));
            taxAmount = exactTaxNeeded;
            
            logger.info(`Adjusted tax amount from ${newTaxAmount.toFixed(2)} to ${taxAmount.toFixed(2)} to ensure exact match.`);
            
            // Verify the final total one more time
            const finalMeritTotal = parseFloat((newRowsTotalRounded + taxAmount).toFixed(2));
            logger.info(`Final verification: ${finalMeritTotal.toFixed(2)} should exactly match ${wooTotal.toFixed(2)}`);
            logger.info(`Final difference: ${parseFloat((wooTotal - finalMeritTotal).toFixed(6)).toFixed(6)}`);
          }
        } else {
          logger.warn(`Could not find an item to adjust. Using original values.`);
        }
      }
      
      // Format dates
      const now = new Date();
      const docDate = this.formatDateForMerit(now);
      
      // Calculate due date (7 days from now)
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateFormatted = this.formatDateForMerit(dueDate);
      
      // Extract customer info
      const customerName = `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`;
      
      // Get the next invoice number from Merit
      const nextInvoiceNumber = await this.getNextInvoiceNumber();
      
      // Get VAT Tax ID
      const vatTaxId = this.getVATTaxId();
      
      // Create invoice data without forcing TotalAmount or TaxAmount
      const invoiceData = {
        Customer: {
          Name: 'Eraisik',
          Address: wooOrder.billing.address_1 || '',
          City: wooOrder.billing.city || '',
          CountryCode: wooOrder.billing.country || 'EE',
          PostalCode: wooOrder.billing.postcode || '',
          Email: wooOrder.billing.email || '',
          PhoneNo: wooOrder.billing.phone || '',
          CurrencyCode: wooOrder.currency || 'EUR'
        },
        DocDate: docDate,
        DueDate: dueDateFormatted,
        InvoiceNo: nextInvoiceNumber,
        InvoiceRow: invoiceRows,
        RoundingAmount: 0,
        HComment: `Ussimo \n#${wooOrder.id}\n${customerName}`,
        FComment: `II kategooria: orgaaniliste väetiste ja mullaparandusainete transport ja turule laskmine, tegevusloa nr. R/04/ABP/105`,
        AccountingDoc: 1 // Based on Merit API documentation: 1 = faktura (invoice)
      };
      
      // Let Merit calculate totals according to their bookkeeping standard
      logger.info(`Sending invoice to Merit with ${invoiceRows.length} line items.`);
      logger.info(`Each row has TaxId: ${vatTaxId} (VAT 22%) set individually.`);
      logger.info(`Merit will calculate VAT for each row following their bookkeeping standard: each row has its own VAT calculation and is rounded before summing.`);
      
      // Calculate total amount from rows (for API requirement)
      const calculatedRowsTotal = invoiceRows.reduce((sum, row) => {
        return sum + (parseFloat(row.Price) * parseFloat(row.Quantity));
      }, 0);
      
      // Simply use the exact sum of rows as TotalAmount
      const exactRowsTotal = parseFloat(calculatedRowsTotal.toFixed(2));
      
      // Calculate tax amount based on the exact rows total
      const calculatedTaxAmount = parseFloat((exactRowsTotal * VAT_RATE).toFixed(2));
      
      // Calculate the expected total including tax
      const expectedMeritTotal = parseFloat((exactRowsTotal + calculatedTaxAmount).toFixed(2));
      
      // Calculate the rounding amount to match WooCommerce total exactly
      let roundingAmount = parseFloat((wooTotal - expectedMeritTotal).toFixed(2));
      
      logger.info(`Calculating dynamic rounding amount:`);
      logger.info(`- WooCommerce total: ${wooTotal.toFixed(2)}`);
      logger.info(`- Merit calculated total before rounding: ${expectedMeritTotal.toFixed(2)}`);
      logger.info(`- Initial rounding adjustment: ${roundingAmount.toFixed(2)}`);
      
      // Predict Merit's tax calculation which might differ slightly due to per-line rounding
      // Merit calculates tax for each line separately and rounds each calculation
      const predictedMeritTax = invoiceRows.reduce((sum, row) => {
        const price = parseFloat(row.Price);
        const quantity = parseFloat(row.Quantity);
        const rowTotal = price * quantity;
        // Calculate tax for this row and round to 2 decimal places (Merit's approach)
        const rowTax = parseFloat((rowTotal * VAT_RATE).toFixed(2));
        return sum + rowTax;
      }, 0);
      
      // Round to exactly 2 decimal places
      const predictedMeritTaxRounded = parseFloat(predictedMeritTax.toFixed(2));
      
      // Calculate the difference between our tax calculation and Merit's predicted tax calculation
      const taxDifference = parseFloat((predictedMeritTaxRounded - calculatedTaxAmount).toFixed(2));
      
      logger.info(`- Our calculated tax amount: ${calculatedTaxAmount.toFixed(2)}`);
      logger.info(`- Predicted Merit tax calculation: ${predictedMeritTaxRounded.toFixed(2)}`);
      logger.info(`- Tax calculation difference: ${taxDifference.toFixed(2)}`);
      
      // Adjust the rounding amount to compensate for Merit's tax calculation difference
      roundingAmount = parseFloat((roundingAmount - taxDifference).toFixed(2));
      
      logger.info(`- Final adjusted rounding amount: ${roundingAmount.toFixed(2)}`);
      
      // Add these fields to the invoice data with required structure
      invoiceData.TotalAmount = exactRowsTotal;
      invoiceData.TaxAmount = [
        {
          TaxId: vatTaxId,
          Amount: calculatedTaxAmount
        }
      ];
      
      // Use dynamically calculated rounding amount with tax difference compensation
      invoiceData.RoundingAmount = roundingAmount;
      
      logger.info(`Added properly structured data for Merit API with compensated rounding:`);
      logger.info(`- TotalAmount: ${exactRowsTotal.toFixed(2)}`);
      logger.info(`- TaxAmount[0].Amount: ${calculatedTaxAmount.toFixed(2)}`);
      logger.info(`- RoundingAmount (adjusted): ${roundingAmount.toFixed(2)}`);
      // Calculate final total considering Merit's tax calculation
      const predictedMeritFinalTotal = parseFloat((exactRowsTotal + predictedMeritTaxRounded + roundingAmount).toFixed(2));
      logger.info(`- Predicted Merit total after tax recalculation: ${predictedMeritFinalTotal.toFixed(2)}`);
      logger.info(`- WooCommerce total: ${wooTotal.toFixed(2)}`);
      
      // Create the invoice in Merit
      return await this.createInvoice(invoiceData);
    } catch (error) {
      logger.error(`Failed to create invoice from WooCommerce order: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MeritService(); 