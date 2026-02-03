const express = require('express');
const router = express.Router();
const n8nService = require('../services/n8n');
const { authenticateToken } = require('../middleware/agentAuth');

// Webhook endpoints for n8n workflows
router.post('/webhook/lead-qualified', async (req, res) => {
  try {
    const result = await n8nService.handleWebhook('lead_qualified', req.body);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Lead qualified webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhook/drip-generated', async (req, res) => {
  try {
    const result = await n8nService.handleWebhook('drip_message_generated', req.body);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Drip generated webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhook/commission-calculated', async (req, res) => {
  try {
    const result = await n8nService.handleWebhook('commission_calculated', req.body);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Commission calculated webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhook/meta-lead-processed', async (req, res) => {
  try {
    const result = await n8nService.handleWebhook('meta_lead_processed', req.body);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Meta lead processed webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoints for triggering workflows (protected)
router.post('/trigger/lead-qualification', authenticateToken, async (req, res) => {
  try {
    const { messageData, agentId } = req.body;
    const result = await n8nService.triggerLeadQualification(messageData, agentId);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Trigger lead qualification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trigger/drip-campaign', authenticateToken, async (req, res) => {
  try {
    const { leadData, campaignType } = req.body;
    const result = await n8nService.triggerDripCampaign(leadData, campaignType);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Trigger drip campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trigger/commission-calculation', authenticateToken, async (req, res) => {
  try {
    const { dealData } = req.body;
    const result = await n8nService.triggerCommissionCalculation(dealData);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Trigger commission calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trigger/meta-ads-integration', authenticateToken, async (req, res) => {
  try {
    const { adsData } = req.body;
    const result = await n8nService.triggerMetaAdsIntegration(adsData);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Trigger meta ads integration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workflow execution history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { workflowType, limit = 50 } = req.query;
    const history = await n8nService.getWorkflowHistory(workflowType, parseInt(limit));
    res.json({ success: true, history });
  } catch (error) {
    console.error('Get workflow history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test workflow connections
router.post('/test/:workflowType', authenticateToken, async (req, res) => {
  try {
    const { workflowType } = req.params;
    const result = await n8nService.testWorkflowConnection(workflowType);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Test workflow connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workflow statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await n8nService.getWorkflowStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get workflow stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;