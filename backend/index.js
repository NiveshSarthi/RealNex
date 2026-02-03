const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import configurations
const { pool } = require('./config/database');
const { redisClient, connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');

// Import routes
const authRoutes = require('./routes/auth');
const agentsRoutes = require('./routes/agents');
const whatsappRoutes = require('./routes/whatsapp');
const multiChannelRoutes = require('./routes/multiChannel');
const whiteLabelRoutes = require('./routes/whiteLabel');
const advancedAnalyticsRoutes = require('./routes/advancedAnalytics');
const apiMarketplaceRoutes = require('./routes/apiMarketplace');
const mobileAppRoutes = require('./routes/mobileApp');
const conversationRoutes = require('./routes/conversations');
const workflowRoutes = require('./routes/workflows');
const crmRoutes = require('./routes/crm');
const broadcastRoutes = require('./routes/broadcasts');
const ecommerceRoutes = require('./routes/ecommerce');
const realEstateRoutes = require('./routes/realEstate');
const calculatorRoutes = require('./routes/calculator');
const subscriptionRoutes = require('./routes/subscriptions');
const quickRepliesRoutes = require('./routes/quickReplies'); // Added quickReplies route import
const teamRoutes = require('./routes/teams');
const analyticsRoutes = require('./routes/analytics');
const templateRoutes = require('./routes/templates');
const aiRoutes = require('./routes/ai');
const networkRoutes = require('./routes/network');
const lmsRoutes = require('./routes/lms');
const metaAdsRoutes = require('./routes/metaAds');
const dripSequencesRoutes = require('./routes/dripSequences');
const leadsRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'WhatsApp Automation Platform API' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected', timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/webhooks', multiChannelRoutes); // Webhooks for all channels
app.use('/api/multichannel', multiChannelRoutes); // API endpoints
app.use('/api/white-label', whiteLabelRoutes);
app.use('/api/advanced-analytics', advancedAnalyticsRoutes);
app.use('/api/marketplace', apiMarketplaceRoutes);
app.use('/api/mobile', mobileAppRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/ecommerce', ecommerceRoutes);
app.use('/api/real-estate', realEstateRoutes);
app.use('/api/calculator', calculatorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/v1/templates', templateRoutes);

// New Routes
app.use('/api/ai', aiRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/meta-ads', metaAdsRoutes);
app.use('/api/drip-sequences', dripSequencesRoutes);
app.use('/api/v1/contacts', leadsRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Connect to Redis
  try {
    await connectRedis();
  } catch (err) {
    console.error('Redis connection failed (non-fatal):', err.message);
  }

  // Connect to RabbitMQ
  // try {
  //   await connectRabbitMQ();
  // } catch (err) {
  //   console.error('RabbitMQ connection failed (non-fatal):', err.message);
  // }
};

startServer();

module.exports = app;