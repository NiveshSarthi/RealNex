const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://graph.facebook.com/v18.0';

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  }

  // Send text message
  async sendTextMessage(to, message, agentId = null) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ WhatsApp send message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send template message (for campaigns)
  async sendTemplateMessage(to, templateName, components = []) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ WhatsApp template message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send interactive message (buttons)
  async sendInteractiveMessage(to, headerText, bodyText, buttons) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            header: {
              type: 'text',
              text: headerText
            },
            body: {
              text: bodyText
            },
            action: {
              buttons: buttons.map((button, index) => ({
                type: 'reply',
                reply: {
                  id: `btn_${index + 1}`,
                  title: button.title
                }
              }))
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ WhatsApp interactive message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Verify webhook
  verifyWebhook(mode, token, challenge) {
    console.log('🔍 WhatsApp webhook verification attempt:', {
      mode,
      token: token ? token.substring(0, 10) + '...' : 'undefined',
      expectedToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN.substring(0, 10) + '...' : 'undefined',
      challenge
    });

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ WhatsApp webhook verified successfully');
      return challenge;
    }

    console.log('❌ WhatsApp webhook verification failed');
    return false;
  }

  // Handle incoming webhook
  async handleWebhook(payload) {
    try {
      const { object, entry } = payload;

      if (object === 'whatsapp_business_account') {
        for (const e of entry) {
          for (const change of e.changes) {
            if (change.field === 'messages') {
              const messages = change.value.messages;
              if (messages) {
                for (const message of messages) {
                  await this.processIncomingMessage(message);
                }
              }
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ WhatsApp webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Process incoming message (SyndiTech specific)
  async processIncomingMessage(message) {
    try {
      const { from, id, timestamp, text, type } = message;
      const { query } = require('../config/database');

      // Find or create lead/contact
      let contactResult = await query(
        'SELECT id FROM leads WHERE phone = $1 LIMIT 1',
        [from]
      );

      let leadId;
      if (contactResult.rows.length === 0) {
        // Create new lead
        const leadInsert = await query(
          'INSERT INTO leads (phone, source, status) VALUES ($1, $2, $3) RETURNING id',
          [from, 'whatsapp', 'new']
        );
        leadId = leadInsert.rows[0].id;
        console.log(`👤 New lead created from WhatsApp: ${from}`);
      } else {
        leadId = contactResult.rows[0].id;
      }

      // Save message
      const messageContent = text?.body || '[Media message]';
      await query(
        'INSERT INTO messages (lead_id, direction, content, whatsapp_message_id, message_type) VALUES ($1, $2, $3, $4, $5)',
        [leadId, 'inbound', messageContent, id, type]
      );

      // Update lead last contact
      await query(
        'UPDATE leads SET last_contact = NOW(), updated_at = NOW() WHERE id = $1',
        [leadId]
      );

      console.log(`💬 Message processed from ${from}: ${messageContent.substring(0, 50)}...`);

      // Trigger AI lead qualification via n8n workflow
      try {
        const n8nService = require('./n8n');
        await n8nService.triggerLeadQualification({
          message: messageContent,
          sender: from,
          timestamp: new Date(parseInt(timestamp) * 1000)
        });
        console.log(`🤖 AI qualification triggered for lead ${leadId}`);
      } catch (error) {
        console.error('❌ Failed to trigger AI qualification:', error);
      }

      return { success: true, leadId };
    } catch (error) {
      console.error('❌ Error processing incoming message:', error);
      return { success: false, error: error.message };
    }
  }

  // Bulk send campaign messages
  async sendBulkMessages(recipients, message, templateName = null, campaignId = null, variant = null, variantName = null) {
    const results = [];
    const batchSize = 10; // WhatsApp rate limiting

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchPromises = batch.map(async (recipient) => {
        try {
          let result;
          if (templateName) {
            result = await this.sendTemplateMessage(recipient.phone, templateName);
          } else {
            result = await this.sendTextMessage(recipient.phone, message);
          }

          // Log campaign message with variant info
          if (result.success) {
            await this.logCampaignMessage(recipient.id, result.messageId, 'sent', campaignId, variant, variantName);
          }

          return {
            recipient: recipient.phone,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            variant: variant,
            variantName: variantName
          };
        } catch (error) {
          return {
            recipient: recipient.phone,
            success: false,
            error: error.message,
            variant: variant,
            variantName: variantName
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Log campaign message
  async logCampaignMessage(leadId, messageId, status, campaignId = null, variant = null, variantName = null) {
    const { query } = require('../config/database');

    await query(
      'INSERT INTO campaign_messages (lead_id, whatsapp_message_id, status, sent_at, campaign_id, variant, variant_name) VALUES ($1, $2, $3, NOW(), $4, $5, $6)',
      [leadId, messageId, status, campaignId, variant, variantName]
    );
  }

  // Get message status
  async getMessageStatus(messageId) {
    try {
      const response = await axios.get(
        `${BASE_URL}/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get message status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // WhatsApp Catalog Management
  async createCatalogItem(productData) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/catalog`,
        {
          catalog_id: productData.catalogId || this.businessAccountId,
          products: [{
            retailer_id: productData.retailerId,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            currency: productData.currency || 'INR',
            image_url: productData.imageUrl,
            url: productData.url,
            category: productData.category,
            availability: productData.availability || 'in stock'
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        productId: response.data.products[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Create catalog item error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async updateCatalogItem(productId, updateData) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/catalog/${productId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Update catalog item error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async deleteCatalogItem(productId) {
    try {
      const response = await axios.delete(
        `${BASE_URL}/${this.phoneNumberId}/catalog/${productId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Delete catalog item error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Interactive Messages (List and Reply Buttons)
  async sendInteractiveList(to, listData) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'list',
            header: {
              type: 'text',
              text: listData.header
            },
            body: {
              text: listData.body
            },
            footer: {
              text: listData.footer
            },
            action: {
              button: listData.buttonText,
              sections: listData.sections
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Send interactive list error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async sendQuickReplyButtons(to, buttonData) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: buttonData.body
            },
            action: {
              buttons: buttonData.buttons.map((button, index) => ({
                type: 'reply',
                reply: {
                  id: `btn_${index + 1}`,
                  title: button.title
                }
              }))
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Send quick reply buttons error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Smart Property Matching and Sharing
  async sharePropertyMatches(to, requirements, properties) {
    try {
      // Create formatted message with property matches
      const header = "🏠 Perfect Match Found!";
      const requirementsText = `🔍 Your Requirements: ${requirements.bhk || 'Any'} BHK | ${requirements.location || 'Any Location'} | ${requirements.budget ? `<₹${requirements.budget}L` : 'Any Budget'}`;
      const propertiesCount = properties.length;

      let body = `${requirementsText}\n📊 ${propertiesCount} Properties Available:\n\n`;

      properties.forEach((property, index) => {
        const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][index] || `${index + 1}.`;
        body += `${emoji} *${property.name}* - ₹${property.price}L\n`;
        body += `   📍 ${property.location} | ${property.status}\n`;
        body += `   👆 Tap to View Photos/Details\n\n`;
      });

      body += "💬 Reply: BOOK / CALL / MORE OPTIONS";

      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: body }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Share property matches error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Quick Replies Management (for automation)
  async setQuickReplies(replies) {
    // This would typically be done through WhatsApp Business Manager API
    // For now, we'll store them locally and use for automation
    try {
      const { query } = require('../config/database');

      for (const reply of replies) {
        await query(
          `INSERT INTO quick_replies (agent_id, shortcut, message, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (agent_id, shortcut) DO UPDATE SET
           message = EXCLUDED.message, updated_at = NOW()`,
          [reply.agentId, reply.shortcut, reply.message]
        );
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Set quick replies error:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuickReplies(agentId) {
    try {
      const { query } = require('../config/database');
      const result = await query(
        'SELECT shortcut, message FROM quick_replies WHERE agent_id = $1 ORDER BY shortcut',
        [agentId]
      );

      return {
        success: true,
        replies: result.rows
      };
    } catch (error) {
      console.error('❌ Get quick replies error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppService();