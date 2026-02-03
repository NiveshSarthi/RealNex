const express = require('express');
const router = express.Router();
const metaAdsService = require('../services/metaAds');
const { authenticateToken } = require('../middleware/agentAuth');

// Webhook endpoint for Meta (no auth required for webhooks)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verification = metaAdsService.verifyWebhook(mode, token, challenge);

  if (verification) {
    res.status(200).send(verification);
  } else {
    res.status(403).send('Verification failed');
  }
});

router.post('/webhook', (req, res) => {
  // Verify signature if provided
  const signature = req.get('X-Hub-Signature-256');
  if (signature && !metaAdsService.verifySignature(signature, JSON.stringify(req.body))) {
    console.log('❌ Invalid webhook signature');
    return res.status(403).send('Invalid signature');
  }

  // Process webhook
  metaAdsService.handleLeadWebhook(req.body)
    .then(result => {
      if (result.success) {
        res.status(200).json({ status: 'ok' });
      } else {
        res.status(500).json({ status: 'error', message: result.error });
      }
    })
    .catch(error => {
      console.error('Webhook processing error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    });
});

// Protected API endpoints
router.post('/send-message', authenticateToken, async (req, res) => {
  try {
    const { recipientId, message } = req.body;

    if (!recipientId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID and message are required'
      });
    }

    const result = await metaAdsService.sendMessengerMessage(recipientId, message);

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Send Messenger message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

router.get('/campaign-performance/:campaignId', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { dateRange = 30 } = req.query;

    const performance = await metaAdsService.getCampaignPerformance(campaignId, parseInt(dateRange));

    res.json({
      success: true,
      campaignId,
      performance
    });
  } catch (error) {
    console.error('Get campaign performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign performance',
      error: error.message
    });
  }
});

router.get('/ad-accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await metaAdsService.getAdAccountInfo();

    res.json({
      success: true,
      accounts
    });
  } catch (error) {
    console.error('Get ad accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ad accounts',
      error: error.message
    });
  }
});

router.post('/test-connection', authenticateToken, async (req, res) => {
  try {
    const result = await metaAdsService.testConnection();

    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      error: result.error
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// Get leads from Meta ads with filtering
router.get('/leads', authenticateToken, async (req, res) => {
  try {
    const { campaignId, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT l.*, l.custom_fields->>'meta_lead_id' as meta_lead_id,
             l.custom_fields->>'campaign_id' as campaign_id,
             l.custom_fields->>'ad_id' as ad_id
      FROM leads l
      WHERE l.source = 'meta_ads'
    `;

    const values = [];
    let paramCount = 1;

    if (campaignId) {
      queryText += ` AND l.custom_fields->>'campaign_id' = $${paramCount}`;
      values.push(campaignId);
      paramCount++;
    }

    if (dateFrom) {
      queryText += ` AND l.created_at >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      queryText += ` AND l.created_at <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    queryText += ` ORDER BY l.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await require('../config/database').query(queryText, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      WHERE l.source = 'meta_ads'
      ${campaignId ? "AND l.custom_fields->>'campaign_id' = $1" : ''}
      ${dateFrom ? `AND l.created_at >= $${campaignId ? 2 : 1}` : ''}
      ${dateTo ? `AND l.created_at <= $${paramCount - 1}` : ''}
    `;

    const countValues = values.slice(0, -2); // Remove limit and offset
    const countResult = await require('../config/database').query(countQuery, countValues);

    res.json({
      success: true,
      leads: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get Meta leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leads',
      error: error.message
    });
  }
});

// Analytics for Meta ads performance
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { dateRange = 30 } = req.query;

    // Get leads created from Meta ads
    const leadsQuery = `
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN qualification_score >= 70 THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as converted_leads,
        AVG(qualification_score) as avg_score,
        COUNT(DISTINCT custom_fields->>'campaign_id') as campaigns_count
      FROM leads
      WHERE source = 'meta_ads'
      AND created_at >= NOW() - INTERVAL '${dateRange} days'
    `;

    const leadsResult = await require('../config/database').query(leadsQuery);

    // Get campaign performance from custom fields
    const campaignQuery = `
      SELECT
        custom_fields->>'campaign_id' as campaign_id,
        COUNT(*) as leads_count,
        AVG(qualification_score) as avg_score
      FROM leads
      WHERE source = 'meta_ads'
      AND created_at >= NOW() - INTERVAL '${dateRange} days'
      AND custom_fields->>'campaign_id' IS NOT NULL
      GROUP BY custom_fields->>'campaign_id'
      ORDER BY leads_count DESC
      LIMIT 10
    `;

    const campaignResult = await require('../config/database').query(campaignQuery);

    res.json({
      success: true,
      dateRange: `${dateRange} days`,
      overview: leadsResult.rows[0],
      topCampaigns: campaignResult.rows
    });
  } catch (error) {
    console.error('Get Meta analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

module.exports = router;