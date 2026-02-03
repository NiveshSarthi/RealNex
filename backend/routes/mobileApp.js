const express = require('express');
const router = express.Router();
const MobileAppService = require('../services/mobileApp');
const { authenticate } = require('../middleware/auth');

// Get mobile app configuration
router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await MobileAppService.getMobileAppConfig(req.user.organizationId);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting mobile app config:', error);
    res.status(500).json({ error: 'Failed to get mobile app configuration' });
  }
});

// Update mobile app configuration
router.put('/config', authenticate, async (req, res) => {
  try {
    const config = req.body;
    const updatedConfig = await MobileAppService.updateMobileAppConfig(req.user.organizationId, config);

    res.json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating mobile app config:', error);
    res.status(500).json({ error: 'Failed to update mobile app configuration' });
  }
});

// Mobile Dashboard API
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const dashboard = await MobileAppService.getMobileDashboard(req.user.organizationId, req.user.id);
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting mobile dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Register device for push notifications
router.post('/device/register', authenticate, async (req, res) => {
  try {
    const { deviceToken, deviceType, deviceId, deviceModel, osVersion, appVersion } = req.body;

    if (!deviceToken || !deviceType || !deviceId) {
      return res.status(400).json({
        error: 'Device token, type, and ID are required'
      });
    }

    const device = await MobileAppService.registerDevice(
      req.user.id,
      deviceToken,
      deviceType,
      deviceId,
      deviceModel,
      osVersion,
      appVersion
    );

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Send push notification (admin endpoint)
router.post('/push/send', authenticate, async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!userIds || !title || !body) {
      return res.status(400).json({
        error: 'User IDs, title, and body are required'
      });
    }

    const result = await MobileAppService.sendPushNotification(userIds, title, body, data || {});

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// Offline data sync
router.get('/offline-data', authenticate, async (req, res) => {
  try {
    const offlineData = await MobileAppService.getOfflineData(req.user.id, req.user.organizationId);
    res.json({
      success: true,
      data: offlineData
    });
  } catch (error) {
    console.error('Error getting offline data:', error);
    res.status(500).json({ error: 'Failed to get offline data' });
  }
});

// Sync offline changes
router.post('/sync', authenticate, async (req, res) => {
  try {
    const { changes } = req.body;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({
        error: 'Changes array is required'
      });
    }

    const result = await MobileAppService.syncOfflineChanges(req.user.id, changes);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error syncing offline changes:', error);
    res.status(500).json({ error: 'Failed to sync changes' });
  }
});

// Track mobile app usage
router.post('/analytics/track', authenticate, async (req, res) => {
  try {
    const { eventType, eventData, deviceType, appVersion } = req.body;

    if (!eventType) {
      return res.status(400).json({
        error: 'Event type is required'
      });
    }

    await MobileAppService.trackMobileUsage(
      req.user.id,
      eventType,
      eventData || {},
      deviceType,
      appVersion
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error tracking mobile usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Get mobile app analytics
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const { dateRange } = req.query;
    const analytics = await MobileAppService.getMobileAnalytics(
      req.user.organizationId,
      dateRange ? JSON.parse(dateRange) : null
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting mobile analytics:', error);
    res.status(500).json({ error: 'Failed to get mobile analytics' });
  }
});

// App Store information
router.get('/app-store', (req, res) => {
  const appStoreInfo = MobileAppService.getAppStoreInfo();
  res.json({
    success: true,
    data: appStoreInfo
  });
});

// Generate mobile app configuration
router.get('/config/generate', authenticate, async (req, res) => {
  try {
    const config = MobileAppService.generateMobileConfig(req.user.organizationId);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error generating mobile config:', error);
    res.status(500).json({ error: 'Failed to generate mobile configuration' });
  }
});

// Mobile-specific API endpoints

// Quick actions
router.get('/quick-actions', authenticate, (req, res) => {
  const quickActions = MobileAppService.getQuickActions();
  res.json({
    success: true,
    data: quickActions
  });
});

// Recent conversations (mobile optimized)
router.get('/conversations/recent', authenticate, async (req, res) => {
  try {
    const { limit } = req.query;
    const conversations = await MobileAppService.getRecentConversations(
      req.user.organizationId,
      req.user.id,
      parseInt(limit) || 20
    );

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Mobile-optimized contact search
router.get('/contacts/search', authenticate, async (req, res) => {
  try {
    const { query: searchQuery, limit } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const { query } = require('../config/database');
    const result = await query(`
      SELECT id, first_name, last_name, whatsapp_number, email
      FROM contacts
      WHERE organization_id = $1
      AND (
        first_name ILIKE $2
        OR last_name ILIKE $2
        OR whatsapp_number ILIKE $2
        OR email ILIKE $2
      )
      ORDER BY last_contacted_at DESC
      LIMIT $3
    `, [req.user.organizationId, `%${searchQuery}%`, parseInt(limit) || 20]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

// Mobile-optimized message sending
router.post('/messages/send', authenticate, async (req, res) => {
  try {
    const { contactId, content, messageType } = req.body;

    if (!contactId || !content) {
      return res.status(400).json({
        error: 'Contact ID and content are required'
      });
    }

    // Get contact details
    const { query } = require('../config/database');
    const contactResult = await query(
      'SELECT * FROM contacts WHERE id = $1 AND organization_id = $2',
      [contactId, req.user.organizationId]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Contact not found'
      });
    }

    const contact = contactResult.rows[0];

    // Send message via WhatsApp service
    const WhatsAppService = require('../services/whatsapp');
    const result = await WhatsAppService.sendTextMessage(contact.whatsapp_number, content);

    if (result.success) {
      // Log the message
      await query(`
        INSERT INTO messages (conversation_id, contact_id, direction, message_type, content, channel, sent_at)
        VALUES (
          (SELECT id FROM conversations WHERE contact_id = $1 LIMIT 1),
          $1, 'outbound', $2, $3, 'whatsapp', NOW()
        )
      `, [contactId, messageType || 'text', content]);

      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          status: 'sent'
        }
      });
    } else {
      res.status(500).json({
        error: 'Failed to send message',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Error sending mobile message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;