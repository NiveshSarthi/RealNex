const axios = require('axios');
require('dotenv').config();

class MultiChannelService {
  constructor() {
    // WhatsApp configuration
    this.whatsapp = {
      baseUrl: 'https://graph.facebook.com/v18.0',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
    };

    // Telegram configuration
    this.telegram = {
      baseUrl: 'https://api.telegram.org/bot',
      token: process.env.TELEGRAM_BOT_TOKEN
    };

    // Instagram configuration
    this.instagram = {
      baseUrl: 'https://graph.facebook.com/v18.0',
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
      accountId: process.env.INSTAGRAM_ACCOUNT_ID
    };

    // Facebook Messenger configuration
    this.facebook = {
      baseUrl: 'https://graph.facebook.com/v18.0',
      accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
      pageId: process.env.FACEBOOK_PAGE_ID
    };

    // SMS configuration (Twilio)
    this.sms = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    };
  }

  // Unified send message method
  async sendMessage(channel, to, message, options = {}) {
    switch (channel.toLowerCase()) {
      case 'whatsapp':
        return await this.sendWhatsAppMessage(to, message, options);
      case 'telegram':
        return await this.sendTelegramMessage(to, message, options);
      case 'instagram':
        return await this.sendInstagramMessage(to, message, options);
      case 'facebook':
        return await this.sendFacebookMessage(to, message, options);
      case 'sms':
        return await this.sendSMSMessage(to, message, options);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  // WhatsApp message sending
  async sendWhatsAppMessage(to, message, options = {}) {
    try {
      const response = await axios.post(
        `${this.whatsapp.baseUrl}/${this.whatsapp.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.whatsapp.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        channel: 'whatsapp',
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return {
        success: false,
        channel: 'whatsapp',
        error: error.response?.data || error.message
      };
    }
  }

  // Telegram message sending
  async sendTelegramMessage(chatId, message, options = {}) {
    try {
      const response = await axios.post(
        `${this.telegram.baseUrl}${this.telegram.token}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: options.parseMode || 'HTML',
          reply_markup: options.keyboard ? JSON.stringify(options.keyboard) : undefined
        }
      );

      return {
        success: true,
        channel: 'telegram',
        messageId: response.data.result.message_id,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending Telegram message:', error.response?.data || error.message);
      return {
        success: false,
        channel: 'telegram',
        error: error.response?.data || error.message
      };
    }
  }

  // Instagram message sending
  async sendInstagramMessage(to, message, options = {}) {
    try {
      const response = await axios.post(
        `${this.instagram.baseUrl}/${this.instagram.accountId}/messages`,
        {
          recipient: { id: to },
          message: { text: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.instagram.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        channel: 'instagram',
        messageId: response.data.message_id,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending Instagram message:', error.response?.data || error.message);
      return {
        success: false,
        channel: 'instagram',
        error: error.response?.data || error.message
      };
    }
  }

  // Facebook Messenger message sending
  async sendFacebookMessage(to, message, options = {}) {
    try {
      const response = await axios.post(
        `${this.facebook.baseUrl}/me/messages?access_token=${this.facebook.accessToken}`,
        {
          recipient: { id: to },
          message: { text: message }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        channel: 'facebook',
        messageId: response.data.message_id,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending Facebook message:', error.response?.data || error.message);
      return {
        success: false,
        channel: 'facebook',
        error: error.response?.data || error.message
      };
    }
  }

  // SMS message sending (Twilio)
  async sendSMSMessage(to, message, options = {}) {
    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.sms.accountSid}/Messages.json`,
        new URLSearchParams({
          From: this.sms.fromNumber,
          To: to,
          Body: message
        }),
        {
          auth: {
            username: this.sms.accountSid,
            password: this.sms.authToken
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        channel: 'sms',
        messageId: response.data.sid,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending SMS message:', error.response?.data || error.message);
      return {
        success: false,
        channel: 'sms',
        error: error.response?.data || error.message
      };
    }
  }

  // Unified webhook handler
  async handleWebhook(channel, payload) {
    switch (channel.toLowerCase()) {
      case 'whatsapp':
        return await this.handleWhatsAppWebhook(payload);
      case 'telegram':
        return await this.handleTelegramWebhook(payload);
      case 'instagram':
        return await this.handleInstagramWebhook(payload);
      case 'facebook':
        return await this.handleFacebookWebhook(payload);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  // WhatsApp webhook handler
  async handleWhatsAppWebhook(payload) {
    // Reuse existing WhatsApp webhook logic
    const WhatsAppService = require('./whatsapp');
    return await WhatsAppService.handleWebhook(payload);
  }

  // Telegram webhook handler
  async handleTelegramWebhook(payload) {
    try {
      const { message } = payload;

      if (!message) return { success: true };

      const { chat, text, from } = message;
      const chatId = chat.id;
      const userId = from.id;
      const userName = `${from.first_name} ${from.last_name || ''}`.trim();

      // Process message similar to WhatsApp
      await this.processIncomingMessage('telegram', userId.toString(), text, {
        chatId,
        userName,
        messageId: message.message_id
      });

      return { success: true };
    } catch (error) {
      console.error('Error handling Telegram webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Instagram webhook handler
  async handleInstagramWebhook(payload) {
    try {
      const { messaging } = payload;

      if (!messaging) return { success: true };

      for (const message of messaging) {
        if (message.message && message.message.text) {
          const { sender, message: msg } = message;
          const senderId = sender.id;
          const text = msg.text;

          await this.processIncomingMessage('instagram', senderId, text, {
            messageId: msg.mid
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error handling Instagram webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Facebook webhook handler
  async handleFacebookWebhook(payload) {
    try {
      const { messaging } = payload;

      if (!messaging) return { success: true };

      for (const message of messaging) {
        if (message.message && message.message.text) {
          const { sender, message: msg } = message;
          const senderId = sender.id;
          const text = msg.text;

          await this.processIncomingMessage('facebook', senderId, text, {
            messageId: msg.mid
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error handling Facebook webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Process incoming message from any channel
  async processIncomingMessage(channel, from, content, metadata = {}) {
    try {
      const { query } = require('../config/database');

      // Find or create contact
      let contactResult = await query(
        'SELECT id FROM contacts WHERE contact_id = $1 AND channel = $2',
        [from, channel]
      );

      let contactId;
      if (contactResult.rows.length === 0) {
        // Create new contact
        const contactInsert = await query(
          'INSERT INTO contacts (contact_id, channel, first_name) VALUES ($1, $2, $3) RETURNING id',
          [from, channel, metadata.userName || 'Unknown']
        );
        contactId = contactInsert.rows[0].id;
      } else {
        contactId = contactResult.rows[0].id;
      }

      // Find or create conversation
      let conversation = await this.findConversationByContact(contactId, channel);
      if (!conversation) {
        conversation = await this.createConversation(contactId, channel);
      }

      // Save message
      await this.saveMessage(conversation.id, from, content, 'inbound', channel, metadata);

      // Update conversation
      await this.updateConversation(conversation.id);

      console.log(`Processed incoming message from ${channel}: ${from}: ${content}`);

      // Trigger chatbot response
      if (content) {
        const WhatsAppService = require('./whatsapp');
        const contactName = metadata.userName || 'User';
        await WhatsAppService.handleChatbotResponse(from, content, contactName);
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing incoming message:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods for conversation management
  async findConversationByContact(contactId, channel) {
    const { query } = require('../config/database');
    const result = await query(
      'SELECT * FROM conversations WHERE contact_id = $1 AND channel = $2 ORDER BY created_at DESC LIMIT 1',
      [contactId, channel]
    );
    return result.rows[0];
  }

  async createConversation(contactId, channel) {
    const { query } = require('../config/database');
    const result = await query(
      'INSERT INTO conversations (contact_id, channel, status) VALUES ($1, $2, $3) RETURNING *',
      [contactId, channel, 'open']
    );
    return result.rows[0];
  }

  async saveMessage(conversationId, from, content, direction, channel, metadata = {}) {
    const { query } = require('../config/database');
    await query(
      'INSERT INTO messages (conversation_id, contact_id, direction, message_type, content, channel, external_message_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [conversationId, from, direction, 'text', content, channel, metadata.messageId]
    );
  }

  async updateConversation(conversationId) {
    const { query } = require('../config/database');
    await query(
      'UPDATE conversations SET last_message_at = NOW(), status = $2 WHERE id = $1',
      [conversationId, 'open']
    );
  }

  // Send rich media messages across channels
  async sendRichMessage(channel, to, type, content, options = {}) {
    switch (channel.toLowerCase()) {
      case 'whatsapp':
        return await this.sendWhatsAppRichMessage(to, type, content, options);
      case 'telegram':
        return await this.sendTelegramRichMessage(to, type, content, options);
      // Add other channels as needed
      default:
        return await this.sendMessage(channel, to, content.text || 'Rich message not supported on this channel');
    }
  }

  // WhatsApp rich message
  async sendWhatsAppRichMessage(to, type, content, options) {
    // Implementation for WhatsApp rich messages (buttons, lists, etc.)
    const WhatsAppService = require('./whatsapp');

    switch (type) {
      case 'buttons':
        return await WhatsAppService.sendInteractiveMessage(to, content.header, content.body, content.buttons);
      case 'list':
        return await WhatsAppService.sendListMessage(to, content.header, content.body, content.buttonText, content.sections);
      case 'media':
        return await WhatsAppService.sendMediaMessage(to, content.mediaType, content.mediaUrl, content.caption);
      default:
        return await WhatsAppService.sendTextMessage(to, content.text);
    }
  }

  // Telegram rich message
  async sendTelegramRichMessage(chatId, type, content, options) {
    switch (type) {
      case 'buttons':
        const keyboard = {
          inline_keyboard: content.buttons.map(button => [{
            text: button.title,
            callback_data: button.id || button.title
          }])
        };
        return await this.sendTelegramMessage(chatId, content.text, { keyboard });
      case 'media':
        // Implement media sending for Telegram
        return await this.sendTelegramMessage(chatId, content.caption || 'Media message');
      default:
        return await this.sendTelegramMessage(chatId, content.text);
    }
  }

  // Fallback to SMS for failed messages
  async fallbackToSMS(channel, to, message, originalError) {
    console.log(`Falling back to SMS for ${channel} message to ${to}`);

    // Convert WhatsApp number to SMS number (simplified)
    const smsNumber = to.replace('@c.us', '').replace(/\D/g, '');

    return await this.sendSMSMessage(smsNumber, `SMS Fallback: ${message}`);
  }

  // Get channel statistics
  async getChannelStats() {
    const { query } = require('../config/database');

    const result = await query(`
      SELECT
        channel,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY channel
    `);

    return result.rows;
  }

  // Set up webhooks for all channels
  async setupWebhooks() {
    // This would set up webhook URLs for each channel
    // Implementation depends on specific channel APIs
    console.log('Setting up multi-channel webhooks...');

    // WhatsApp webhook setup
    if (this.whatsapp.accessToken) {
      console.log('WhatsApp webhook configured');
    }

    // Telegram webhook setup
    if (this.telegram.token) {
      const telegramWebhookUrl = `${process.env.BASE_URL}/webhooks/telegram`;
      await axios.post(`${this.telegram.baseUrl}${this.telegram.token}/setWebhook`, {
        url: telegramWebhookUrl
      });
      console.log('Telegram webhook configured');
    }

    // Similar setup for Instagram and Facebook
    console.log('Multi-channel webhooks setup complete');
  }
}

module.exports = new MultiChannelService();