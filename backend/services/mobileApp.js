const { query } = require('../config/database');

class MobileAppService {
  // Mobile App Configuration

  // Get mobile app configuration for organization
  async getMobileAppConfig(organizationId) {
    try {
      const result = await query(
        'SELECT * FROM mobile_app_configs WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return this.getDefaultMobileAppConfig();
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting mobile app config:', error);
      return this.getDefaultMobileAppConfig();
    }
  }

  // Update mobile app configuration
  async updateMobileAppConfig(organizationId, config) {
    try {
      const fields = [];
      const values = [organizationId];
      let paramCount = 2;

      Object.keys(config).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(config[key]);
        paramCount++;
      });

      values.push(organizationId);

      const result = await query(`
        INSERT INTO mobile_app_configs (organization_id, ${Object.keys(config).join(', ')})
        VALUES ($1, ${Object.keys(config).map((_, i) => `$${i + 2}`).join(', ')})
        ON CONFLICT (organization_id)
        DO UPDATE SET ${fields.join(', ')}, updated_at = NOW()
        RETURNING *
      `, values);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating mobile app config:', error);
      throw error;
    }
  }

  // Get default mobile app configuration
  getDefaultMobileAppConfig() {
    return {
      organization_id: null,
      app_name: 'Business Chat',
      app_icon_url: '/default-app-icon.png',
      splash_screen_color: '#6c5ce7',
      primary_color: '#6c5ce7',
      secondary_color: '#00d4ff',
      accent_color: '#00f593',
      custom_splash_text: 'Loading...',
      enable_push_notifications: true,
      enable_offline_mode: false,
      enable_biometric_auth: false,
      enable_location_tracking: false,
      custom_features: [],
      supported_languages: ['en'],
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Mobile App API Endpoints

  // Get dashboard data for mobile app
  async getMobileDashboard(organizationId, userId) {
    try {
      // Get user's key metrics
      const metrics = await this.getUserMetrics(userId);

      // Get recent conversations
      const conversations = await this.getRecentConversations(organizationId, userId);

      // Get pending tasks
      const tasks = await this.getPendingTasks(userId);

      // Get quick actions
      const quickActions = this.getQuickActions();

      return {
        metrics,
        conversations,
        tasks,
        quickActions,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting mobile dashboard:', error);
      throw error;
    }
  }

  // Get user metrics for mobile dashboard
  async getUserMetrics(userId) {
    try {
      // Conversations today
      const todayConversations = await query(`
        SELECT COUNT(*) as count
        FROM conversations c
        JOIN conversation_assignments ca ON c.id = ca.conversation_id
        WHERE ca.user_id = $1 AND DATE(c.created_at) = CURRENT_DATE
      `, [userId]);

      // Pending tasks
      const pendingTasks = await query(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE assigned_to = $1 AND status = 'pending'
      `, [userId]);

      // Response time (last 7 days)
      const responseTime = await query(`
        SELECT AVG(EXTRACT(EPOCH FROM (m.created_at - prev_m.created_at))) as avg_response_time
        FROM messages m
        LEFT JOIN messages prev_m ON m.conversation_id = prev_m.conversation_id
          AND prev_m.created_at < m.created_at
          AND prev_m.direction != m.direction
        WHERE m.created_at >= NOW() - INTERVAL '7 days'
        AND m.direction = 'outbound'
      `);

      return {
        conversationsToday: parseInt(todayConversations.rows[0].count),
        pendingTasks: parseInt(pendingTasks.rows[0].count),
        avgResponseTime: Math.round(parseFloat(responseTime.rows[0].avg_response_time || 0) / 60), // in minutes
        activeConversations: 0 // Would be calculated based on recent activity
      };
    } catch (error) {
      console.error('Error getting user metrics:', error);
      return {
        conversationsToday: 0,
        pendingTasks: 0,
        avgResponseTime: 0,
        activeConversations: 0
      };
    }
  }

  // Get recent conversations for mobile
  async getRecentConversations(organizationId, userId, limit = 10) {
    try {
      const result = await query(`
        SELECT
          c.id,
          c.status,
          c.last_message_at,
          cont.first_name,
          cont.last_name,
          cont.whatsapp_number,
          m.content as last_message,
          m.direction as last_message_direction
        FROM conversations c
        JOIN contacts cont ON c.contact_id = cont.id
        LEFT JOIN conversation_assignments ca ON c.id = ca.conversation_id AND ca.user_id = $2
        LEFT JOIN LATERAL (
          SELECT content, direction
          FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        WHERE c.organization_id = $1
        AND (ca.user_id = $2 OR ca.user_id IS NULL)
        ORDER BY c.last_message_at DESC
        LIMIT $3
      `, [organizationId, userId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        status: row.status,
        contactName: `${row.first_name} ${row.last_name || ''}`.trim(),
        contactNumber: row.whatsapp_number,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_at,
        isFromContact: row.last_message_direction === 'inbound',
        unreadCount: 0 // Would be calculated
      }));
    } catch (error) {
      console.error('Error getting recent conversations:', error);
      return [];
    }
  }

  // Get pending tasks for mobile
  async getPendingTasks(userId) {
    try {
      // This would integrate with a task management system
      // For now, return sample tasks
      return [
        {
          id: 'task_1',
          title: 'Follow up with lead',
          description: 'Call Mr. Sharma regarding property inquiry',
          priority: 'high',
          dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          type: 'call'
        },
        {
          id: 'task_2',
          title: 'Site visit reminder',
          description: 'Send reminder for tomorrow\'s site visit',
          priority: 'medium',
          dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          type: 'reminder'
        }
      ];
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }

  // Get quick actions for mobile
  getQuickActions() {
    return [
      {
        id: 'new_message',
        title: 'New Message',
        icon: '💬',
        action: 'compose'
      },
      {
        id: 'quick_reply',
        title: 'Quick Reply',
        icon: '⚡',
        action: 'quick_reply'
      },
      {
        id: 'schedule_visit',
        title: 'Schedule Visit',
        icon: '📅',
        action: 'schedule'
      },
      {
        id: 'calculator',
        title: 'Calculator',
        icon: '🧮',
        action: 'calculator'
      },
      {
        id: 'contacts',
        title: 'Contacts',
        icon: '👥',
        action: 'contacts'
      },
      {
        id: 'analytics',
        title: 'Analytics',
        icon: '📊',
        action: 'analytics'
      }
    ];
  }

  // Push Notification Management

  // Register device for push notifications
  async registerDevice(userId, deviceToken, deviceType, deviceId) {
    try {
      const result = await query(`
        INSERT INTO mobile_devices (user_id, device_token, device_type, device_id, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (device_id)
        DO UPDATE SET device_token = EXCLUDED.device_token, updated_at = NOW()
        RETURNING *
      `, [userId, deviceToken, deviceType, deviceId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  // Send push notification
  async sendPushNotification(userIds, title, body, data = {}) {
    try {
      // Get device tokens for users
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await query(`
        SELECT device_token, device_type
        FROM mobile_devices
        WHERE user_id IN (${placeholders}) AND is_active = true
      `, userIds);

      const devices = result.rows;

      // Group by device type
      const iosDevices = devices.filter(d => d.device_type === 'ios');
      const androidDevices = devices.filter(d => d.device_type === 'android');

      // Send to iOS devices (would integrate with APNs)
      if (iosDevices.length > 0) {
        await this.sendIOSPushNotification(iosDevices, title, body, data);
      }

      // Send to Android devices (would integrate with FCM)
      if (androidDevices.length > 0) {
        await this.sendAndroidPushNotification(androidDevices, title, body, data);
      }

      // Log notification
      await this.logPushNotification(userIds, title, body, devices.length);

      return { success: true, devicesSent: devices.length };
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Send iOS push notification (placeholder)
  async sendIOSPushNotification(devices, title, body, data) {
    // Implementation would use APNs
    console.log(`Sending iOS push to ${devices.length} devices: ${title}`);
  }

  // Send Android push notification (placeholder)
  async sendAndroidPushNotification(devices, title, body, data) {
    // Implementation would use FCM
    console.log(`Sending Android push to ${devices.length} devices: ${title}`);
  }

  // Log push notification
  async logPushNotification(userIds, title, body, deviceCount) {
    try {
      await query(`
        INSERT INTO push_notifications (user_ids, title, body, device_count, sent_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [JSON.stringify(userIds), title, body, deviceCount]);
    } catch (error) {
      console.error('Error logging push notification:', error);
    }
  }

  // Offline Data Sync

  // Get offline data for mobile app
  async getOfflineData(userId, organizationId) {
    try {
      // Get essential data for offline use
      const [conversations, contacts, templates] = await Promise.all([
        this.getRecentConversations(organizationId, userId, 50),
        this.getContactsForOffline(organizationId),
        this.getTemplatesForOffline(organizationId)
      ]);

      return {
        conversations,
        contacts,
        templates,
        lastSync: new Date()
      };
    } catch (error) {
      console.error('Error getting offline data:', error);
      throw error;
    }
  }

  // Get contacts for offline use
  async getContactsForOffline(organizationId) {
    try {
      const result = await query(`
        SELECT id, first_name, last_name, whatsapp_number, email
        FROM contacts
        WHERE organization_id = $1
        ORDER BY last_contacted_at DESC
        LIMIT 100
      `, [organizationId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting contacts for offline:', error);
      return [];
    }
  }

  // Get templates for offline use
  async getTemplatesForOffline(organizationId) {
    try {
      const result = await query(`
        SELECT id, name, content
        FROM templates
        WHERE organization_id = $1 OR is_global = true
        ORDER BY created_at DESC
        LIMIT 50
      `, [organizationId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting templates for offline:', error);
      return [];
    }
  }

  // Sync offline changes
  async syncOfflineChanges(userId, changes) {
    try {
      const results = [];

      for (const change of changes) {
        switch (change.type) {
          case 'message':
            results.push(await this.syncMessage(change.data));
            break;
          case 'contact':
            results.push(await this.syncContact(change.data));
            break;
          case 'task':
            results.push(await this.syncTask(change.data));
            break;
        }
      }

      return {
        success: true,
        synced: results.length,
        results
      };
    } catch (error) {
      console.error('Error syncing offline changes:', error);
      throw error;
    }
  }

  // Mobile App Analytics

  // Track mobile app usage
  async trackMobileUsage(userId, eventType, eventData) {
    try {
      await query(`
        INSERT INTO mobile_analytics (user_id, event_type, event_data, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, eventType, JSON.stringify(eventData)]);
    } catch (error) {
      console.error('Error tracking mobile usage:', error);
    }
  }

  // Get mobile app analytics
  async getMobileAnalytics(organizationId, dateRange = null) {
    try {
      let queryText = `
        SELECT
          DATE(created_at) as date,
          event_type,
          COUNT(*) as event_count
        FROM mobile_analytics ma
        JOIN users u ON ma.user_id = u.id
        WHERE u.organization_id = $1
      `;
      const params = [organizationId];

      if (dateRange) {
        queryText += ' AND ma.created_at BETWEEN $2 AND $3';
        params.push(dateRange.start, dateRange.end);
      }

      queryText += ' GROUP BY DATE(created_at), event_type ORDER BY date DESC';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting mobile analytics:', error);
      throw error;
    }
  }

  // App Store Integration

  // Get app store information
  getAppStoreInfo() {
    return {
      ios: {
        appId: 'com.whatsapp.automation.mobile',
        name: 'WhatsApp Automation Mobile',
        version: '1.0.0',
        downloadUrl: 'https://apps.apple.com/app/whatsapp-automation-mobile',
        features: [
          'Real-time messaging',
          'AI-powered responses',
          'Appointment scheduling',
          'Property calculators',
          'Offline mode',
          'Push notifications'
        ]
      },
      android: {
        packageName: 'com.whatsapp.automation.mobile',
        name: 'WhatsApp Automation Mobile',
        version: '1.0.0',
        downloadUrl: 'https://play.google.com/store/apps/details/whatsapp-automation-mobile',
        features: [
          'Real-time messaging',
          'AI-powered responses',
          'Appointment scheduling',
          'Property calculators',
          'Offline mode',
          'Push notifications'
        ]
      }
    };
  }

  // Generate mobile app configuration
  generateMobileConfig(organizationId) {
    // This would generate a configuration file for the mobile app
    return {
      apiBaseUrl: process.env.API_BASE_URL,
      organizationId,
      features: {
        messaging: true,
        scheduling: true,
        calculators: true,
        analytics: true,
        offlineMode: true,
        pushNotifications: true
      },
      branding: {
        // Would integrate with white-label service
        primaryColor: '#6c5ce7',
        secondaryColor: '#00d4ff'
      }
    };
  }
}

module.exports = new MobileAppService();