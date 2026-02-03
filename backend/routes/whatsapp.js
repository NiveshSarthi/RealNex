const express = require('express');
const whatsappService = require('../services/whatsapp');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Webhook verification (GET)
router.get('/webhook', (req, res) => {
  const { mode, token, challenge } = req.query;

  const verification = whatsappService.verifyWebhook(mode, token, challenge);

  if (verification) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

// Webhook for incoming messages (POST)
router.post('/webhook', async (req, res) => {
  try {
    const result = await whatsappService.handleWebhook(req.body);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      console.error('Webhook processing failed:', result.error);
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send message endpoint (authenticated)
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const { to, type, message, templateName, components, mediaType, mediaUrl, caption, headerText, bodyText, buttons, buttonText, sections } = req.body;

    let result;

    switch (type) {
      case 'text':
        result = await whatsappService.sendTextMessage(to, message);
        break;
      case 'template':
        result = await whatsappService.sendTemplateMessage(to, templateName, components);
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        result = await whatsappService.sendMediaMessage(to, mediaType || type, mediaUrl, caption);
        break;
      case 'interactive':
        if (buttons) {
          result = await whatsappService.sendInteractiveMessage(to, headerText, bodyText, buttons);
        } else if (sections) {
          result = await whatsappService.sendListMessage(to, headerText, bodyText, buttonText, sections);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid interactive message parameters'
          });
        }
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported message type'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get message status
router.get('/message-status/:messageId', authenticate, async (req, res) => {
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
    console.error('Get message status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get business profile
router.get('/business-profile', authenticate, async (req, res) => {
  try {
    const result = await whatsappService.getBusinessProfile();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get business profile',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update business profile
router.put('/business-profile', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    const result = await whatsappService.updateBusinessProfile(updates);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update business profile',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Update business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;