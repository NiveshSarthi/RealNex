const express = require('express');
const router = express.Router();
const MultiChannelService = require('../services/multiChannel');

// WhatsApp webhook (existing)
router.get('/whatsapp', (req, res) => {
  const WhatsAppService = require('../services/whatsapp');
  const result = WhatsAppService.verifyWebhook(
    req.query['hub.mode'],
    req.query['hub.verify_token'],
    req.query['hub.challenge']
  );

  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});

router.post('/whatsapp', async (req, res) => {
  try {
    const result = await MultiChannelService.handleWebhook('whatsapp', req.body);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telegram webhook
router.post('/telegram', async (req, res) => {
  try {
    const result = await MultiChannelService.handleWebhook('telegram', req.body);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Instagram webhook
router.get('/instagram', (req, res) => {
  // Instagram webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify token (should match your configured verify token)
  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/instagram', async (req, res) => {
  try {
    const result = await MultiChannelService.handleWebhook('instagram', req.body);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Instagram webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Facebook Messenger webhook
router.get('/facebook', (req, res) => {
  // Facebook webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/facebook', async (req, res) => {
  try {
    const result = await MultiChannelService.handleWebhook('facebook', req.body);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unified messaging endpoint
router.post('/send', async (req, res) => {
  try {
    const { channel, to, message, options } = req.body;

    if (!channel || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: channel, to, message'
      });
    }

    const result = await MultiChannelService.sendMessage(channel, to, message, options || {});
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rich message endpoint
router.post('/send-rich', async (req, res) => {
  try {
    const { channel, to, type, content, options } = req.body;

    if (!channel || !to || !type || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: channel, to, type, content'
      });
    }

    const result = await MultiChannelService.sendRichMessage(channel, to, type, content, options || {});
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Send rich message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Channel statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const stats = await MultiChannelService.getChannelStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Setup webhooks endpoint
router.post('/setup-webhooks', async (req, res) => {
  try {
    await MultiChannelService.setupWebhooks();
    res.json({
      success: true,
      message: 'Webhooks setup initiated'
    });
  } catch (error) {
    console.error('Setup webhooks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS fallback endpoint
router.post('/fallback/sms', async (req, res) => {
  try {
    const { originalChannel, to, message } = req.body;

    if (!originalChannel || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: originalChannel, to, message'
      });
    }

    const result = await MultiChannelService.fallbackToSMS(originalChannel, to, message);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('SMS fallback error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;