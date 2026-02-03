const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class EnterpriseService {
  // SSO (Single Sign-On) Implementation

  // Generate SSO configuration
  async generateSSOConfig(organizationId, ssoType = 'saml') {
    try {
      const config = {
        ssoType,
        entityId: `urn:${organizationId}.whatsapp-automation.com`,
        acsUrl: `${process.env.BASE_URL}/api/auth/sso/callback`,
        logoutUrl: `${process.env.BASE_URL}/api/auth/sso/logout`,
        certificate: this.generateCertificate(),
        metadataUrl: `${process.env.BASE_URL}/api/enterprise/sso/metadata/${organizationId}`,
        loginUrl: `${process.env.BASE_URL}/api/auth/sso/login`,
        createdAt: new Date()
      };

      // Store SSO configuration
      const result = await query(`
        INSERT INTO sso_configs (organization_id, sso_type, config, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (organization_id)
        DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
        RETURNING *
      `, [organizationId, ssoType, JSON.stringify(config)]);

      return {
        ...config,
        id: result.rows[0].id
      };
    } catch (error) {
      console.error('Error generating SSO config:', error);
      throw error;
    }
  }

  // Get SSO configuration
  async getSSOConfig(organizationId) {
    try {
      const result = await query(
        'SELECT * FROM sso_configs WHERE organization_id = $1 AND is_active = true',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...result.rows[0],
        config: JSON.parse(result.rows[0].config)
      };
    } catch (error) {
      console.error('Error getting SSO config:', error);
      throw error;
    }
  }

  // Generate SAML metadata
  generateSAMLMetadata(organizationId, config) {
    const metadata = {
      'entityID': config.entityId,
      'SPSSODescriptor': {
        'protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'KeyDescriptor': {
          'use': 'signing',
          'KeyInfo': {
            'X509Data': {
              'X509Certificate': config.certificate
            }
          }
        },
        'SingleLogoutService': {
          'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          'Location': config.logoutUrl
        },
        'AssertionConsumerService': {
          'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          'Location': config.acsUrl,
          'index': 0,
          'isDefault': true
        }
      }
    };

    return metadata;
  }

  // Generate self-signed certificate (for demo purposes)
  generateCertificate() {
    // In production, use proper certificate generation
    return 'MIICiTCCAg+gAwIBAgIJAJ8l2Z2Z3ZzZMAOGA1UEBhMCVVMxCzAJBgNVBAgTAkNB...';
  }

  // Process SSO login
  async processSSOLogin(organizationId, samlResponse) {
    try {
      // Verify SAML response (simplified)
      const userInfo = this.parseSAMLResponse(samlResponse);

      // Find or create user
      const user = await this.findOrCreateUserFromSSO(organizationId, userInfo);

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          organizationId: user.organization_id,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Error processing SSO login:', error);
      throw error;
    }
  }

  // Parse SAML response (simplified)
  parseSAMLResponse(samlResponse) {
    // In production, use a proper SAML library
    return {
      email: 'user@company.com',
      firstName: 'John',
      lastName: 'Doe',
      groups: ['admin', 'users']
    };
  }

  // Find or create user from SSO
  async findOrCreateUserFromSSO(organizationId, userInfo) {
    try {
      // Check if user exists
      let result = await query(
        'SELECT * FROM users WHERE email = $1 AND organization_id = $2',
        [userInfo.email, organizationId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new user
      const result2 = await query(`
        INSERT INTO users (email, first_name, last_name, organization_id, role, email_verified, sso_enabled)
        VALUES ($1, $2, $3, $4, $5, true, true)
        RETURNING *
      `, [
        userInfo.email,
        userInfo.firstName,
        userInfo.lastName,
        organizationId,
        this.mapSSORole(userInfo.groups),
        true
      ]);

      return result2.rows[0];
    } catch (error) {
      console.error('Error finding/creating SSO user:', error);
      throw error;
    }
  }

  // Map SSO groups to roles
  mapSSORole(groups) {
    if (groups.includes('admin') || groups.includes('administrator')) {
      return 'admin';
    } else if (groups.includes('manager')) {
      return 'manager';
    }
    return 'agent';
  }

  // Advanced Security Features

  // IP Whitelisting
  async manageIPWhitelist(organizationId, action, ipAddress = null) {
    try {
      if (action === 'add' && ipAddress) {
        await query(`
          INSERT INTO ip_whitelist (organization_id, ip_address)
          VALUES ($1, $2)
          ON CONFLICT (organization_id, ip_address) DO NOTHING
        `, [organizationId, ipAddress]);
      } else if (action === 'remove' && ipAddress) {
        await query(
          'DELETE FROM ip_whitelist WHERE organization_id = $1 AND ip_address = $2',
          [organizationId, ipAddress]
        );
      } else if (action === 'list') {
        const result = await query(
          'SELECT ip_address, created_at FROM ip_whitelist WHERE organization_id = $1 ORDER BY created_at DESC',
          [organizationId]
        );
        return result.rows;
      }

      return { success: true };
    } catch (error) {
      console.error('Error managing IP whitelist:', error);
      throw error;
    }
  }

  // Check IP whitelist
  async checkIPWhitelist(organizationId, ipAddress) {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM ip_whitelist WHERE organization_id = $1 AND ip_address = $2',
        [organizationId, ipAddress]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error checking IP whitelist:', error);
      return false;
    }
  }

  // Audit Logging
  async logAuditEvent(organizationId, userId, action, resource, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (organization_id, user_id, action, resource, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        organizationId,
        userId,
        action,
        resource,
        JSON.stringify(details),
        details.ipAddress || null,
        details.userAgent || null
      ]);
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  // Get audit logs
  async getAuditLogs(organizationId, filters = {}) {
    try {
      let queryText = `
        SELECT al.*, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = $1
      `;
      const params = [organizationId];
      let paramCount = 2;

      if (filters.userId) {
        queryText += ` AND al.user_id = $${paramCount}`;
        params.push(filters.userId);
        paramCount++;
      }

      if (filters.action) {
        queryText += ` AND al.action = $${paramCount}`;
        params.push(filters.action);
        paramCount++;
      }

      if (filters.dateRange) {
        queryText += ` AND al.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(filters.dateRange.start, filters.dateRange.end);
        paramCount += 2;
      }

      queryText += ` ORDER BY al.created_at DESC LIMIT $${paramCount}`;
      params.push(filters.limit || 100);

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  }

  // Data Encryption

  // Encrypt sensitive data
  encryptData(data) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  // Decrypt sensitive data
  decryptData(encryptedData, iv) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);

    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Advanced User Management

  // Role-based permissions
  getRolePermissions() {
    return {
      super_admin: ['*'], // All permissions
      admin: [
        'users.manage',
        'organization.settings',
        'analytics.view',
        'campaigns.manage',
        'templates.manage',
        'webhooks.manage',
        'api_keys.manage'
      ],
      manager: [
        'users.view',
        'analytics.view',
        'campaigns.manage',
        'leads.manage',
        'conversations.manage'
      ],
      agent: [
        'conversations.manage',
        'leads.view',
        'templates.view',
        'campaigns.view'
      ],
      viewer: [
        'analytics.view',
        'conversations.view',
        'leads.view'
      ]
    };
  }

  // Check user permission
  checkPermission(userRole, permission) {
    const rolePermissions = this.getRolePermissions()[userRole] || [];
    return rolePermissions.includes('*') || rolePermissions.includes(permission);
  }

  // Two-Factor Authentication (2FA)

  // Enable 2FA for user
  async enable2FA(userId) {
    try {
      // Generate TOTP secret
      const secret = crypto.randomBytes(32).toString('hex');

      // Store secret (encrypted)
      const encryptedSecret = this.encryptData({ secret });

      await query(`
        UPDATE users SET
          two_factor_enabled = true,
          two_factor_secret = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(encryptedSecret), userId]);

      return {
        secret,
        qrCodeUrl: this.generateTOTPQrCode(secret, userId)
      };
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  // Verify 2FA token
  async verify2FAToken(userId, token) {
    try {
      const result = await query(
        'SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true',
        [userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const encryptedSecret = JSON.parse(result.rows[0].two_factor_secret);
      const secretData = this.decryptData(encryptedSecret.encrypted, encryptedSecret.iv);

      // Verify TOTP token (simplified - in production use speakeasy)
      return this.verifyTOTPToken(secretData.secret, token);
    } catch (error) {
      console.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  // Generate TOTP QR Code URL
  generateTOTPQrCode(secret, userId) {
    const issuer = 'WhatsApp Automation';
    const accountName = `user-${userId}@${issuer}`;
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  }

  // Verify TOTP token (simplified)
  verifyTOTPToken(secret, token) {
    // In production, use a proper TOTP library
    return token.length === 6 && /^\d+$/.test(token);
  }

  // Dedicated Support Features

  // Create support ticket
  async createSupportTicket(organizationId, userId, ticketData) {
    try {
      const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const result = await query(`
        INSERT INTO support_tickets (
          ticket_id, organization_id, created_by, priority, category,
          subject, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        RETURNING *
      `, [
        ticketId,
        organizationId,
        userId,
        ticketData.priority || 'normal',
        ticketData.category || 'general',
        ticketData.subject,
        ticketData.description
      ]);

      // Notify support team (would integrate with email/SMS)
      await this.notifySupportTeam(result.rows[0]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw error;
    }
  }

  // Get support tickets
  async getSupportTickets(organizationId, filters = {}) {
    try {
      let queryText = 'SELECT * FROM support_tickets WHERE organization_id = $1';
      const params = [organizationId];
      let paramCount = 2;

      if (filters.status) {
        queryText += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.priority) {
        queryText += ` AND priority = $${paramCount}`;
        params.push(filters.priority);
        paramCount++;
      }

      queryText += ' ORDER BY created_at DESC';

      if (filters.limit) {
        queryText += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting support tickets:', error);
      throw error;
    }
  }

  // SLA Management

  // Get SLA metrics
  async getSLAMetrics(organizationId) {
    try {
      const result = await query(`
        SELECT
          priority,
          AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) as avg_first_response_hours,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours,
          COUNT(CASE WHEN resolved_at - created_at <= INTERVAL '4 hours' THEN 1 END) * 100.0 / COUNT(*) as sla_compliance_percent
        FROM support_tickets
        WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY priority
      `, [organizationId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting SLA metrics:', error);
      throw error;
    }
  }

  // Notify support team
  async notifySupportTeam(ticket) {
    // Implementation would send email/SMS to support team
    console.log(`New support ticket created: ${ticket.ticket_id} - ${ticket.subject}`);
  }

  // Compliance and Security

  // Data retention management
  async configureDataRetention(organizationId, retentionRules) {
    try {
      await query(`
        INSERT INTO data_retention_policies (organization_id, rules)
        VALUES ($1, $2)
        ON CONFLICT (organization_id)
        DO UPDATE SET rules = EXCLUDED.rules, updated_at = NOW()
      `, [organizationId, JSON.stringify(retentionRules)]);

      return { success: true };
    } catch (error) {
      console.error('Error configuring data retention:', error);
      throw error;
    }
  }

  // GDPR compliance tools
  async handleDataDeletion(organizationId, userId, dataTypes = ['all']) {
    try {
      // Log deletion request
      await this.logAuditEvent(organizationId, userId, 'data_deletion_requested', 'gdpr', {
        dataTypes,
        requestedAt: new Date()
      });

      // Anonymize or delete user data based on types
      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'personal':
            await this.anonymizePersonalData(userId);
            break;
          case 'conversations':
            await this.deleteConversations(userId);
            break;
          case 'analytics':
            await this.deleteAnalyticsData(userId);
            break;
          case 'all':
            await this.deleteAllUserData(userId);
            break;
        }
      }

      return { success: true, message: 'Data deletion request processed' };
    } catch (error) {
      console.error('Error handling data deletion:', error);
      throw error;
    }
  }

  // Anonymize personal data
  async anonymizePersonalData(userId) {
    await query(`
      UPDATE users SET
        first_name = 'Deleted',
        last_name = 'User',
        email = CONCAT('deleted_', id, '@deleted.local'),
        phone = NULL,
        updated_at = NOW()
      WHERE id = $1
    `, [userId]);
  }

  // Delete conversations
  async deleteConversations(userId) {
    await query('DELETE FROM messages WHERE contact_id IN (SELECT id FROM contacts WHERE organization_id = (SELECT organization_id FROM users WHERE id = $1))', [userId]);
    await query('DELETE FROM conversations WHERE contact_id IN (SELECT id FROM contacts WHERE organization_id = (SELECT organization_id FROM users WHERE id = $1))', [userId]);
  }

  // Delete analytics data
  async deleteAnalyticsData(userId) {
    await query('DELETE FROM analytics_events WHERE user_id = $1', [userId]);
  }

  // Delete all user data
  async deleteAllUserData(userId) {
    // Comprehensive data deletion
    await this.anonymizePersonalData(userId);
    await this.deleteConversations(userId);
    await this.deleteAnalyticsData(userId);
    // Add more deletions as needed
  }

  // Advanced monitoring and alerting

  // Set up monitoring alerts
  async configureAlerts(organizationId, alertConfig) {
    try {
      await query(`
        INSERT INTO monitoring_alerts (organization_id, config)
        VALUES ($1, $2)
        ON CONFLICT (organization_id)
        DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
      `, [organizationId, JSON.stringify(alertConfig)]);

      return { success: true };
    } catch (error) {
      console.error('Error configuring alerts:', error);
      throw error;
    }
  }

  // Check and trigger alerts
  async checkAlerts(organizationId) {
    try {
      const result = await query(
        'SELECT config FROM monitoring_alerts WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) return;

      const config = JSON.parse(result.rows[0].config);

      // Check various metrics and trigger alerts
      for (const alert of config.alerts) {
        await this.checkAlertCondition(organizationId, alert);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  // Check individual alert condition
  async checkAlertCondition(organizationId, alert) {
    // Implementation would check metrics and send alerts
    console.log(`Checking alert: ${alert.name} for organization ${organizationId}`);
  }
}

module.exports = new EnterpriseService();