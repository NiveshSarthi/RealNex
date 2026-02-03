// Default n8n workflow templates for WhatsApp automation

const defaultWorkflows = {
  // Welcome Sequence Flow
  welcome_sequence: {
    name: "Welcome Sequence",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "welcome",
          responseMode: "responseNode",
          options: {}
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [240, 300]
      },
      {
        parameters: {
          values: {
            string: [
              {
                name: "contact_name",
                value: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"name\"]}}"
              },
              {
                name: "contact_phone",
                value: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"phone\"]}}"
              }
            ]
          }
        },
        name: "Set Contact Data",
        type: "n8n-nodes-base.set",
        typeVersion: 1,
        position: [460, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Set Contact Data\"].json[\"contact_phone\"]}}",
          message: "👋 Hi {{$node[\"Set Contact Data\"].json[\"contact_name\"]}}! Welcome to our service. How can we help you today?"
        },
        name: "Send Welcome Message",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [680, 300]
      },
      {
        parameters: {
          amount: 2,
          unit: "hours"
        },
        name: "Wait 2 Hours",
        type: "n8n-nodes-base.wait",
        typeVersion: 1,
        position: [900, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Set Contact Data\"].json[\"contact_phone\"]}}",
          message: "📋 Here's what we offer: [Your services list]"
        },
        name: "Send Service Info",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [1120, 300]
      }
    ],
    connections: {
      "Webhook": {
        main: [
          [
            {
              node: "Set Contact Data",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Set Contact Data": {
        main: [
          [
            {
              node: "Send Welcome Message",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Send Welcome Message": {
        main: [
          [
            {
              node: "Wait 2 Hours",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Wait 2 Hours": {
        main: [
          [
            {
              node: "Send Service Info",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true
    }
  },

  // Lead Nurturing Flow
  lead_nurturing: {
    name: "Lead Nurturing",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "lead-tagged",
          responseMode: "responseNode",
          options: {}
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [240, 300]
      },
      {
        parameters: {
          values: {
            string: [
              {
                name: "lead_score",
                value: "={{$node[\"Webhook\"].json[\"body\"][\"lead\"][\"score\"]}}"
              },
              {
                name: "contact_phone",
                value: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"phone\"]}}"
              }
            ]
          }
        },
        name: "Extract Lead Data",
        type: "n8n-nodes-base.set",
        typeVersion: 1,
        position: [460, 300]
      },
      {
        parameters: {
          conditions: {
            number: [
              {
                value1: "={{$node[\"Extract Lead Data\"].json[\"lead_score\"]}}",
                operation: "greater",
                value2: 50
              }
            ]
          }
        },
        name: "Check Lead Score",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [680, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Extract Lead Data\"].json[\"contact_phone\"]}}",
          message: "🎯 Great news! Based on your interest, we have a special offer just for you. Would you like to know more?"
        },
        name: "Send Personalized Offer",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [900, 200]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Extract Lead Data\"].json[\"contact_phone\"]}}",
          message: "📚 Here's some helpful information about our services. Let us know if you have any questions!"
        },
        name: "Send Educational Content",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [900, 400]
      }
    ],
    connections: {
      "Webhook": {
        main: [
          [
            {
              node: "Extract Lead Data",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Extract Lead Data": {
        main: [
          [
            {
              node: "Check Lead Score",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Check Lead Score": {
        main: [
          [
            {
              node: "Send Personalized Offer",
              type: "main",
              index: 0
            }
          ]
        ],
        main2: [
          [
            {
              node: "Send Educational Content",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true
    }
  },

  // Abandoned Cart Recovery
  abandoned_cart: {
    name: "Abandoned Cart Recovery",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "cart-abandoned",
          responseMode: "responseNode",
          options: {}
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [240, 300]
      },
      {
        parameters: {
          amount: 1,
          unit: "hours"
        },
        name: "Wait 1 Hour",
        type: "n8n-nodes-base.wait",
        typeVersion: 1,
        position: [460, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"phone\"]}}",
          message: "🛒 We noticed you were interested in our products but didn't complete your purchase. Your cart is still waiting! Click here to continue: [Cart Link]"
        },
        name: "Send Reminder",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [680, 300]
      },
      {
        parameters: {
          amount: 24,
          unit: "hours"
        },
        name: "Wait 24 Hours",
        type: "n8n-nodes-base.wait",
        typeVersion: 1,
        position: [900, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"phone\"]}}",
          message: "🎁 Don't miss out! Use code SAVE20 for 20% off your cart. Complete your purchase now: [Cart Link]"
        },
        name: "Send Discount Offer",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [1120, 300]
      }
    ],
    connections: {
      "Webhook": {
        main: [
          [
            {
              node: "Wait 1 Hour",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Wait 1 Hour": {
        main: [
          [
            {
              node: "Send Reminder",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Send Reminder": {
        main: [
          [
            {
              node: "Wait 24 Hours",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Wait 24 Hours": {
        main: [
          [
            {
              node: "Send Discount Offer",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true
    }
  },

  // Customer Feedback Collection
  feedback_collection: {
    name: "Customer Feedback Collection",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "purchase-completed",
          responseMode: "responseNode",
          options: {}
        },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [240, 300]
      },
      {
        parameters: {
          amount: 3,
          unit: "days"
        },
        name: "Wait 3 Days",
        type: "n8n-nodes-base.wait",
        typeVersion: 1,
        position: [460, 300]
      },
      {
        parameters: {
          whatsapp: {
            phoneNumberId: "={{$node[\"Webhook\"].json[\"body\"][\"whatsappAccountId\"]}}",
            accessToken: "={{$node[\"Webhook\"].json[\"body\"][\"accessToken\"]}}"
          },
          to: "={{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"phone\"]}}",
          message: "⭐ How was your experience with us? Please rate your satisfaction from 1-5 stars!"
        },
        name: "Send Feedback Request",
        type: "n8n-nodes-base.whatsapp",
        typeVersion: 1,
        position: [680, 300]
      },
      {
        parameters: {
          conditions: {
            number: [
              {
                value1: "={{$node[\"Send Feedback Request\"].json[\"rating\"]}}",
                operation: "smaller",
                value2: 3
              }
            ]
          }
        },
        name: "Check Rating",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [900, 300]
      },
      {
        parameters: {
          to: "support@company.com",
          subject: "Urgent: Low Customer Rating",
          body: "Customer {{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"name\"]}} gave a low rating. Please follow up immediately."
        },
        name: "Alert Support Team",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 1,
        position: [1120, 400]
      },
      {
        parameters: {
          to: "marketing@company.com",
          subject: "Request Testimonial",
          body: "Customer {{$node[\"Webhook\"].json[\"body\"][\"contact\"][\"name\"]}} gave a high rating. Please request a testimonial."
        },
        name: "Request Testimonial",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 1,
        position: [1120, 200]
      }
    ],
    connections: {
      "Webhook": {
        main: [
          [
            {
              node: "Wait 3 Days",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Wait 3 Days": {
        main: [
          [
            {
              node: "Send Feedback Request",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Send Feedback Request": {
        main: [
          [
            {
              node: "Check Rating",
              type: "main",
              index: 0
            }
          ]
        ]
      },
      "Check Rating": {
        main: [
          [
            {
              node: "Request Testimonial",
              type: "main",
              index: 0
            }
          ]
        ],
        main2: [
          [
            {
              node: "Alert Support Team",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true
    }
  }
};

module.exports = defaultWorkflows;