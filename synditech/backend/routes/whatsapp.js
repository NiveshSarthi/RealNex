const express = require('express');
const whatsappService = require('../services/whatsapp');

const router = express.Router();

// WhatsApp webhook verification (GET)
router.get('/webhook', (req, res) => {
  const { mode, token, challenge } = req.query;

  const verification = whatsappService.verifyWebhook(mode, token, challenge);

  if (verification) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

// WhatsApp webhook for incoming messages (POST)
router.post('/webhook', async (req, res) => {
  try {
    const result = await whatsappService.handleWebhook(req.body);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      console.error('❌ Webhook processing failed:', result.error);
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send message endpoint (for agents)
router.post('/send-message', async (req, res) => {
  try {
    const { to, message, agentId } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and message are required'
      });
    }

    const result = await whatsappService.sendTextMessage(to, message, agentId);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Send template message
router.post('/send-template', async (req, res) => {
  try {
    const { to, templateName, components } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and template name are required'
      });
    }

    const result = await whatsappService.sendTemplateMessage(to, templateName, components || []);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send template message',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Send template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Send interactive message with buttons
router.post('/send-interactive', async (req, res) => {
  try {
    const { to, headerText, bodyText, buttons } = req.body;

    if (!to || !headerText || !bodyText || !buttons || !Array.isArray(buttons)) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, header text, body text, and buttons array are required'
      });
    }

    const result = await whatsappService.sendInteractiveMessage(to, headerText, bodyText, buttons);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send interactive message',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Send interactive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk send campaign messages
router.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, message, templateName } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required'
      });
    }

    if (!message && !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Either message or template name is required'
      });
    }

    console.log(`📤 Starting bulk send to ${recipients.length} recipients...`);

    const results = await whatsappService.sendBulkMessages(recipients, message, templateName);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      summary: {
        total: recipients.length,
        successful: successCount,
        failed: failureCount
      },
      results: results
    });
  } catch (error) {
    console.error('❌ Bulk send error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk send'
    });
  }
});

// Get message status
router.get('/message-status/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await whatsappService.getMessageStatus(messageId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get message status',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Get message status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Test WhatsApp connection
router.get('/test-connection', async (req, res) => {
  try {
    // Try to send a test message to verify connection
    const testResult = await whatsappService.sendTextMessage(
      process.env.TEST_PHONE_NUMBER || '1234567890',
      'SyndiTech WhatsApp API Test Message',
      'system'
    );

    if (testResult.success) {
      res.json({
        success: true,
        message: 'WhatsApp API connection successful',
        testMessageId: testResult.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'WhatsApp API connection failed',
        error: testResult.error
      });
    }
  } catch (error) {
    console.error('❌ Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during connection test'
    });
  }
});

module.exports = router;