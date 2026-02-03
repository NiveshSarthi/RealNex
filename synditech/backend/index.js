const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import configurations
const { pool } = require('./config/database');

// Import routes
const whatsappRoutes = require('./routes/whatsapp');
const agentRoutes = require('./routes/agents');
const campaignRoutes = require('./routes/campaigns');
const templateRoutes = require('./routes/templates');
const dripSequenceRoutes = require('./routes/dripSequences');
const collaborationRoutes = require('./routes/collaborations');
const agentNetworkRoutes = require('./routes/agentNetwork');
const analyticsRoutes = require('./routes/analytics');
const paymentRoutes = require('./routes/payments');
const monitoringRoutes = require('./routes/monitoring');
const catalogRoutes = require('./routes/catalog');
const quickReplyRoutes = require('./routes/quickReplies');
const workflowRoutes = require('./routes/workflows');
const metaAdsRoutes = require('./routes/metaAds');
const lmsRoutes = require('./routes/lms');
const aiRoutes = require('./routes/ai');

// Import services
const MonitoringService = require('./services/monitoring');
const BackupService = require('./services/backup');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request monitoring middleware
app.use(MonitoringService.requestTracker());

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'SyndiTech Intelligence System API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'SyndiTech API'
  });
});

// API Routes
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/drip-sequences', dripSequenceRoutes);
app.use('/api/collaborations', collaborationRoutes);
app.use('/api/network', agentNetworkRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/meta-ads', metaAdsRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/ai', aiRoutes);

// Database test route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connected successfully',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Initialize production services
if (process.env.NODE_ENV === 'production') {
  // Schedule automated backups
  BackupService.scheduleAutomatedBackups();
  console.log('📅 Automated backup scheduling enabled');

  // Log server startup
  MonitoringService.logEvent('info', 'Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SyndiTech API server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Health check available at: http://localhost:${PORT}/api/monitoring/health`);
});

module.exports = app;