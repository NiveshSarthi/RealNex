const express = require('express');
const router = express.Router();
const APIMarketplaceService = require('../services/apiMarketplace');
const { authenticate } = require('../middleware/auth');

// Middleware to validate API key
const validateAPIKey = async (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const keyData = await APIMarketplaceService.validateAPIKey(apiKey);
  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.apiKeyData = keyData;
  next();
};

// Rate limiting middleware
const checkRateLimit = async (req, res, next) => {
  const endpoint = req.path;
  const keyId = req.apiKeyData?.keyId;

  if (keyId) {
    const rateLimit = await APIMarketplaceService.checkRateLimit(keyId, endpoint);

    res.set({
      'X-RateLimit-Limit': rateLimit.limit,
      'X-RateLimit-Remaining': Math.max(0, rateLimit.limit - rateLimit.currentUsage),
      'X-RateLimit-Reset': Math.floor(rateLimit.resetTime.getTime() / 1000)
    });

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.floor((rateLimit.resetTime.getTime() - Date.now()) / 1000)
      });
    }
  }

  next();
};

// API Key Management (requires user authentication)

router.post('/keys', authenticate, async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    const apiKey = await APIMarketplaceService.generateAPIKey(
      req.user.organizationId,
      name,
      permissions || []
    );

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

router.get('/keys', authenticate, async (req, res) => {
  try {
    const keys = await APIMarketplaceService.getAPIKeys(req.user.organizationId);
    res.json({
      success: true,
      data: keys
    });
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

router.delete('/keys/:keyId', authenticate, async (req, res) => {
  try {
    const { keyId } = req.params;
    const success = await APIMarketplaceService.revokeAPIKey(req.user.organizationId, keyId);

    if (!success) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Webhook Management

router.post('/webhooks', authenticate, async (req, res) => {
  try {
    const webhookData = {
      ...req.body,
      organizationId: req.user.organizationId
    };

    const webhook = await APIMarketplaceService.registerWebhook(req.user.organizationId, webhookData);

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

router.get('/webhooks', authenticate, async (req, res) => {
  try {
    const webhooks = await APIMarketplaceService.getWebhooks(req.user.organizationId);
    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error('Error getting webhooks:', error);
    res.status(500).json({ error: 'Failed to get webhooks' });
  }
});

router.put('/webhooks/:webhookId', authenticate, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const updates = req.body;

    // Verify ownership
    const webhooks = await APIMarketplaceService.getWebhooks(req.user.organizationId);
    const webhook = webhooks.find(w => w.webhook_id === webhookId);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Update webhook (simplified - in real implementation, update in database)
    const updatedWebhook = { ...webhook, ...updates };

    res.json({
      success: true,
      data: updatedWebhook
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

router.delete('/webhooks/:webhookId', authenticate, async (req, res) => {
  try {
    const { webhookId } = req.params;

    // Verify ownership and deactivate webhook
    const { query } = require('../config/database');
    const result = await query(
      'UPDATE webhooks SET is_active = false WHERE webhook_id = $1 AND organization_id = $2',
      [webhookId, req.user.organizationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      success: true,
      message: 'Webhook deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating webhook:', error);
    res.status(500).json({ error: 'Failed to deactivate webhook' });
  }
});

// Webhook Logs
router.get('/webhooks/:webhookId/logs', authenticate, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { limit } = req.query;

    const logs = await APIMarketplaceService.getWebhookLogs(
      req.user.organizationId,
      webhookId,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({ error: 'Failed to get webhook logs' });
  }
});

// SDK Downloads
router.get('/sdks', (req, res) => {
  const sdks = APIMarketplaceService.getAvailableSDKs();
  res.json({
    success: true,
    data: sdks
  });
});

// API Documentation
router.get('/docs', (req, res) => {
  const docs = APIMarketplaceService.getAPIDocumentation();
  res.json({
    success: true,
    data: docs
  });
});

router.get('/docs/endpoints', (req, res) => {
  const endpoints = APIMarketplaceService.getAvailableEndpoints();
  res.json({
    success: true,
    data: endpoints
  });
});

// API Usage Statistics
router.get('/usage', authenticate, async (req, res) => {
  try {
    const { dateRange } = req.query;
    const stats = await APIMarketplaceService.getAPIUsageStats(
      req.user.organizationId,
      dateRange ? JSON.parse(dateRange) : null
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting API usage stats:', error);
    res.status(500).json({ error: 'Failed to get API usage statistics' });
  }
});

// Test API Key
router.post('/test', validateAPIKey, checkRateLimit, async (req, res) => {
  const startTime = Date.now();

  // Log the API request
  setTimeout(() => {
    APIMarketplaceService.logAPIRequest(
      req.apiKeyData.keyId,
      req.path,
      req.method,
      200,
      Date.now() - startTime
    );
  }, 0);

  res.json({
    success: true,
    message: 'API key is valid',
    organization: req.apiKeyData.organizationId,
    permissions: req.apiKeyData.permissions
  });
});

// Public webhook endpoint for external services
router.post('/webhooks/trigger/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const result = await APIMarketplaceService.triggerWebhook(webhookId, event, data || {});

    if (result.success) {
      res.json({ success: true, message: 'Webhook triggered successfully' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to trigger webhook' });
    }
  } catch (error) {
    console.error('Error triggering webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;