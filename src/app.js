// Import routes
const montonioRoutes = require('./routes/montonio');
const meritRoutes = require('./routes/merit');
const woocommerceRoutes = require('./routes/woocommerce');

// ... existing code ...

// Register routes
app.use('/api/montonio', montonioRoutes);
app.use('/api/merit', meritRoutes);
app.use('/api/woocommerce', woocommerceRoutes); 