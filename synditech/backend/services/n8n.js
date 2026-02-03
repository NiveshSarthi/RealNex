const axios = require('axios');
const { query } = require('../config/database');

class N8nService {
  constructor() {
    this.n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    this.webhookTokens = {
      leadQualification: process.env.N8N_LEAD_QUALIFICATION_WEBHOOK,
      dripCampaign: process.env.N8N_DRIP_CAMPAIGN_WEBHOOK,
      commissionCalc: process.env.N8N_COMMISSION_CALC_WEBHOOK,
      metaAdsIntegration: process.env.N8N_META_ADS_WEBHOOK
    };
    console.log('N8nService initialized with URL:', this.n8nUrl);
  }

  // WhatsApp Lead Qualification Workflow
  async triggerLeadQualification(messageData, agentId) {
    console.log('N8nService: Triggering lead qualification workflow for agent:', agentId);
    try {
      const payload = {
        message: messageData.message,
        sender: messageData.sender,
        timestamp: messageData.timestamp,
        agentId: agentId,
        source: 'whatsapp'
      };

      const response = await axios.post(
        `${this.n8nUrl}/webhook/${this.webhookTokens.leadQualification}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Token': process.env.N8N_WEBHOOK_SECRET
          }
        }
      );

      // Store workflow execution
      await this.logWorkflowExecution('lead_qualification', payload, response.data);

      return response.data;
    } catch (error) {
      console.error('N8nService: Failed to trigger lead qualification workflow:', error.message);
      console.error('N8n lead qualification workflow error:', error);
      throw error;
    }
  }

  // Automated Drip Campaign Workflow
  async triggerDripCampaign(leadData, campaignType = 'follow_up') {
    try {
      const payload = {
        leadId: leadData.id,
        leadName: leadData.name,
        phone: leadData.phone,
        location: leadData.location,
        budget: leadData.budget,
        lastContact: leadData.last_contact,
        leadScore: leadData.score,
        campaignType: campaignType,
        agentId: leadData.agent_id
      };

      const response = await axios.post(
        `${this.n8nUrl}/webhook/${this.webhookTokens.dripCampaign}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Token': process.env.N8N_WEBHOOK_SECRET
          }
        }
      );

      await this.logWorkflowExecution('drip_campaign', payload, response.data);
      return response.data;
    } catch (error) {
      console.error('N8n drip campaign workflow error:', error);
      throw error;
    }
  }

  // Commission Calculation Workflow
  async triggerCommissionCalculation(dealData) {
    try {
      const payload = {
        dealId: dealData.id,
        propertyPrice: dealData.price,
        agentId: dealData.agent_id,
        commissionRate: dealData.commission_rate,
        collaborators: dealData.collaborators || [],
        dealType: dealData.type,
        closingDate: dealData.closing_date
      };

      const response = await axios.post(
        `${this.n8nUrl}/webhook/${this.webhookTokens.commissionCalc}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Token': process.env.N8N_WEBHOOK_SECRET
          }
        }
      );

      await this.logWorkflowExecution('commission_calculation', payload, response.data);
      return response.data;
    } catch (error) {
      console.error('N8n commission calculation workflow error:', error);
      throw error;
    }
  }

  // Meta Ads Lead Integration Workflow
  async triggerMetaAdsIntegration(adsData) {
    try {
      const payload = {
        leadId: adsData.lead_id,
        campaignId: adsData.campaign_id,
        adSetId: adsData.ad_set_id,
        formData: adsData.form_data,
        source: 'facebook_lead_ads',
        timestamp: adsData.timestamp
      };

      const response = await axios.post(
        `${this.n8nUrl}/webhook/${this.webhookTokens.metaAdsIntegration}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Token': process.env.N8N_WEBHOOK_SECRET
          }
        }
      );

      await this.logWorkflowExecution('meta_ads_integration', payload, response.data);
      return response.data;
    } catch (error) {
      console.error('N8n Meta ads integration workflow error:', error);
      throw error;
    }
  }

  // Handle incoming webhooks from n8n workflows
  async handleWebhook(workflowType, payload) {
    try {
      switch (workflowType) {
        case 'lead_qualified':
          return await this.processQualifiedLead(payload);
        case 'drip_message_generated':
          return await this.processDripMessage(payload);
        case 'commission_calculated':
          return await this.processCommissionResult(payload);
        case 'meta_lead_processed':
          return await this.processMetaLead(payload);
        default:
          console.log('Unknown workflow type:', workflowType);
          return { status: 'unknown_workflow_type' };
      }
    } catch (error) {
      console.error('N8n webhook processing error:', error);
      throw error;
    }
  }

  // Process qualified lead from workflow
  async processQualifiedLead(payload) {
    try {
      const { leadId, qualification, agentId, actions } = payload;

      // Update lead qualification in database
      await query(
        `UPDATE leads SET
         qualification_score = $1,
         intent = $2,
         urgency = $3,
         budget_range = $4,
         preferred_locations = $5,
         property_types = $6,
         timeline = $7,
         ai_analyzed_at = NOW()
         WHERE id = $8`,
        [
          qualification.lead_score,
          qualification.intent,
          qualification.urgency,
          qualification.budget_range,
          JSON.stringify(qualification.preferred_locations),
          JSON.stringify(qualification.property_types),
          qualification.timeline,
          leadId
        ]
      );

      // Assign to agent if specified
      if (agentId) {
        await query(
          'UPDATE leads SET assigned_agent = $1 WHERE id = $2',
          [agentId, leadId]
        );
      }

      // Execute recommended actions
      if (actions && actions.length > 0) {
        for (const action of actions) {
          await this.executeAction(action, leadId);
        }
      }

      return { status: 'lead_processed', leadId };
    } catch (error) {
      console.error('Process qualified lead error:', error);
      throw error;
    }
  }

  // Process drip message from workflow
  async processDripMessage(payload) {
    try {
      const { leadId, message, agentId, campaignId } = payload;

      // Send message via WhatsApp
      const WhatsAppService = require('./whatsapp');
      await WhatsAppService.sendTextMessage(payload.phone, message, agentId);

      // Log the drip message
      await query(
        `INSERT INTO drip_messages (lead_id, message, agent_id, campaign_id, sent_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [leadId, message, agentId, campaignId]
      );

      return { status: 'drip_message_sent', leadId };
    } catch (error) {
      console.error('Process drip message error:', error);
      throw error;
    }
  }

  // Process commission calculation result
  async processCommissionResult(payload) {
    try {
      const { dealId, commissionBreakdown, totalCommission } = payload;

      // Store commission details
      await query(
        `INSERT INTO commissions (deal_id, agent_id, amount, breakdown, calculated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          dealId,
          payload.agentId,
          totalCommission,
          JSON.stringify(commissionBreakdown)
        ]
      );

      // Update deal status
      await query(
        'UPDATE deals SET commission_calculated = true WHERE id = $1',
        [dealId]
      );

      return { status: 'commission_processed', dealId };
    } catch (error) {
      console.error('Process commission result error:', error);
      throw error;
    }
  }

  // Process Meta lead
  async processMetaLead(payload) {
    try {
      const { leadData, campaignId } = payload;

      // Create lead in database
      const result = await query(
        `INSERT INTO leads (name, phone, email, source, campaign_id, form_data, created_at)
         VALUES ($1, $2, $3, 'meta_ads', $4, $5, NOW())
         RETURNING id`,
        [
          leadData.name,
          leadData.phone,
          leadData.email,
          campaignId,
          JSON.stringify(leadData)
        ]
      );

      const leadId = result.rows[0].id;

      // Trigger lead qualification workflow
      await this.triggerLeadQualification({
        message: leadData.message || 'Lead from Meta ads',
        sender: leadData.phone,
        timestamp: new Date()
      });

      return { status: 'meta_lead_processed', leadId };
    } catch (error) {
      console.error('Process Meta lead error:', error);
      throw error;
    }
  }

  // Execute recommended actions from AI
  async executeAction(action, leadId) {
    try {
      switch (action.type) {
        case 'send_catalog':
          // Trigger catalog sharing
          break;
        case 'schedule_followup':
          // Schedule automated follow-up
          break;
        case 'assign_agent':
          // Assign to specific agent
          break;
        case 'send_property_matches':
          // Send property recommendations
          break;
        default:
          console.log('Unknown action type:', action.type);
      }
    } catch (error) {
      console.error('Execute action error:', error);
    }
  }

  // Log workflow executions
  async logWorkflowExecution(workflowType, inputData, outputData) {
    try {
      await query(
        `INSERT INTO workflow_executions (workflow_type, input_data, output_data, executed_at)
         VALUES ($1, $2, $3, NOW())`,
        [workflowType, JSON.stringify(inputData), JSON.stringify(outputData)]
      );
    } catch (error) {
      console.error('Log workflow execution error:', error);
    }
  }

  // Get workflow execution history
  async getWorkflowHistory(workflowType = null, limit = 50) {
    try {
      let queryText = 'SELECT * FROM workflow_executions';
      const values = [];

      if (workflowType) {
        queryText += ' WHERE workflow_type = $1';
        values.push(workflowType);
      }

      queryText += ' ORDER BY executed_at DESC LIMIT $' + (values.length + 1);
      values.push(limit);

      const result = await query(queryText, values);
      return result.rows;
    } catch (error) {
      console.error('Get workflow history error:', error);
      return [];
    }
  }

  // Test workflow connectivity
  async testWorkflowConnection(workflowType) {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date(),
        message: 'Test connection from SyndiTech'
      };

      const response = await axios.post(
        `${this.n8nUrl}/webhook/${this.webhookTokens[workflowType]}`,
        testPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Token': process.env.N8N_WEBHOOK_SECRET
          }
        }
      );

      return { status: 'connected', response: response.data };
    } catch (error) {
      return { status: 'failed', error: error.message };
    }
  }

  // Get workflow statistics
  async getWorkflowStats() {
    try {
      const result = await query(`
        SELECT
          workflow_type,
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(executed_at) as last_execution
        FROM workflow_executions
        WHERE executed_at >= NOW() - INTERVAL '30 days'
        GROUP BY workflow_type
        ORDER BY total_executions DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('Get workflow stats error:', error);
      return [];
    }
  }
}

module.exports = new N8nService();