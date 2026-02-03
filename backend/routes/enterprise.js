const express = require('express');
const router = express.Router();
const EnterpriseService = require('../services/enterprise');
const { authenticate } = require('../middleware/auth');

// SSO (Single Sign-On) Routes

// Generate SSO configuration
router.post('/sso/config', authenticate, async (req, res) => {
  try {
    const { ssoType } = req.body;
    const config = await EnterpriseService.generateSSOConfig(req.user.organizationId, ssoType);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error generating SSO config:', error);
    res.status(500).json({ error: 'Failed to generate SSO configuration' });
  }
});

// Get SSO configuration
router.get('/sso/config', authenticate, async (req, res) => {
  try {
    const config = await EnterpriseService.getSSOConfig(req.user.organizationId);

    if (!config) {
      return res.status(404).json({ error: 'SSO not configured' });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting SSO config:', error);
    res.status(500).json({ error: 'Failed to get SSO configuration' });
  }
});

// Get SAML metadata (public endpoint)
router.get('/sso/metadata/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const ssoConfig = await EnterpriseService.getSSOConfig(organizationId);

    if (!ssoConfig) {
      return res.status(404).json({ error: 'SSO not configured' });
    }

    const metadata = EnterpriseService.generateSAMLMetadata(organizationId, ssoConfig.config);

    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${metadata.entityID}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${metadata.SPSSODescriptor.KeyDescriptor.KeyInfo.X509Data.X509Certificate}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleLogoutService Binding="${metadata.SPSSODescriptor.SingleLogoutService.Binding}" Location="${metadata.SPSSODescriptor.SingleLogoutService.Location}"/>
    <AssertionConsumerService Binding="${metadata.SPSSODescriptor.AssertionConsumerService.Binding}" Location="${metadata.SPSSODescriptor.AssertionConsumerService.Location}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`);
  } catch (error) {
    console.error('Error generating SAML metadata:', error);
    res.status(500).json({ error: 'Failed to generate SAML metadata' });
  }
});

// Security Features

// IP Whitelist Management
router.get('/security/ip-whitelist', authenticate, async (req, res) => {
  try {
    const whitelist = await EnterpriseService.manageIPWhitelist(req.user.organizationId, 'list');
    res.json({
      success: true,
      data: whitelist
    });
  } catch (error) {
    console.error('Error getting IP whitelist:', error);
    res.status(500).json({ error: 'Failed to get IP whitelist' });
  }
});

router.post('/security/ip-whitelist', authenticate, async (req, res) => {
  try {
    const { ipAddress, description } = req.body;
    await EnterpriseService.manageIPWhitelist(req.user.organizationId, 'add', ipAddress);

    // Log audit event
    await EnterpriseService.logAuditEvent(
      req.user.organizationId,
      req.user.id,
      'ip_whitelist_added',
      'security',
      { ipAddress, description }
    );

    res.json({
      success: true,
      message: 'IP address added to whitelist'
    });
  } catch (error) {
    console.error('Error adding IP to whitelist:', error);
    res.status(500).json({ error: 'Failed to add IP to whitelist' });
  }
});

router.delete('/security/ip-whitelist/:ipAddress', authenticate, async (req, res) => {
  try {
    const { ipAddress } = req.params;
    await EnterpriseService.manageIPWhitelist(req.user.organizationId, 'remove', ipAddress);

    // Log audit event
    await EnterpriseService.logAuditEvent(
      req.user.organizationId,
      req.user.id,
      'ip_whitelist_removed',
      'security',
      { ipAddress }
    );

    res.json({
      success: true,
      message: 'IP address removed from whitelist'
    });
  } catch (error) {
    console.error('Error removing IP from whitelist:', error);
    res.status(500).json({ error: 'Failed to remove IP from whitelist' });
  }
});

// Audit Logs
router.get('/audit/logs', authenticate, async (req, res) => {
  try {
    const { userId, action, dateRange, limit } = req.query;
    const filters = {};

    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (dateRange) filters.dateRange = JSON.parse(dateRange);
    if (limit) filters.limit = parseInt(limit);

    const logs = await EnterpriseService.getAuditLogs(req.user.organizationId, filters);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Two-Factor Authentication
router.post('/security/2fa/enable', authenticate, async (req, res) => {
  try {
    const result = await EnterpriseService.enable2FA(req.user.id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

router.post('/security/2fa/verify', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    const isValid = await EnterpriseService.verify2FAToken(req.user.id, token);

    if (isValid) {
      res.json({
        success: true,
        message: '2FA token verified'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid 2FA token'
      });
    }
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    res.status(500).json({ error: 'Failed to verify 2FA token' });
  }
});

// Support Features

// Create support ticket
router.post('/support/tickets', authenticate, async (req, res) => {
  try {
    const ticket = await EnterpriseService.createSupportTicket(
      req.user.organizationId,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Get support tickets
router.get('/support/tickets', authenticate, async (req, res) => {
  try {
    const { status, priority, limit } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (limit) filters.limit = parseInt(limit);

    const tickets = await EnterpriseService.getSupportTickets(req.user.organizationId, filters);

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error getting support tickets:', error);
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

// Update support ticket
router.put('/support/tickets/:ticketId', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updates = req.body;

    // Verify ticket ownership
    const { query } = require('../config/database');
    const ticketResult = await query(
      'SELECT * FROM support_tickets WHERE ticket_id = $1 AND organization_id = $2',
      [ticketId, req.user.organizationId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    // Update ticket
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    });

    values.push(ticketId);

    const result = await query(`
      UPDATE support_tickets
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE ticket_id = $${paramCount}
      RETURNING *
    `, values);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
});

// SLA Metrics
router.get('/support/sla-metrics', authenticate, async (req, res) => {
  try {
    const metrics = await EnterpriseService.getSLAMetrics(req.user.organizationId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting SLA metrics:', error);
    res.status(500).json({ error: 'Failed to get SLA metrics' });
  }
});

// Compliance Features

// Configure data retention
router.put('/compliance/data-retention', authenticate, async (req, res) => {
  try {
    const { retentionRules } = req.body;
    await EnterpriseService.configureDataRetention(req.user.organizationId, retentionRules);

    res.json({
      success: true,
      message: 'Data retention policy configured'
    });
  } catch (error) {
    console.error('Error configuring data retention:', error);
    res.status(500).json({ error: 'Failed to configure data retention' });
  }
});

// GDPR data deletion request
router.post('/compliance/gdpr/delete', authenticate, async (req, res) => {
  try {
    const { dataTypes } = req.body;
    const result = await EnterpriseService.handleDataDeletion(
      req.user.organizationId,
      req.user.id,
      dataTypes
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error processing GDPR deletion request:', error);
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

// Monitoring and Alerting

// Configure monitoring alerts
router.put('/monitoring/alerts', authenticate, async (req, res) => {
  try {
    const { alertConfig } = req.body;
    await EnterpriseService.configureAlerts(req.user.organizationId, alertConfig);

    res.json({
      success: true,
      message: 'Monitoring alerts configured'
    });
  } catch (error) {
    console.error('Error configuring monitoring alerts:', error);
    res.status(500).json({ error: 'Failed to configure monitoring alerts' });
  }
});

// Get system health (for monitoring)
router.get('/monitoring/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'healthy',
        api: 'healthy',
        whatsapp: 'healthy'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Role-based permissions
router.get('/rbac/permissions', authenticate, (req, res) => {
  const permissions = EnterpriseService.getRolePermissions();
  res.json({
    success: true,
    data: permissions
  });
});

// Check user permission
router.post('/rbac/check', authenticate, (req, res) => {
  const { permission } = req.body;
  const hasPermission = EnterpriseService.checkPermission(req.user.role, permission);

  res.json({
    success: true,
    data: {
      hasPermission,
      userRole: req.user.role,
      permission: permission
    }
  });
});

module.exports = router;