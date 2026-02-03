// Default n8n workflow configurations for SyndiTech
// These define the structure and logic for automated workflows

const defaultWorkflows = {
  // Workflow 1: WhatsApp Lead Qualification
  leadQualification: {
    name: 'WhatsApp Lead Qualification',
    description: 'Automatically qualify incoming WhatsApp leads using AI',
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'lead-qualification',
          responseMode: 'onReceived',
          options: {}
        },
        position: [240, 300]
      },
      {
        name: 'AI Qualification',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/ai/qualify',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "message": "{{$node["Webhook"].json["body"]["message"]}}",
            "context": {
              "agentId": "{{$node["Webhook"].json["body"]["agentId"]}}",
              "source": "whatsapp"
            }
          }`
        },
        position: [460, 300]
      },
      {
        name: 'Lead Assignment',
        type: 'n8n-nodes-base.switch',
        parameters: {
          conditions: {
            string: [
              {
                value1: '{{$node["AI Qualification"].json["body"]["urgency"]}}',
                operation: 'equal',
                value2: 'hot'
              }
            ]
          }
        },
        position: [680, 300]
      },
      {
        name: 'Hot Lead Actions',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/webhook/lead-qualified',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "leadId": "{{$node["Webhook"].json["body"]["leadId"]}}",
            "qualification": {{$node["AI Qualification"].json["body"]}},
            "agentId": "{{$node["Webhook"].json["body"]["agentId"]}}",
            "actions": [
              {"type": "send_catalog", "priority": "high"},
              {"type": "schedule_site_visit", "priority": "high"}
            ]
          }`
        },
        position: [900, 200]
      },
      {
        name: 'Warm Lead Actions',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/webhook/lead-qualified',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "leadId": "{{$node["Webhook"].json["body"]["leadId"]}}",
            "qualification": {{$node["AI Qualification"].json["body"]}},
            "agentId": "{{$node["Webhook"].json["body"]["agentId"]}}",
            "actions": [
              {"type": "send_property_matches", "priority": "medium"},
              {"type": "schedule_followup", "priority": "medium"}
            ]
          }`
        },
        position: [900, 400]
      }
    ],
    connections: {
      'Webhook': {
        main: [
          [
            {
              node: 'AI Qualification',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'AI Qualification': {
        main: [
          [
            {
              node: 'Lead Assignment',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Lead Assignment': {
        main: [
          [
            {
              node: 'Hot Lead Actions',
              type: 'main',
              index: 0
            }
          ],
          [
            {
              node: 'Warm Lead Actions',
              type: 'main',
              index: 1
            }
          ]
        ]
      }
    }
  },

  // Workflow 2: Automated Drip Campaign
  dripCampaign: {
    name: 'Automated Drip Campaign',
    description: 'Send personalized follow-up messages based on lead behavior',
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'drip-campaign',
          responseMode: 'onReceived'
        },
        position: [240, 300]
      },
      {
        name: 'Generate Content',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/ai/drip-content',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "name": "{{$node["Webhook"].json["body"]["leadName"]}}",
            "location": "{{$node["Webhook"].json["body"]["location"]}}",
            "budget": "{{$node["Webhook"].json["body"]["budget"]}}",
            "lastContact": "{{$node["Webhook"].json["body"]["lastContact"]}}",
            "score": "{{$node["Webhook"].json["body"]["leadScore"]}}"
          }`
        },
        position: [460, 300]
      },
      {
        name: 'Send WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/whatsapp/send',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "to": "{{$node["Webhook"].json["body"]["phone"]}}",
            "message": "{{$node["Generate Content"].json["body"]}}",
            "agentId": "{{$node["Webhook"].json["body"]["agentId"]}}"
          }`
        },
        position: [680, 300]
      },
      {
        name: 'Log Message',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/webhook/drip-generated',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "leadId": "{{$node["Webhook"].json["body"]["leadId"]}}",
            "message": "{{$node["Generate Content"].json["body"]}}",
            "phone": "{{$node["Webhook"].json["body"]["phone"]}}",
            "agentId": "{{$node["Webhook"].json["body"]["agentId"]}}",
            "campaignId": "{{$node["Webhook"].json["body"]["campaignId"]}}"
          }`
        },
        position: [900, 300]
      }
    ],
    connections: {
      'Webhook': {
        main: [
          [
            {
              node: 'Generate Content',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Generate Content': {
        main: [
          [
            {
              node: 'Send WhatsApp',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Send WhatsApp': {
        main: [
          [
            {
              node: 'Log Message',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    }
  },

  // Workflow 3: Commission Calculation
  commissionCalculation: {
    name: 'Commission Calculation',
    description: 'Automatically calculate and distribute commissions for closed deals',
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'commission-calculation',
          responseMode: 'onReceived'
        },
        position: [240, 300]
      },
      {
        name: 'Calculate Commission',
        type: 'n8n-nodes-base.function',
        parameters: {
          functionCode: `
            const deal = $node["Webhook"].json["body"];
            const baseCommission = deal.propertyPrice * (deal.commissionRate / 100);
            let totalCommission = baseCommission;

            // Split commission among collaborators
            const collaborators = deal.collaborators || [];
            const collaboratorShare = collaborators.length > 0 ? baseCommission * 0.3 : 0;
            const agentShare = baseCommission - collaboratorShare;

            const breakdown = {
              agentCommission: agentShare,
              collaboratorCommission: collaboratorShare,
              collaborators: collaborators.map(collab => ({
                id: collab.id,
                name: collab.name,
                share: collaboratorShare / collaborators.length
              }))
            };

            return {
              dealId: deal.dealId,
              totalCommission: totalCommission,
              breakdown: breakdown,
              agentId: deal.agentId
            };
          `
        },
        position: [460, 300]
      },
      {
        name: 'Store Commission',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/webhook/commission-calculated',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "dealId": "{{$node["Calculate Commission"].json["dealId"]}}",
            "commissionBreakdown": {{$node["Calculate Commission"].json["breakdown"]}},
            "totalCommission": "{{$node["Calculate Commission"].json["totalCommission"]}}",
            "agentId": "{{$node["Calculate Commission"].json["agentId"]}}"
          }`
        },
        position: [680, 300]
      },
      {
        name: 'Send Notification',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/whatsapp/send',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "to": "agent_phone_placeholder",
            "message": "🎉 Commission calculated for deal {{$node["Calculate Commission"].json["dealId"]}}! Total: ₹{{$node["Calculate Commission"].json["totalCommission"]}}",
            "agentId": "{{$node["Calculate Commission"].json["agentId"]}}"
          }`
        },
        position: [900, 300]
      }
    ],
    connections: {
      'Webhook': {
        main: [
          [
            {
              node: 'Calculate Commission',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Calculate Commission': {
        main: [
          [
            {
              node: 'Store Commission',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Store Commission': {
        main: [
          [
            {
              node: 'Send Notification',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    }
  },

  // Workflow 4: Meta Ads Lead Integration
  metaAdsIntegration: {
    name: 'Meta Ads Lead Integration',
    description: 'Process leads from Facebook/Instagram ads and integrate with CRM',
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'meta-ads-integration',
          responseMode: 'onReceived'
        },
        position: [240, 300]
      },
      {
        name: 'Validate Lead',
        type: 'n8n-nodes-base.function',
        parameters: {
          functionCode: `
            const lead = $node["Webhook"].json["body"];

            // Basic validation
            const isValid = lead.formData && lead.formData.phone && lead.formData.name;

            if (!isValid) {
              throw new Error('Invalid lead data from Meta ads');
            }

            return {
              leadData: lead.formData,
              campaignId: lead.campaignId,
              source: 'meta_ads',
              validated: true
            };
          `
        },
        position: [460, 300]
      },
      {
        name: 'Create Lead',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/leads',
          method: 'POST',
          sendHeaders: true,
          headerParameters: {
            Authorization: 'Bearer {{$node["Webhook"].json["body"]["apiToken"]}}'
          },
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "name": "{{$node["Validate Lead"].json["leadData"]["name"]}}",
            "phone": "{{$node["Validate Lead"].json["leadData"]["phone"]}}",
            "email": "{{$node["Validate Lead"].json["leadData"]["email"]}}",
            "source": "meta_ads",
            "campaignId": "{{$node["Validate Lead"].json["campaignId"]}}",
            "formData": {{$node["Validate Lead"].json["leadData"]}}
          }`
        },
        position: [680, 300]
      },
      {
        name: 'Trigger Qualification',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/trigger/lead-qualification',
          method: 'POST',
          sendHeaders: true,
          headerParameters: {
            Authorization: 'Bearer {{$node["Webhook"].json["body"]["apiToken"]}}'
          },
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "messageData": {
              "message": "{{$node["Validate Lead"].json["leadData"]["message"] || "Lead from Meta ads campaign"}}",
              "sender": "{{$node["Validate Lead"].json["leadData"]["phone"]}}",
              "timestamp": "{{new Date().toISOString()}}"
            },
            "agentId": null
          }`
        },
        position: [900, 300]
      },
      {
        name: 'Log Integration',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: '{{$node["Webhook"].json["body"]["webhookUrl"]}}/api/workflows/webhook/meta-lead-processed',
          method: 'POST',
          sendBody: true,
          bodyContentType: 'json',
          specifyBody: 'json',
          jsonBody: `{
            "leadData": {{$node["Validate Lead"].json["leadData"]}},
            "campaignId": "{{$node["Validate Lead"].json["campaignId"]}}",
            "leadId": "{{$node["Create Lead"].json["body"]["id"]}}"
          }`
        },
        position: [1120, 300]
      }
    ],
    connections: {
      'Webhook': {
        main: [
          [
            {
              node: 'Validate Lead',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Validate Lead': {
        main: [
          [
            {
              node: 'Create Lead',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Create Lead': {
        main: [
          [
            {
              node: 'Trigger Qualification',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'Trigger Qualification': {
        main: [
          [
            {
              node: 'Log Integration',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    }
  }
};

// Helper function to get workflow by type
function getWorkflowByType(type) {
  return defaultWorkflows[type] || null;
}

// Helper function to get all workflow types
function getWorkflowTypes() {
  return Object.keys(defaultWorkflows);
}

// Helper function to validate workflow structure
function validateWorkflow(workflow) {
  const required = ['name', 'description', 'nodes', 'connections'];
  return required.every(prop => workflow.hasOwnProperty(prop));
}

module.exports = {
  defaultWorkflows,
  getWorkflowByType,
  getWorkflowTypes,
  validateWorkflow
};