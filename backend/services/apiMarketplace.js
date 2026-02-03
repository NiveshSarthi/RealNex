const { query } = require('../config/database');
const crypto = require('crypto');

class APIMarketplaceService {
  // API Key Management

  // Generate API key for organization
  async generateAPIKey(organizationId, name, permissions = []) {
    try {
      const apiKey = this.generateSecureKey();
      const keyId = crypto.randomUUID();

      const result = await query(`
        INSERT INTO api_keys (key_id, organization_id, name, api_key, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `, [keyId, organizationId, name, apiKey, JSON.stringify(permissions)]);

      return {
        keyId: result.rows[0].key_id,
        apiKey: result.rows[0].api_key,
        name: result.rows[0].name,
        permissions: permissions,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      console.error('Error generating API key:', error);
      throw error;
    }
  }

  // Get API keys for organization
  async getAPIKeys(organizationId) {
    try {
      const result = await query(
        'SELECT key_id, name, permissions, is_active, created_at, last_used_at FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC',
        [organizationId]
      );

      return result.rows.map(row => ({
        ...row,
        permissions: JSON.parse(row.permissions || '[]')
      }));
    } catch (error) {
      console.error('Error getting API keys:', error);
      throw error;
    }
  }

  // Validate API key
  async validateAPIKey(apiKey) {
    try {
      const result = await query(
        'SELECT * FROM api_keys WHERE api_key = $1 AND is_active = true',
        [apiKey]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const keyData = result.rows[0];

      // Update last used timestamp
      await query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE key_id = $1',
        [keyData.key_id]
      );

      return {
        keyId: keyData.key_id,
        organizationId: keyData.organization_id,
        permissions: JSON.parse(keyData.permissions || '[]'),
        name: keyData.name
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  // Revoke API key
  async revokeAPIKey(organizationId, keyId) {
    try {
      const result = await query(
        'UPDATE api_keys SET is_active = false WHERE key_id = $1 AND organization_id = $2 RETURNING *',
        [keyId, organizationId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }

  // Generate secure API key
  generateSecureKey() {
    return 'sk_' + crypto.randomBytes(32).toString('hex');
  }

  // Webhook Management

  // Register webhook
  async registerWebhook(organizationId, webhookData) {
    try {
      const { url, events, secret, name, isActive } = webhookData;
      const webhookId = crypto.randomUUID();

      // Generate webhook secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

      const result = await query(`
        INSERT INTO webhooks (webhook_id, organization_id, name, url, events, secret, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [webhookId, organizationId, name, url, JSON.stringify(events), webhookSecret, isActive !== false]);

      return {
        webhookId: result.rows[0].webhook_id,
        name: result.rows[0].name,
        url: result.rows[0].url,
        events: events,
        secret: webhookSecret,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      console.error('Error registering webhook:', error);
      throw error;
    }
  }

  // Get webhooks for organization
  async getWebhooks(organizationId) {
    try {
      const result = await query(
        'SELECT webhook_id, name, url, events, is_active, created_at, last_triggered_at FROM webhooks WHERE organization_id = $1 ORDER BY created_at DESC',
        [organizationId]
      );

      return result.rows.map(row => ({
        ...row,
        events: JSON.parse(row.events || '[]')
      }));
    } catch (error) {
      console.error('Error getting webhooks:', error);
      throw error;
    }
  }

  // Trigger webhook
  async triggerWebhook(webhookId, eventType, data) {
    try {
      // Get webhook details
      const webhookResult = await query(
        'SELECT * FROM webhooks WHERE webhook_id = $1 AND is_active = true',
        [webhookId]
      );

      if (webhookResult.rows.length === 0) {
        return { success: false, error: 'Webhook not found or inactive' };
      }

      const webhook = webhookResult.rows[0];
      const events = JSON.parse(webhook.events || '[]');

      // Check if webhook is subscribed to this event
      if (!events.includes(eventType) && !events.includes('*')) {
        return { success: true, message: 'Event not subscribed' };
      }

      // Prepare payload
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: data
      };

      // Generate signature
      const signature = this.generateWebhookSignature(payload, webhook.secret);

      // Send webhook
      const axios = require('axios');
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhookId,
          'User-Agent': 'WhatsApp-Automation-Webhook/1.0'
        },
        timeout: 10000 // 10 second timeout
      });

      // Update last triggered timestamp
      await query(
        'UPDATE webhooks SET last_triggered_at = NOW() WHERE webhook_id = $1',
        [webhookId]
      );

      // Log webhook delivery
      await this.logWebhookDelivery(webhookId, eventType, 'success', response.status);

      return {
        success: true,
        statusCode: response.status,
        response: response.data
      };

    } catch (error) {
      console.error('Error triggering webhook:', error);

      // Log failed delivery
      await this.logWebhookDelivery(webhookId, eventType, 'failed', error.response?.status || 0, error.message);

      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  // Generate webhook signature
  generateWebhookSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  // Log webhook delivery
  async logWebhookDelivery(webhookId, eventType, status, statusCode, errorMessage = null) {
    try {
      await query(`
        INSERT INTO webhook_logs (webhook_id, event_type, status, status_code, error_message, delivered_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [webhookId, eventType, status, statusCode, errorMessage]);
    } catch (error) {
      console.error('Error logging webhook delivery:', error);
    }
  }

  // Get webhook delivery logs
  async getWebhookLogs(organizationId, webhookId = null, limit = 50) {
    try {
      let queryText = `
        SELECT wl.*, w.name as webhook_name
        FROM webhook_logs wl
        JOIN webhooks w ON wl.webhook_id = w.webhook_id
        WHERE w.organization_id = $1
      `;
      const params = [organizationId];

      if (webhookId) {
        queryText += ' AND wl.webhook_id = $2';
        params.push(webhookId);
      }

      queryText += ' ORDER BY wl.delivered_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting webhook logs:', error);
      throw error;
    }
  }

  // SDK Management

  // Get available SDKs
  getAvailableSDKs() {
    return [
      {
        id: 'javascript',
        name: 'JavaScript SDK',
        language: 'JavaScript',
        version: '1.0.0',
        description: 'Official JavaScript SDK for WhatsApp Automation API',
        downloadUrl: '/sdk/whatsapp-automation-js-1.0.0.tgz',
        documentationUrl: '/docs/sdk/javascript',
        features: [
          'Message sending',
          'Contact management',
          'Campaign management',
          'Real-time webhooks',
          'Analytics integration'
        ]
      },
      {
        id: 'python',
        name: 'Python SDK',
        language: 'Python',
        version: '1.0.0',
        description: 'Official Python SDK for WhatsApp Automation API',
        downloadUrl: '/sdk/whatsapp-automation-py-1.0.0.tar.gz',
        documentationUrl: '/docs/sdk/python',
        features: [
          'Message sending',
          'Contact management',
          'Campaign management',
          'Real-time webhooks',
          'Analytics integration',
          'Async support'
        ]
      },
      {
        id: 'php',
        name: 'PHP SDK',
        language: 'PHP',
        version: '1.0.0',
        description: 'Official PHP SDK for WhatsApp Automation API',
        downloadUrl: '/sdk/whatsapp-automation-php-1.0.0.zip',
        documentationUrl: '/docs/sdk/php',
        features: [
          'Message sending',
          'Contact management',
          'Campaign management',
          'Real-time webhooks'
        ]
      }
    ];
  }

  // API Marketplace

  // Get available API endpoints
  getAvailableEndpoints() {
    return {
      messaging: {
        name: 'Messaging API',
        description: 'Send and receive WhatsApp messages',
        endpoints: [
          { method: 'POST', path: '/api/whatsapp/send', description: 'Send text message' },
          { method: 'POST', path: '/api/whatsapp/send-media', description: 'Send media message' },
          { method: 'POST', path: '/api/whatsapp/send-template', description: 'Send template message' },
          { method: 'GET', path: '/api/whatsapp/messages', description: 'Get message history' }
        ]
      },
      contacts: {
        name: 'Contact Management API',
        description: 'Manage contacts and lead information',
        endpoints: [
          { method: 'GET', path: '/api/contacts', description: 'List contacts' },
          { method: 'POST', path: '/api/contacts', description: 'Create contact' },
          { method: 'PUT', path: '/api/contacts/{id}', description: 'Update contact' },
          { method: 'GET', path: '/api/contacts/{id}', description: 'Get contact details' }
        ]
      },
      campaigns: {
        name: 'Campaign Management API',
        description: 'Create and manage marketing campaigns',
        endpoints: [
          { method: 'POST', path: '/api/campaigns', description: 'Create campaign' },
          { method: 'GET', path: '/api/campaigns', description: 'List campaigns' },
          { method: 'POST', path: '/api/campaigns/{id}/send', description: 'Send campaign' },
          { method: 'GET', path: '/api/campaigns/{id}/analytics', description: 'Get campaign analytics' }
        ]
      },
      analytics: {
        name: 'Analytics API',
        description: 'Access performance and analytics data',
        endpoints: [
          { method: 'GET', path: '/api/analytics/dashboard', description: 'Get dashboard data' },
          { method: 'GET', path: '/api/analytics/leads', description: 'Get lead analytics' },
          { method: 'GET', path: '/api/analytics/campaigns', description: 'Get campaign analytics' },
          { method: 'POST', path: '/api/analytics/predict-conversion', description: 'Predict lead conversion' }
        ]
      },
      calculators: {
        name: 'Calculator API',
        description: 'Access financial and property calculators',
        endpoints: [
          { method: 'POST', path: '/api/calculator/emi', description: 'Calculate EMI' },
          { method: 'POST', path: '/api/calculator/property-valuation', description: 'Property valuation' },
          { method: 'POST', path: '/api/calculator/affordability', description: 'Affordability check' }
        ]
      }
    };
  }

  // Rate Limiting

  // Check rate limit for API key
  async checkRateLimit(keyId, endpoint) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get request count in the last hour
      const result = await query(`
        SELECT COUNT(*) as request_count
        FROM api_logs
        WHERE key_id = $1 AND endpoint = $2 AND created_at >= $3
      `, [keyId, endpoint, oneHourAgo]);

      const requestCount = parseInt(result.rows[0].request_count);

      // Define rate limits by endpoint
      const rateLimits = {
        '/api/whatsapp/send': 1000, // 1000 messages per hour
        '/api/contacts': 5000,      // 5000 contact operations per hour
        '/api/campaigns': 100,      // 100 campaign operations per hour
        '/api/analytics': 10000,    // 10000 analytics requests per hour
        default: 1000
      };

      const limit = rateLimits[endpoint] || rateLimits.default;

      return {
        allowed: requestCount < limit,
        currentUsage: requestCount,
        limit: limit,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true, currentUsage: 0, limit: 1000 };
    }
  }

  // Log API request
  async logAPIRequest(keyId, endpoint, method, statusCode, responseTime) {
    try {
      await query(`
        INSERT INTO api_logs (key_id, endpoint, method, status_code, response_time, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [keyId, endpoint, method, statusCode, responseTime]);
    } catch (error) {
      console.error('Error logging API request:', error);
    }
  }

  // API Usage Analytics

  // Get API usage statistics
  async getAPIUsageStats(organizationId, dateRange = null) {
    try {
      let queryText = `
        SELECT
          DATE(created_at) as date,
          endpoint,
          method,
          COUNT(*) as total_requests,
          AVG(response_time) as avg_response_time,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
        FROM api_logs al
        JOIN api_keys ak ON al.key_id = ak.key_id
        WHERE ak.organization_id = $1
      `;
      const params = [organizationId];

      if (dateRange) {
        queryText += ' AND al.created_at BETWEEN $2 AND $3';
        params.push(dateRange.start, dateRange.end);
      }

      queryText += ' GROUP BY DATE(created_at), endpoint, method ORDER BY date DESC, total_requests DESC';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting API usage stats:', error);
      throw error;
    }
  }

  // Documentation

  // Get API documentation
  getAPIDocumentation() {
    return {
      baseUrl: process.env.API_BASE_URL || 'https://api.whatsapp-automation.com',
      version: 'v1',
      authentication: {
        type: 'Bearer Token',
        description: 'Include your API key in the Authorization header',
        example: 'Authorization: Bearer sk_your_api_key_here'
      },
      rateLimiting: {
        description: 'Rate limits vary by endpoint. Check the X-RateLimit headers in responses.',
        headers: {
          'X-RateLimit-Limit': 'Maximum requests per hour',
          'X-RateLimit-Remaining': 'Remaining requests',
          'X-RateLimit-Reset': 'Time when limit resets (Unix timestamp)'
        }
      },
      errorHandling: {
        400: 'Bad Request - Invalid parameters',
        401: 'Unauthorized - Invalid API key',
        403: 'Forbidden - Insufficient permissions',
        404: 'Not Found - Resource not found',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error'
      },
      webhooks: {
        signature: 'X-Webhook-Signature header contains HMAC-SHA256 signature',
        retryPolicy: 'Failed webhooks are retried up to 3 times with exponential backoff'
      }
    };
  }
}

module.exports = new APIMarketplaceService();