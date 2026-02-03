const axios = require('axios');
const crypto = require('crypto');
const { query } = require('../config/database');

class MetaAdsService {
  constructor() {
    this.graphApiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    this.appSecret = process.env.META_APP_SECRET;
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.verifyToken = process.env.META_VERIFY_TOKEN;
  }

  // Verify webhook from Meta
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('✅ Meta webhook verified successfully');
      return challenge;
    }
    return false;
  }

  // Verify webhook signature
  verifySignature(signature, body) {
    if (!signature || !this.appSecret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(body, 'utf8')
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }

  // Handle incoming lead webhook
  async handleLeadWebhook(payload) {
    try {
      const { object, entry } = payload;

      if (object === 'page') {
        for (const e of entry) {
          if (e.messaging) {
            // Handle Messenger messages
            await this.handleMessengerMessages(e.messaging);
          }

          if (e.changes) {
            // Handle lead ads
            for (const change of e.changes) {
              if (change.field === 'leadgen') {
                await this.handleLeadGen(change.value);
              }
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Meta webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle lead generation from ads
  async handleLeadGen(leadgen) {
    try {
      for (const lead of leadgen) {
        const leadData = await this.getLeadDetails(lead.leadgen_id);

        if (leadData) {
          // Create lead in our system
          await this.createLeadFromMeta(leadData, lead);

          // Trigger n8n workflow for lead processing
          const n8nService = require('./n8n');
          await n8nService.triggerMetaAdsIntegration({
            lead_id: lead.leadgen_id,
            campaign_id: lead.ad_id,
            adset_id: lead.adset_id,
            form_data: leadData,
            source: 'facebook_lead_ads',
            timestamp: new Date()
          });

          console.log(`📋 Meta lead processed: ${lead.leadgen_id}`);
        }
      }
    } catch (error) {
      console.error('❌ Lead gen processing error:', error);
    }
  }

  // Get detailed lead information
  async getLeadDetails(leadgenId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${leadgenId}`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,created_time,ad_id,adset_id,campaign_id,form_id,field_data,custom_disclaimer_responses'
          }
        }
      );

      // Transform Meta field data to structured format
      const leadData = {
        meta_lead_id: response.data.id,
        created_time: response.data.created_time,
        ad_id: response.data.ad_id,
        adset_id: response.data.adset_id,
        campaign_id: response.data.campaign_id,
        form_id: response.data.form_id,
        fields: {}
      };

      // Parse field data
      if (response.data.field_data) {
        response.data.field_data.forEach(field => {
          const key = field.name.toLowerCase().replace(/\s+/g, '_');
          leadData.fields[key] = field.values[0]; // Meta provides arrays
        });
      }

      // Extract common fields
      leadData.name = leadData.fields.full_name || leadData.fields.name || leadData.fields.first_name;
      leadData.phone = leadData.fields.phone_number || leadData.fields.phone;
      leadData.email = leadData.fields.email;

      // Extract real estate specific fields
      leadData.budget = this.parseBudget(leadData.fields.budget || leadData.fields.price_range);
      leadData.location = leadData.fields.city || leadData.fields.location || leadData.fields.preferred_location;
      leadData.property_type = leadData.fields.property_type || leadData.fields.home_type;
      leadData.bhk = this.parseBHK(leadData.fields.bhk || leadData.fields.bedrooms);

      return leadData;
    } catch (error) {
      console.error('❌ Get lead details error:', error.response?.data || error.message);
      return null;
    }
  }

  // Create lead in SyndiTech database
  async createLeadFromMeta(leadData, metaLead) {
    try {
      // Check if lead already exists
      const existingLead = await query(
        'SELECT id FROM leads WHERE phone = $1 OR email = $2 LIMIT 1',
        [leadData.phone, leadData.email]
      );

      if (existingLead.rows.length > 0) {
        console.log(`📋 Lead already exists: ${existingLead.rows[0].id}`);
        return existingLead.rows[0].id;
      }

      // Create new lead
      const result = await query(
        `INSERT INTO leads (
          name, phone, email, source, status, budget_min, budget_max,
          property_type, location, requirements, custom_fields,
          qualification_score, intent, urgency, budget_range,
          preferred_locations, property_types, ai_analyzed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING id`,
        [
          leadData.name,
          leadData.phone,
          leadData.email,
          'meta_ads',
          'new',
          leadData.budget?.min,
          leadData.budget?.max,
          leadData.property_type,
          leadData.location,
          leadData.fields.message || 'Lead from Meta ads campaign',
          JSON.stringify({
            meta_lead_id: leadData.meta_lead_id,
            ad_id: metaLead.ad_id,
            campaign_id: metaLead.campaign_id,
            form_id: leadData.form_id,
            raw_fields: leadData.fields
          }),
          75, // Default high score for paid ads
          'buying',
          'warm',
          leadData.budget?.range,
          leadData.location ? [leadData.location] : [],
          leadData.property_type ? [leadData.property_type] : [],
        ]
      );

      const leadId = result.rows[0].id;
      console.log(`👤 New Meta lead created: ${leadId}`);

      // Log the lead creation
      await query(
        `INSERT INTO lead_activities (lead_id, activity_type, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          leadId,
          'lead_created',
          'Lead created from Meta ads campaign',
          JSON.stringify({
            source: 'meta_ads',
            campaign_id: metaLead.campaign_id,
            ad_id: metaLead.ad_id
          })
        ]
      );

      return leadId;
    } catch (error) {
      console.error('❌ Create lead from Meta error:', error);
      throw error;
    }
  }

  // Handle Messenger messages (for customer support)
  async handleMessengerMessages(messages) {
    try {
      for (const message of messages) {
        if (message.message && message.message.text) {
          const senderId = message.sender.id;
          const messageText = message.message.text;

          // Find or create lead based on Facebook ID
          let leadId = await this.findLeadByFacebookId(senderId);

          if (!leadId) {
            // Create lead from Messenger
            leadId = await this.createLeadFromMessenger(senderId, message);
          }

          // Save message
          await query(
            `INSERT INTO messages (lead_id, direction, content, message_type, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [leadId, 'inbound', messageText, 'messenger']
          );

          // Trigger AI qualification
          const n8nService = require('./n8n');
          await n8nService.triggerLeadQualification({
            message: messageText,
            sender: senderId,
            timestamp: new Date(),
            source: 'facebook_messenger'
          });

          console.log(`💬 Messenger message processed from ${senderId}`);
        }
      }
    } catch (error) {
      console.error('❌ Messenger message processing error:', error);
    }
  }

  // Find lead by Facebook ID
  async findLeadByFacebookId(facebookId) {
    try {
      const result = await query(
        `SELECT l.id FROM leads l
         JOIN jsonb_object_keys(l.custom_fields) k ON k = 'facebook_id'
         WHERE l.custom_fields->>'facebook_id' = $1
         LIMIT 1`,
        [facebookId]
      );

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error('❌ Find lead by Facebook ID error:', error);
      return null;
    }
  }

  // Create lead from Messenger
  async createLeadFromMessenger(facebookId, message) {
    try {
      const result = await query(
        `INSERT INTO leads (source, status, custom_fields, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [
          'facebook_messenger',
          'new',
          JSON.stringify({
            facebook_id: facebookId,
            first_message: message.message.text
          })
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Create lead from Messenger error:', error);
      throw error;
    }
  }

  // Send message via Messenger
  async sendMessengerMessage(recipientId, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: message },
          messaging_type: 'RESPONSE'
        },
        {
          params: { access_token: this.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return {
        success: true,
        messageId: response.data.message_id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Send Messenger message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Get campaign performance data
  async getCampaignPerformance(campaignId, dateRange = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - dateRange);

      const response = await axios.get(
        `${this.baseUrl}/${campaignId}/insights`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'impressions,clicks,spend,actions,conversions,cost_per_action_type',
            time_range: JSON.stringify({
              since: since.toISOString().split('T')[0],
              until: new Date().toISOString().split('T')[0]
            }),
            level: 'campaign'
          }
        }
      );

      return response.data.data[0] || {};
    } catch (error) {
      console.error('❌ Get campaign performance error:', error.response?.data || error.message);
      return {};
    }
  }

  // Parse budget from Meta lead form
  parseBudget(budgetString) {
    if (!budgetString) return null;

    // Handle different budget formats
    const budget = budgetString.toLowerCase().replace(/[^\d.-]/g, '');

    if (budget.includes('-')) {
      const [min, max] = budget.split('-').map(b => parseFloat(b.trim()) * 100000); // Convert lakhs to rupees
      return {
        min: min,
        max: max,
        range: `${min/100000}L-${max/100000}L`
      };
    }

    const amount = parseFloat(budget) * 100000;
    return {
      min: amount * 0.9, // 10% buffer
      max: amount * 1.1,
      range: `${amount/100000}L`
    };
  }

  // Parse BHK from Meta form
  parseBHK(bhkString) {
    if (!bhkString) return null;

    const match = bhkString.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // Get ad account information
  async getAdAccountInfo() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/me/adaccounts`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,name,account_id,currency,timezone_name'
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('❌ Get ad account info error:', error.response?.data || error.message);
      return [];
    }
  }

  // Test Meta API connectivity
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/me`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,name'
          }
        }
      );

      return {
        success: true,
        data: response.data,
        message: 'Meta API connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        message: 'Meta API connection failed'
      };
    }
  }
}

module.exports = new MetaAdsService();