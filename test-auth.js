require('dotenv').config();
const montonioService = require('./src/services/montonio');
const logger = require('./src/utils/logger');

async function testAuthentication() {
  try {
    console.log('Starting Montonio authentication test...');
    console.log(`Using email: ${process.env.MONTONIO_EMAIL}`);
    
    // Attempt to authenticate
    const success = await montonioService.authenticate();
    
    if (success) {
      console.log('Authentication successful! ✅');
      
      // Show cookies (partial, for security)
      if (montonioService.authCookies && montonioService.authCookies.length > 0) {
        const cookieSample = montonioService.authCookies.map(cookie => {
          // Only show the first part of each cookie for security
          const cookieParts = cookie.split(';')[0];
          const nameValue = cookieParts.split('=');
          if (nameValue.length > 1) {
            // Show full name but only first few chars of value
            const name = nameValue[0];
            const valuePreview = nameValue[1].substring(0, 10) + '...';
            return `${name}=${valuePreview}`;
          }
          return cookieParts;
        });
        
        console.log('Cookie information:');
        console.log(cookieSample);
      }
      
      // Test fetching orders
      console.log('\nAttempting to fetch recent orders...');
      try {
        // Test the main fetchOrders method
        const orders = await montonioService.fetchOrders(0, 10);
        
        // Debugging
        console.log('Raw orders response type:', typeof orders);
        console.log('Is orders an array?', Array.isArray(orders));
        
        if (Array.isArray(orders)) {
          console.log(`Successfully retrieved ${orders.length} orders.`);
          
          if (orders.length > 0) {
            // Print sample order data (first order)
            console.log('\nSample order data:');
            const sampleOrder = orders[0];
            console.log('Sample order keys:', Object.keys(sampleOrder));
            console.log(`- Order UUID: ${sampleOrder.uuid || 'N/A'}`);
            console.log(`- Created: ${sampleOrder.createdAt || 'N/A'}`);
            console.log(`- Status: ${sampleOrder.paymentStatus || 'N/A'}`);
            console.log(`- Customer: ${sampleOrder.customerFullName || 'N/A'}`);
            console.log(`- Email: ${sampleOrder.customerEmail || 'N/A'}`);
            console.log(`- Total: ${sampleOrder.grandTotal || 0} ${sampleOrder.currency || ''}`);
            
            // Test fetching order by UUID if UUID exists
            if (sampleOrder.uuid) {
              console.log('\nFetching this order by UUID...');
              try {
                const orderDetail = await montonioService.fetchOrderByUuid(sampleOrder.uuid);
                console.log(`Order detail fetch successful: ${!!orderDetail}`);
                if (orderDetail) {
                  console.log('Order detail keys:', Object.keys(orderDetail));
                }
              } catch (detailError) {
                console.error('Error fetching order detail:', detailError.message);
              }
            }
            
            // Test date range filtering
            console.log('\nTesting date range filtering...');
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7); // Last 7 days
            
            try {
              const dateRangeOrders = await montonioService.fetchOrdersByDateRange(fromDate, toDate);
              console.log(`Found ${dateRangeOrders.length} orders in the last 7 days.`);
            } catch (rangeError) {
              console.error('Error fetching orders by date range:', rangeError.message);
            }
          } else {
            console.log('No orders were found.');
          }
        } else {
          console.log('Unexpected response: Orders is not an array');
          console.log('Orders value:', orders);
        }
      } catch (error) {
        console.error('Error fetching orders:', error.message);
        console.error('Error stack:', error.stack);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Response data (preview):', JSON.stringify(error.response.data, null, 2).substring(0, 500));
        }
      }
    } else {
      console.error('Authentication failed! ❌');
    }
  } catch (error) {
    console.error('Error during authentication test:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response data (preview):', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

// Run the test
testAuthentication().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 