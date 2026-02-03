const express = require('express');
const router = express.Router();
const WhiteLabelService = require('../services/whiteLabel');
const { authenticate } = require('../middleware/auth');

// Get white-label configuration
router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await WhiteLabelService.getWhiteLabelConfig(req.user.organizationId);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting white-label config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update white-label configuration
router.put('/config', authenticate, async (req, res) => {
  try {
    // Check if organization has white-label access
    const hasAccess = await WhiteLabelService.hasWhiteLabelAccess(req.user.organizationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'White-label features are not available for your subscription plan'
      });
    }

    const config = req.body;
    const updatedConfig = await WhiteLabelService.updateWhiteLabelConfig(req.user.organizationId, config);

    res.json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating white-label config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get white-label preview
router.get('/preview', authenticate, async (req, res) => {
  try {
    const config = await WhiteLabelService.getWhiteLabelConfig(req.user.organizationId);
    const preview = WhiteLabelService.generatePreview(config);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get email template
router.get('/email-templates/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const template = await WhiteLabelService.getCustomEmailTemplate(req.user.organizationId, type);

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error getting email template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email template
router.put('/email-templates/:type', authenticate, async (req, res) => {
  try {
    const hasAccess = await WhiteLabelService.hasWhiteLabelAccess(req.user.organizationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Custom email templates are not available for your subscription plan'
      });
    }

    const { type } = req.params;
    const { subject, html } = req.body;

    const template = await WhiteLabelService.updateEmailTemplate(
      req.user.organizationId,
      type,
      subject,
      html
    );

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get mobile app configuration
router.get('/mobile-app', authenticate, async (req, res) => {
  try {
    const config = await WhiteLabelService.getMobileAppConfig(req.user.organizationId);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting mobile app config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update mobile app configuration
router.put('/mobile-app', authenticate, async (req, res) => {
  try {
    const hasAccess = await WhiteLabelService.hasWhiteLabelAccess(req.user.organizationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Custom mobile app features are not available for your subscription plan'
      });
    }

    const config = req.body;
    const updatedConfig = await WhiteLabelService.updateMobileAppConfig(req.user.organizationId, config);

    res.json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating mobile app config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check white-label access
router.get('/access', authenticate, async (req, res) => {
  try {
    const hasAccess = await WhiteLabelService.hasWhiteLabelAccess(req.user.organizationId);
    res.json({
      success: true,
      data: { hasWhiteLabelAccess: hasAccess }
    });
  } catch (error) {
    console.error('Error checking white-label access:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available template variables
router.get('/template-variables', authenticate, (req, res) => {
  const variables = {
    user: [
      { name: 'first_name', description: 'User first name' },
      { name: 'last_name', description: 'User last name' },
      { name: 'email', description: 'User email address' },
      { name: 'phone', description: 'User phone number' }
    ],
    company: [
      { name: 'company_name', description: 'Company/organization name' },
      { name: 'support_email', description: 'Support email address' },
      { name: 'support_phone', description: 'Support phone number' },
      { name: 'login_url', description: 'Login page URL' }
    ],
    appointment: [
      { name: 'appointment_type', description: 'Type of appointment' },
      { name: 'appointment_date', description: 'Appointment date' },
      { name: 'appointment_time', description: 'Appointment time' },
      { name: 'appointment_location', description: 'Appointment location' }
    ],
    colors: [
      { name: 'primary_color', description: 'Primary brand color' },
      { name: 'secondary_color', description: 'Secondary brand color' }
    ]
  };

  res.json({
    success: true,
    data: variables
  });
});

module.exports = router;