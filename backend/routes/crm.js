const express = require('express');
const crmService = require('../services/crm');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/crm/salesforce/connect
// @desc    Connect to Salesforce
// @access  Private
router.post('/salesforce/connect', authenticate, async (req, res) => {
  try {
    const { loginUrl, username, password, securityToken } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await crmService.connectSalesforce({
      loginUrl,
      username,
      password,
      securityToken
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Connected to Salesforce successfully',
        data: {
          connectionId: result.connectionId,
          instanceUrl: result.instanceUrl,
          userInfo: result.userInfo
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Salesforce',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Salesforce connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/crm/hubspot/connect
// @desc    Connect to HubSpot
// @access  Private
router.post('/hubspot/connect', authenticate, async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    const result = await crmService.connectHubSpot(apiKey);

    if (result.success) {
      res.json({
        success: true,
        message: 'Connected to HubSpot successfully',
        data: {
          connectionId: result.connectionId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to HubSpot',
        error: result.error
      });
    }
  } catch (error) {
    console.error('HubSpot connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/crm/zoho/connect
// @desc    Connect to Zoho CRM
// @access  Private
router.post('/zoho/connect', authenticate, async (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken } = req.body;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, client secret, and refresh token are required'
      });
    }

    const result = await crmService.connectZohoCRM(clientId, clientSecret, refreshToken);

    if (result.success) {
      res.json({
        success: true,
        message: 'Connected to Zoho CRM successfully',
        data: {
          connectionId: result.connectionId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Zoho CRM',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Zoho connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/crm/sync-contact
// @desc    Sync contact to CRM
// @access  Private
router.post('/sync-contact', authenticate, async (req, res) => {
  try {
    const { crmType, connectionId, contactData } = req.body;

    if (!crmType || !connectionId || !contactData) {
      return res.status(400).json({
        success: false,
        message: 'CRM type, connection ID, and contact data are required'
      });
    }

    const result = await crmService.syncContactToCRM(crmType, connectionId, contactData);

    if (result.success) {
      res.json({
        success: true,
        message: `Contact synced to ${crmType} successfully`,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to sync contact to ${crmType}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Sync contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/crm/:crmType/leads
// @desc    Create lead in specific CRM
// @access  Private
router.post('/:crmType/leads', authenticate, async (req, res) => {
  try {
    const { crmType } = req.params;
    const { connectionId, leadData } = req.body;

    if (!connectionId || !leadData) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID and lead data are required'
      });
    }

    let result;
    switch (crmType) {
      case 'salesforce':
        result = await crmService.createSalesforceLead(connectionId, leadData);
        break;
      case 'hubspot':
        result = await crmService.createHubSpotContact(connectionId, leadData);
        break;
      case 'zoho':
        result = await crmService.createZohoLead(connectionId, leadData);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported CRM type'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        message: `Lead created in ${crmType} successfully`,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create lead in ${crmType}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error(`Create ${req.params.crmType} lead error:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/crm/:crmType/leads/:leadId
// @desc    Update lead in specific CRM
// @access  Private
router.put('/:crmType/leads/:leadId', authenticate, async (req, res) => {
  try {
    const { crmType, leadId } = req.params;
    const { connectionId, updateData } = req.body;

    if (!connectionId || !updateData) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID and update data are required'
      });
    }

    let result;
    switch (crmType) {
      case 'salesforce':
        result = await crmService.updateSalesforceLead(connectionId, leadId, updateData);
        break;
      case 'hubspot':
        result = await crmService.updateHubSpotContact(connectionId, leadId, updateData);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Update not supported for this CRM type'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        message: `Lead updated in ${crmType} successfully`,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to update lead in ${crmType}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error(`Update ${req.params.crmType} lead error:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/crm/disconnect/:connectionId
// @desc    Disconnect CRM
// @access  Private
router.delete('/disconnect/:connectionId', authenticate, (req, res) => {
  try {
    const { connectionId } = req.params;

    const result = crmService.disconnectCRM(connectionId);

    res.json({
      success: true,
      message: 'CRM disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect CRM error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/crm/connections
// @desc    Get active CRM connections
// @access  Private
router.get('/connections', authenticate, (req, res) => {
  try {
    const connections = crmService.getActiveConnections();

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;