const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://graph.facebook.com/v18.0';
const CalculatorService = require('./calculator');
const SchedulingService = require('./scheduling');

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    // Advanced Chatbot Configuration
    this.chatbotConfig = {
      enabled: true,
      mode: 'hybrid', // ai, rule-based, or hybrid
      business_hours: {
        enabled: true,
        timezone: 'Asia/Kolkata',
        schedule: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '10:00', end: '16:00' },
          sunday: 'OFF'
        },
        after_hours_response: 'auto',
        holiday_calendar: 'IN'
      },
      conversation_flow: {
        greeting: {
          enabled: true,
          messages: {
            first_time: '👋 Hi {{name}}! Welcome to [Company]. I\'m your AI assistant. How can I help you today?',
            returning: 'Welcome back {{name}}! 😊 How can I assist you today?',
            after_hours: 'Hi! We\'re currently offline. Our team is available {{next_available_time}}. I can still help you with basic queries!'
          },
          delay_seconds: 2
        },
        intent_detection: {
          enabled: true,
          confidence_threshold: 0.7,
          supported_intents: [
            {
              intent: 'property_inquiry',
              keywords: ['property', 'flat', 'apartment', 'house', 'villa', 'buy', 'rent'],
              action: 'trigger_flow',
              flow_id: 'property_search'
            },
            {
              intent: 'schedule_visit',
              keywords: ['visit', 'viewing', 'see property', 'show', 'tour'],
              action: 'trigger_flow',
              flow_id: 'site_visit_booking'
            },
            {
              intent: 'emi_calculator',
              keywords: ['emi', 'loan', 'finance', 'monthly payment'],
              action: 'trigger_calculator',
              calculator_type: 'emi'
            },
            {
              intent: 'property_valuation',
              keywords: ['valuation', 'worth', 'value', 'price estimate'],
              action: 'trigger_calculator',
              calculator_type: 'valuation'
            },
            {
              intent: 'affordability_check',
              keywords: ['afford', 'budget', 'can afford', 'how much can i'],
              action: 'trigger_calculator',
              calculator_type: 'affordability'
            },
            {
              intent: 'rental_yield',
              keywords: ['rental yield', 'rent return', 'rental income'],
              action: 'trigger_calculator',
              calculator_type: 'rental_yield'
            },
            {
              intent: 'stamp_duty',
              keywords: ['stamp duty', 'registration', 'transfer charges'],
              action: 'trigger_calculator',
              calculator_type: 'stamp_duty'
            },
            {
              intent: 'roi_calculator',
              keywords: ['roi', 'return on investment', 'profit', 'returns'],
              action: 'trigger_calculator',
              calculator_type: 'roi'
            },
            {
              intent: 'document_query',
              keywords: ['documents', 'paperwork', 'legal', 'registration'],
              action: 'send_document_list'
            },
            {
              intent: 'complaint',
              keywords: ['issue', 'problem', 'complaint', 'not working', 'help'],
              action: 'escalate_to_human',
              priority: 'high'
            }
          ]
        },
        fallback_handling: {
          enabled: true,
          max_failed_attempts: 3,
          responses: [
            'I\'m not sure I understand. Let me connect you with a team member.',
            'I want to make sure I help you correctly. Let me get a human agent for you.'
          ],
          action_after_max_attempts: 'assign_to_agent'
        },
        human_handoff: {
          enabled: true,
          triggers: [
            'user_requests_human',
            'intent_confidence_low',
            'max_fallback_reached',
            'negative_sentiment_detected',
            'vip_customer'
          ],
          handoff_message: 'Let me connect you with {{agent_name}} who will be able to help you better. One moment please... ⏳',
          agent_assignment_strategy: 'round_robin'
        },
        context_retention: {
          enabled: true,
          memory_duration: '24_hours',
          store_user_preferences: true,
          remember_past_inquiries: true
        }
      },
      ai_features: {
        natural_language_understanding: true,
        sentiment_analysis: true,
        language_detection: true,
        auto_translation: false,
        response_personalization: true,
        learning_mode: true
      },
      quick_replies: {
        enabled: true,
        suggestions: [
          '🏠 Search Properties',
          '📅 Schedule Visit',
          '💰 Calculate EMI',
          '🏠 Property Valuation',
          '💵 Affordability Check',
          '📊 Rental Yield',
          '📄 Stamp Duty Calculator',
          '📈 ROI Calculator',
          '📞 Talk to Agent',
          '📋 Required Documents',
          '❓ FAQs'
        ]
      },
      rich_media: {
        enabled: true,
        auto_send_images: true,
        auto_send_videos: false,
        property_carousel: true,
        virtual_tour_links: true,
        location_sharing: true
      }
    };

    // Context storage for conversations
    this.conversationContexts = new Map();
  }

  // Send text message
  async sendTextMessage(to, message) {
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
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send template message
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
            language: { code: 'en_US' },
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
      console.error('Error sending template message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send media message
  async sendMediaMessage(to, mediaType, mediaUrl, caption = '') {
    try {
      const messageData = {
        messaging_product: 'whatsapp',
        to: to,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl
        }
      };

      if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
        messageData[mediaType].caption = caption;
      }

      if (mediaType === 'document') {
        messageData[mediaType].filename = 'document'; // Can be customized
      }

      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        messageData,
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
      console.error('Error sending media message:', error.response?.data || error.message);
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
                  id: `button_${index + 1}`,
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
      console.error('Error sending interactive message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send list message
  async sendListMessage(to, headerText, bodyText, buttonText, sections) {
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
              text: headerText
            },
            body: {
              text: bodyText
            },
            action: {
              button: buttonText,
              sections: sections
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
      console.error('Error sending list message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Send quick reply buttons (using interactive buttons)
  async sendQuickReplyButtons(to, data) {
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
              text: data.text
            },
            action: {
              buttons: data.buttons.map((button, index) => ({
                type: 'reply',
                reply: {
                  id: button.id || `btn_${index + 1}`,
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
      console.error('Error sending quick reply buttons:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
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
      console.error('Error getting message status:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Verify webhook
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return challenge;
    }
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
      console.error('Error handling webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Process incoming message
  async processIncomingMessage(message) {
    try {
      const { query } = require('../config/database');
      const Conversation = require('../models/Conversation');
      const Message = require('../models/Message');

      const { from, id, timestamp, text, type, image, video, audio, document } = message;

      // Find or create contact
      let contactResult = await query(
        'SELECT id FROM contacts WHERE whatsapp_number = $1 LIMIT 1',
        [from]
      );

      let contactId;
      if (contactResult.rows.length === 0) {
        // Create new contact
        const contactInsert = await query(
          'INSERT INTO contacts (whatsapp_number, first_name) VALUES ($1, $2) RETURNING id',
          [from, 'Unknown']
        );
        contactId = contactInsert.rows[0].id;
      } else {
        contactId = contactResult.rows[0].id;
      }

      // Find or create conversation
      let conversation = await Conversation.findByContact(contactId)[0]?.conversation;
      if (!conversation) {
        // For now, assume default WhatsApp account ID = 1 (to be improved)
        conversation = await Conversation.create({
          whatsappAccountId: 1,
          contactId: contactId,
          status: 'open',
          channel: 'whatsapp'
        });
      }

      // Determine message type and content
      let messageType = 'text';
      let content = text?.body || '';
      let mediaUrl = null;
      let mediaCaption = null;
      let mediaFilename = null;

      if (type === 'image') {
        messageType = 'image';
        mediaUrl = image?.link;
        mediaCaption = image?.caption;
      } else if (type === 'video') {
        messageType = 'video';
        mediaUrl = video?.link;
        mediaCaption = video?.caption;
      } else if (type === 'audio') {
        messageType = 'audio';
        mediaUrl = audio?.link;
      } else if (type === 'document') {
        messageType = 'document';
        mediaUrl = document?.link;
        mediaFilename = document?.filename;
        mediaCaption = document?.caption;
      }

      // Save message
      await Message.create({
        conversationId: conversation.id,
        whatsappMessageId: id,
        direction: 'inbound',
        messageType,
        content,
        mediaUrl,
        mediaCaption,
        mediaFilename,
        status: 'delivered'
      });

      // Update conversation
      await conversation.update({
        last_message_at: new Date(),
        status: 'open'
      });

      console.log(`Processed incoming message from ${from}: ${content || 'Media message'}`);

      // Trigger advanced chatbot response
      if (this.chatbotConfig.enabled && content) {
        try {
          // Get contact name (simplified)
          const contactName = 'User'; // TODO: Get from database

          await this.handleChatbotResponse(from, content, contactName);
        } catch (error) {
          console.error('Error in chatbot response:', error);
          // Fallback to basic response
          await this.sendTextMessage(from, 'I\'m here to help! Please try again or contact our support team.');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing incoming message:', error);
      return { success: false, error: error.message };
    }
  }

  // Get business profile
  async getBusinessProfile() {
    try {
      const response = await axios.get(
        `${BASE_URL}/${this.phoneNumberId}`,
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
      console.error('Error getting business profile:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Update business profile
  async updateBusinessProfile(updates) {
    try {
      const response = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}`,
        updates,
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
      console.error('Error updating business profile:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Advanced Chatbot Methods

  // Check if within business hours
  isWithinBusinessHours() {
    if (!this.chatbotConfig.business_hours.enabled) return true;

    const now = new Date();
    const timezone = this.chatbotConfig.business_hours.timezone;
    // For simplicity, assuming IST for now
    const day = now.toLocaleLowerCase('en-IN', { weekday: 'long', timeZone: timezone });
    const time = now.toLocaleTimeString('en-IN', { hour12: false, timeZone: timezone }).substring(0, 5);

    const schedule = this.chatbotConfig.business_hours.schedule[day];
    if (!schedule || schedule === 'OFF') return false;

    return time >= schedule.start && time <= schedule.end;
  }

  // Get next available time
  getNextAvailableTime() {
    // Simplified implementation
    return 'tomorrow at 9:00 AM';
  }

  // Detect intent from message
  detectIntent(message) {
    const text = message.toLowerCase();
    const intents = this.chatbotConfig.conversation_flow.intent_detection.supported_intents;

    for (const intent of intents) {
      for (const keyword of intent.keywords) {
        if (text.includes(keyword)) {
          return {
            intent: intent.intent,
            confidence: 0.8, // Simplified confidence scoring
            action: intent.action,
            flow_id: intent.flow_id,
            calculator_type: intent.calculator_type,
            priority: intent.priority
          };
        }
      }
    }

    return null;
  }

  // Get conversation context
  getConversationContext(contactId) {
    return this.conversationContexts.get(contactId) || {
      conversation_state: 'greeting',
      failed_attempts: 0,
      last_intent: null,
      user_preferences: {},
      conversation_history: []
    };
  }

  // Update conversation context
  updateConversationContext(contactId, updates) {
    const context = this.getConversationContext(contactId);
    const newContext = { ...context, ...updates };
    this.conversationContexts.set(contactId, newContext);
    return newContext;
  }

  // Handle chatbot response
  async handleChatbotResponse(contactId, message, contactName = 'User') {
    const context = this.getConversationContext(contactId);

    // Check if user is in calculator flow
    if (context.calculator_state) {
      await this.processCalculatorInput(contactId, message);
      return;
    }

    // Check if user is in booking flow
    if (context.booking_state) {
      await this.processBookingInput(contactId, message, context);
      return;
    }

    const intent = this.detectIntent(message);

    // Check business hours
    if (!this.isWithinBusinessHours()) {
      const afterHoursMessage = this.chatbotConfig.conversation_flow.greeting.messages.after_hours
        .replace('{{next_available_time}}', this.getNextAvailableTime());

      await this.sendTextMessage(contactId, afterHoursMessage);
      return;
    }

    // Handle greeting for new conversations
    if (context.conversation_state === 'greeting') {
      const greetingMessage = this.chatbotConfig.conversation_flow.greeting.messages.first_time
        .replace('{{name}}', contactName);

      await this.sendTextMessage(contactId, greetingMessage);

      // Send quick replies
      if (this.chatbotConfig.quick_replies.enabled) {
        await this.sendQuickReplyButtons(contactId, {
          text: 'How can I help you today?',
          buttons: this.chatbotConfig.quick_replies.suggestions.map((reply, index) => ({
            title: reply,
            id: `quick_reply_${index + 1}`
          }))
        });
      }

      this.updateConversationContext(contactId, { conversation_state: 'active' });
      return;
    }

    // Handle intent-based responses
    if (intent) {
      await this.handleIntentAction(contactId, intent, message);
      this.updateConversationContext(contactId, {
        last_intent: intent.intent,
        failed_attempts: 0
      });
    } else {
      // Fallback handling
      await this.handleFallback(contactId, message);
    }
  }

  // Handle specific intent actions
  async handleIntentAction(contactId, intent, message) {
    switch (intent.action) {
      case 'trigger_flow':
        await this.triggerFlow(contactId, intent.flow_id, message);
        break;
      case 'trigger_calculator':
        await this.triggerCalculator(contactId, intent.calculator_type);
        break;
      case 'send_document_list':
        await this.sendDocumentList(contactId);
        break;
      case 'escalate_to_human':
        await this.escalateToHuman(contactId, intent.priority);
        break;
      default:
        await this.sendTextMessage(contactId, 'I\'m processing your request...');
    }
  }

  // Trigger specific flows
  async triggerFlow(contactId, flowId, message) {
    switch (flowId) {
      case 'property_search':
        await this.handlePropertySearch(contactId, message);
        break;
      case 'site_visit_booking':
        await this.handleSiteVisitBooking(contactId);
        break;
      default:
        await this.sendTextMessage(contactId, 'Let me help you with that...');
    }
  }

  // Property search flow
  async handlePropertySearch(contactId, message) {
    // Extract budget/location from message (simplified)
    const budget = this.extractBudget(message);
    const location = this.extractLocation(message);

    await this.sendTextMessage(contactId,
      `Great! I can help you find properties. Based on your message, I see you're interested in ${location || 'properties'} with budget around ₹${budget || 'TBD'}.\n\nLet me search our database...`
    );

    // Send property options (simplified)
    await this.sendInteractiveMessage(contactId,
      '🏠 Property Search Results',
      'Here are some matching properties:',
      [
        { title: 'View Details' },
        { title: 'Schedule Visit' },
        { title: 'Calculate EMI' }
      ]
    );
  }

  // Site visit booking flow
  async handleSiteVisitBooking(contactId) {
    const context = this.getConversationContext(contactId);

    // Check if property is already selected
    if (!context.selected_property) {
      await this.sendTextMessage(contactId,
        '📅 I\'d be happy to schedule a site visit for you!\n\nFirst, which property would you like to visit? Please reply with the property name or "Show my interested properties".'
      );
      this.updateConversationContext(contactId, {
        booking_state: 'awaiting_property_selection',
        booking_type: 'site_visit'
      });
      return;
    }

    // Property is selected, proceed to date selection
    await this.sendDateSelectionOptions(contactId);
  }

  // Send date selection options
  async sendDateSelectionOptions(contactId) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekend = new Date(today);
    const daysUntilSaturday = (6 - today.getDay()) % 7;
    weekend.setDate(today.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));

    const options = [
      `• Today (${today.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })})`,
      `• Tomorrow (${tomorrow.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })})`,
      `• This Weekend (${weekend.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })})`,
      '• Choose Specific Date 📅'
    ];

    await this.sendTextMessage(contactId,
      '📅 When would you prefer to visit?\n\n' + options.join('\n') + '\n\nReply with your choice:'
    );

    this.updateConversationContext(contactId, {
      booking_state: 'awaiting_date_selection'
    });
  }

  // Process booking inputs
  async processBookingInput(contactId, message, context) {
    const state = context.booking_state;

    switch (state) {
      case 'awaiting_property_selection':
        await this.processPropertySelection(contactId, message);
        break;
      case 'awaiting_date_selection':
        await this.processDateSelection(contactId, message, context);
        break;
      case 'awaiting_time_selection':
        await this.processTimeSelection(contactId, message, context);
        break;
      case 'awaiting_visitor_count':
        await this.processVisitorCount(contactId, message, context);
        break;
      case 'awaiting_confirmation':
        await this.processBookingConfirmation(contactId, message, context);
        break;
    }
  }

  // Process property selection
  async processPropertySelection(contactId, message) {
    // Simplified - in real implementation, this would search properties
    const propertyName = message.trim();

    this.updateConversationContext(contactId, {
      selected_property: propertyName,
      booking_state: 'awaiting_date_selection'
    });

    await this.sendDateSelectionOptions(contactId);
  }

  // Process date selection
  async processDateSelection(contactId, message, context) {
    let selectedDate;

    const today = new Date();
    const messageLower = message.toLowerCase();

    if (messageLower.includes('today')) {
      selectedDate = today;
    } else if (messageLower.includes('tomorrow')) {
      selectedDate = new Date(today);
      selectedDate.setDate(selectedDate.getDate() + 1);
    } else if (messageLower.includes('weekend') || messageLower.includes('saturday') || messageLower.includes('sunday')) {
      const daysUntilSaturday = (6 - today.getDay()) % 7;
      selectedDate = new Date(today);
      selectedDate.setDate(today.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
    } else {
      // Try to parse specific date
      // For simplicity, assume they want to choose today
      selectedDate = today;
    }

    // Get available slots for the selected date
    const availableSlots = await SchedulingService.getAvailableSlots(selectedDate, 'site_visit');

    if (availableSlots.length === 0) {
      await this.sendTextMessage(contactId,
        '❌ Sorry, no slots are available for the selected date. Please choose another date or reply "Try tomorrow".'
      );
      return;
    }

    // Format and send available slots
    const slotOptions = availableSlots.slice(0, 6).map((slot, index) => {
      const timeStr = slot.start.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `• ${timeStr} (${slot.duration} min)`;
    });

    await this.sendTextMessage(contactId,
      `✅ Available slots for ${selectedDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}:\n\n${slotOptions.join('\n')}\n\nReply with your preferred time (e.g., "11:00 AM"):`
    );

    this.updateConversationContext(contactId, {
      selected_date: selectedDate.toISOString(),
      available_slots: availableSlots,
      booking_state: 'awaiting_time_selection'
    });
  }

  // Process time selection
  async processTimeSelection(contactId, message, context) {
    const availableSlots = context.available_slots;
    const selectedDate = new Date(context.selected_date);

    // Parse time from message
    const timeMatch = message.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
    if (!timeMatch) {
      await this.sendTextMessage(contactId, '❌ Please provide a valid time (e.g., "11:00 AM" or "2:30 PM"):');
      return;
    }

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const selectedTime = new Date(selectedDate);
    selectedTime.setHours(hours, minutes, 0, 0);

    // Find matching slot
    const selectedSlot = availableSlots.find(slot =>
      slot.start.getTime() === selectedTime.getTime()
    );

    if (!selectedSlot) {
      await this.sendTextMessage(contactId,
        '❌ Selected time is not available. Please choose from the available slots above:'
      );
      return;
    }

    this.updateConversationContext(contactId, {
      selected_slot: selectedSlot,
      booking_state: 'awaiting_visitor_count'
    });

    await this.sendTextMessage(contactId,
      `✅ Selected: ${selectedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}\n\nHow many people will be visiting?\n\n• Just me\n• 2 people\n• 3 people\n• 4+ people\n\nReply with the number:`
    );
  }

  // Process visitor count
  async processVisitorCount(contactId, message, context) {
    const countMatch = message.match(/(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;

    if (count < 1 || count > 10) {
      await this.sendTextMessage(contactId, '❌ Please provide a valid number of visitors (1-10):');
      return;
    }

    const bookingData = {
      ...context,
      visitor_count: count
    };

    this.updateConversationContext(contactId, {
      visitor_count: count,
      booking_state: 'awaiting_confirmation'
    });

    // Generate booking summary
    const summary = this.generateBookingSummary(bookingData);
    await this.sendTextMessage(contactId, summary);

    await this.sendInteractiveMessage(contactId,
      'Confirm your booking?',
      'Please confirm:',
      [
        { title: '✅ Confirm Booking' },
        { title: '🔄 Change Time' },
        { title: '❌ Cancel' }
      ]
    );
  }

  // Process booking confirmation
  async processBookingConfirmation(contactId, message, context) {
    const messageLower = message.toLowerCase();

    if (messageLower.includes('confirm') || messageLower.includes('yes')) {
      // Book the appointment
      const bookingResult = await SchedulingService.bookAppointment({
        contactId: contactId,
        agentId: null, // Will be assigned by system
        appointmentType: 'site_visit',
        scheduledAt: context.selected_slot.start.toISOString(),
        propertyId: null, // Would be set based on selected property
        notes: `Booked via WhatsApp - ${context.visitor_count} visitors`,
        visitorCount: context.visitor_count
      });

      if (bookingResult.success) {
        const confirmationMessage = `🎉 *Booking Confirmed!*\n\n📅 ${context.selected_slot.start.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}\n⏰ ${context.selected_slot.start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}\n👥 ${context.visitor_count} visitor(s)\n🏠 ${context.selected_property}\n\n📍 Location details will be sent 24 hours before the visit.\n\nBooking ID: ${bookingResult.appointmentId}\n\nNeed to make changes? Reply "Change booking" or call our support.`;

        await this.sendTextMessage(contactId, confirmationMessage);

        // Clear booking context
        this.updateConversationContext(contactId, {
          booking_state: null,
          booking_type: null,
          selected_property: null,
          selected_date: null,
          selected_slot: null,
          visitor_count: null,
          available_slots: null
        });
      } else {
        await this.sendTextMessage(contactId, '❌ Sorry, there was an error booking your appointment. Please try again or contact support.');
      }
    } else if (messageLower.includes('change') || messageLower.includes('modify')) {
      await this.sendDateSelectionOptions(contactId);
      this.updateConversationContext(contactId, { booking_state: 'awaiting_date_selection' });
    } else {
      await this.sendTextMessage(contactId, 'Booking cancelled. Feel free to book again anytime!');
      // Clear booking context
      this.updateConversationContext(contactId, {
        booking_state: null,
        booking_type: null,
        selected_property: null,
        selected_date: null,
        selected_slot: null,
        visitor_count: null,
        available_slots: null
      });
    }
  }

  // Generate booking summary
  generateBookingSummary(bookingData) {
    const slot = bookingData.selected_slot;
    const dateStr = slot.start.toLocaleDateString('en-IN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = slot.start.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `📋 *Booking Summary*\n\n🏠 Property: ${bookingData.selected_property}\n📅 Date: ${dateStr}\n⏰ Time: ${timeStr}\n👥 Visitors: ${bookingData.visitor_count}\n⏱️ Duration: ${slot.duration} minutes\n\n💰 No booking fee required\n📍 Location details will be shared before visit`;
  }

  // Trigger calculator
  async triggerCalculator(contactId, calculatorType) {
    switch (calculatorType) {
      case 'emi':
        await this.startEMICalculator(contactId);
        break;
      case 'valuation':
        await this.startPropertyValuationCalculator(contactId);
        break;
      case 'affordability':
        await this.startAffordabilityCalculator(contactId);
        break;
      case 'rental_yield':
        await this.startRentalYieldCalculator(contactId);
        break;
      case 'stamp_duty':
        await this.startStampDutyCalculator(contactId);
        break;
      case 'roi':
        await this.startROICalculator(contactId);
        break;
      default:
        await this.sendTextMessage(contactId, 'Calculator feature coming soon!');
    }
  }

  // EMI Calculator Interactive Flow
  async startEMICalculator(contactId) {
    const context = this.getConversationContext(contactId);
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_property_price',
      calculator_type: 'emi'
    });

    await this.sendTextMessage(contactId,
      '💰 *EMI Calculator*\n\nLet\'s calculate your monthly EMI!\n\nPlease provide the *property price* (e.g., "9500000" for ₹95 lakhs):'
    );
  }

  // Process calculator input
  async processCalculatorInput(contactId, message) {
    const context = this.getConversationContext(contactId);

    switch (context.calculator_type) {
      case 'emi':
        await this.processEMIInput(contactId, message, context);
        break;
      case 'valuation':
        await this.processValuationInput(contactId, message, context);
        break;
      case 'affordability':
        await this.processAffordabilityInput(contactId, message, context);
        break;
      case 'rental_yield':
        await this.processRentalYieldInput(contactId, message, context);
        break;
      case 'stamp_duty':
        await this.processStampDutyInput(contactId, message, context);
        break;
      case 'roi':
        await this.processROIInput(contactId, message, context);
        break;
    }
  }

  // Process EMI calculator inputs
  async processEMIInput(contactId, message, context) {
    const state = context.calculator_state;

    switch (state) {
      case 'awaiting_property_price':
        const price = this.extractNumber(message);
        if (price && price > 0) {
          this.updateConversationContext(contactId, {
            calculator_data: { propertyPrice: price },
            calculator_state: 'awaiting_down_payment'
          });

          await this.sendTextMessage(contactId,
            `✅ Property Price: ₹${this.formatCurrency(price)}\n\nNow, what's your *down payment percentage*? (Typically 20%)\n\nReply with a number (e.g., "20" for 20%):`
          );
        } else {
          await this.sendTextMessage(contactId,
            '❌ Please provide a valid property price (e.g., "9500000" for ₹95 lakhs):'
          );
        }
        break;

      case 'awaiting_down_payment':
        const downPaymentPercent = this.extractNumber(message);
        if (downPaymentPercent && downPaymentPercent >= 0 && downPaymentPercent <= 100) {
          const data = context.calculator_data;
          data.downPaymentPercent = downPaymentPercent;

          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_tenure'
          });

          await this.sendTextMessage(contactId,
            `✅ Down Payment: ${downPaymentPercent}%\n\nFinally, what's the *loan tenure* in years? (Typically 15-20 years)\n\nReply with years (e.g., "20"):`
          );
        } else {
          await this.sendTextMessage(contactId,
            '❌ Please provide a valid down payment percentage (0-100):'
          );
        }
        break;

      case 'awaiting_tenure':
        const tenure = this.extractNumber(message);
        if (tenure && tenure > 0 && tenure <= 30) {
          const data = context.calculator_data;

          // Calculate EMI
          const result = CalculatorService.calculateEMIWithDownPayment(
            data.propertyPrice,
            data.downPaymentPercent,
            8.5, // Default interest rate
            tenure
          );

          // Send detailed result
          const resultMessage = this.formatEMIResult(result);
          await this.sendTextMessage(contactId, resultMessage);

          // Offer next steps
          await this.sendInteractiveMessage(contactId,
            'What would you like to do next?',
            'Choose an option:',
            [
              { title: '🔄 Recalculate' },
              { title: '🏠 View Properties' },
              { title: '📅 Schedule Visit' },
              { title: '📞 Talk to Advisor' }
            ]
          );

          // Reset calculator state
          this.updateConversationContext(contactId, {
            calculator_state: null,
            calculator_type: null,
            calculator_data: null
          });
        } else {
          await this.sendTextMessage(contactId,
            '❌ Please provide a valid tenure in years (1-30):'
          );
        }
        break;
    }
  }

  // Format EMI calculation result
  formatEMIResult(result) {
    return `🏠 *EMI Calculation Result*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Loan Details*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Property Price: ₹${this.formatCurrency(result.propertyPrice)}
Down Payment (${result.downPaymentPercent}%): ₹${this.formatCurrency(result.downPayment)}
Loan Amount: ₹${this.formatCurrency(result.loanAmount)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *EMI Breakdown*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly EMI: ₹${this.formatCurrency(result.monthlyEMI)}
Interest Rate: ${result.interestRate}% p.a.
Tenure: ${result.tenureYears} years

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *Total Cost*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Interest: ₹${this.formatCurrency(result.totalInterest)}
Total Amount: ₹${this.formatCurrency(result.totalAmount)}

💡 *Tax Benefit*: Save up to ₹${this.formatCurrency(result.totalInterest * 0.3)} on interest (Section 24)`;
  }

  // Property Valuation Calculator
  async startPropertyValuationCalculator(contactId) {
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_property_type',
      calculator_type: 'valuation'
    });

    await this.sendTextMessage(contactId,
      '🏠 *Property Valuation Calculator*\n\nLet\'s estimate your property value!\n\nWhat type of property is it?\n\n• Apartment\n• Villa\n• Plot\n• Penthouse\n\nReply with the property type:'
    );
  }

  async processValuationInput(contactId, message, context) {
    const state = context.calculator_state;
    const data = context.calculator_data || {};

    switch (state) {
      case 'awaiting_property_type':
        const propertyType = message.toLowerCase().trim();
        if (['apartment', 'villa', 'plot', 'penthouse'].includes(propertyType)) {
          data.type = propertyType;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_area'
          });
          await this.sendTextMessage(contactId, `✅ Property Type: ${propertyType}\n\nWhat's the built-up area in square feet? (e.g., "1200"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please choose from: Apartment, Villa, Plot, or Penthouse');
        }
        break;

      case 'awaiting_area':
        const area = this.extractNumber(message);
        if (area && area > 0) {
          data.areaSqft = area;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_location'
          });
          await this.sendTextMessage(contactId, `✅ Area: ${area} sq.ft\n\nWhich city is the property in? (e.g., "Mumbai"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid area in square feet:');
        }
        break;

      case 'awaiting_location':
        const city = message.trim();
        if (city) {
          data.city = city;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_bedrooms'
          });
          await this.sendTextMessage(contactId, `✅ City: ${city}\n\nHow many bedrooms? (e.g., "3" or "studio"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide the city name:');
        }
        break;

      case 'awaiting_bedrooms':
        const bedrooms = message.toLowerCase().includes('studio') ? 0 : this.extractNumber(message);
        if (bedrooms !== null && bedrooms >= 0) {
          data.bedrooms = bedrooms;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_age'
          });
          await this.sendTextMessage(contactId, `✅ Bedrooms: ${bedrooms || 'Studio'}\n\nHow old is the property in years? (e.g., "5"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide number of bedrooms or "studio":');
        }
        break;

      case 'awaiting_age':
        const age = this.extractNumber(message);
        if (age !== null && age >= 0) {
          data.age = age;

          // Calculate valuation
          const result = CalculatorService.calculatePropertyValuation(
            {
              type: data.type,
              areaSqft: data.areaSqft,
              bedrooms: data.bedrooms,
              age: data.age
            },
            { city: data.city, area: data.city },
            {}
          );

          const resultMessage = this.formatValuationResult(result);
          await this.sendTextMessage(contactId, resultMessage);

          // Reset calculator state
          this.updateConversationContext(contactId, {
            calculator_state: null,
            calculator_type: null,
            calculator_data: null
          });
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide property age in years:');
        }
        break;
    }
  }

  formatValuationResult(result) {
    return `🏠 *Property Valuation Report*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Estimated Value*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
₹${this.formatCurrency(result.estimatedValue)}

Price per sq.ft: ₹${this.formatCurrency(result.pricePerSqft)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Valuation Factors*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Base Price/sq.ft: ₹${this.formatCurrency(result.basePricePerSqft)}
• Type Multiplier: ${result.adjustments.typeMultiplier}x
• Bedroom Adjustment: ${result.adjustments.bedroomAdjustment}x
• Age Depreciation: ${(result.adjustments.ageDepreciation * 100).toFixed(1)}%

💡 *This is an estimate based on market data. Actual value may vary.*`;
  }

  // Affordability Calculator
  async startAffordabilityCalculator(contactId) {
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_income',
      calculator_type: 'affordability'
    });

    await this.sendTextMessage(contactId,
      '💰 *Affordability Calculator*\n\nLet\'s see how much property you can afford!\n\nWhat\'s your monthly income? (e.g., "100000" for ₹1 lakh):'
    );
  }

  async processAffordabilityInput(contactId, message, context) {
    const state = context.calculator_state;
    const data = context.calculator_data || {};

    switch (state) {
      case 'awaiting_income':
        const income = this.extractNumber(message);
        if (income && income > 0) {
          data.monthlyIncome = income;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_obligations'
          });
          await this.sendTextMessage(contactId, `✅ Monthly Income: ₹${this.formatCurrency(income)}\n\nDo you have existing EMIs or loans? If yes, total monthly amount (e.g., "25000" or "0" if none):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid monthly income:');
        }
        break;

      case 'awaiting_obligations':
        const obligations = this.extractNumber(message) || 0;
        if (obligations >= 0) {
          const result = CalculatorService.calculateAffordability(data.monthlyIncome, obligations, 0);

          const resultMessage = this.formatAffordabilityResult(result);
          await this.sendTextMessage(contactId, resultMessage);

          // Reset calculator state
          this.updateConversationContext(contactId, {
            calculator_state: null,
            calculator_type: null,
            calculator_data: null
          });
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid amount for existing obligations:');
        }
        break;
    }
  }

  formatAffordabilityResult(result) {
    return `💰 *Affordability Analysis*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *Income & Obligations*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly Income: ₹${this.formatCurrency(result.monthlyIncome)}
Existing Obligations: ₹${this.formatCurrency(result.existingEMIs)}
Available for EMI: ₹${this.formatCurrency(result.availableForEMI)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 *What You Can Afford*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Max Monthly EMI: ₹${this.formatCurrency(result.maxMonthlyEMI)}
Max Loan Amount: ₹${this.formatCurrency(result.maxLoanAmount)}
Max Property Value: ₹${this.formatCurrency(result.maxPropertyValue)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Assumptions*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• EMI Income Ratio: ${result.assumptions.emiIncomePercent}%
• Interest Rate: ${result.assumptions.interestRate}% p.a.
• Loan Tenure: ${result.assumptions.tenureYears} years
• Down Payment: ${result.assumptions.downPaymentPercent}%

💡 *Recommended down payment: ₹${this.formatCurrency(result.recommendedDownPayment)}*`;
  }

  // Rental Yield Calculator
  async startRentalYieldCalculator(contactId) {
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_property_value',
      calculator_type: 'rental_yield'
    });

    await this.sendTextMessage(contactId,
      '📊 *Rental Yield Calculator*\n\nCalculate potential returns from rental property!\n\nWhat\'s the property value? (e.g., "5000000" for ₹50 lakhs):'
    );
  }

  async processRentalYieldInput(contactId, message, context) {
    const state = context.calculator_state;
    const data = context.calculator_data || {};

    switch (state) {
      case 'awaiting_property_value':
        const value = this.extractNumber(message);
        if (value && value > 0) {
          data.propertyValue = value;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_rent'
          });
          await this.sendTextMessage(contactId, `✅ Property Value: ₹${this.formatCurrency(value)}\n\nWhat\'s the expected monthly rent? (e.g., "25000"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid property value:');
        }
        break;

      case 'awaiting_rent':
        const rent = this.extractNumber(message);
        if (rent && rent > 0) {
          const result = CalculatorService.calculateRentalYield(data.propertyValue, rent);

          const resultMessage = this.formatRentalYieldResult(result);
          await this.sendTextMessage(contactId, resultMessage);

          // Reset calculator state
          this.updateConversationContext(contactId, {
            calculator_state: null,
            calculator_type: null,
            calculator_data: null
          });
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid monthly rent amount:');
        }
        break;
    }
  }

  formatRentalYieldResult(result) {
    return `📊 *Rental Yield Analysis*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 *Property Details*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Property Value: ₹${this.formatCurrency(result.propertyValue)}
Monthly Rent: ₹${this.formatCurrency(result.monthlyRent)}
Annual Rent: ₹${this.formatCurrency(result.annualRent)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Yield Calculations*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gross Rental Yield: ${result.grossRentalYield}%
Net Rental Yield: ${result.netRentalYield}%
Monthly Cash Flow: ₹${this.formatCurrency(result.monthlyCashFlow)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Investment Metrics*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Break-even Period: ${result.breakEvenYears} years

💡 *Higher than 6% is considered good rental yield in India.*`;
  }

  // Stamp Duty Calculator
  async startStampDutyCalculator(contactId) {
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_property_value_sd',
      calculator_type: 'stamp_duty'
    });

    await this.sendTextMessage(contactId,
      '📄 *Stamp Duty Calculator*\n\nCalculate registration costs!\n\nWhat\'s the property agreement value? (e.g., "5000000" for ₹50 lakhs):'
    );
  }

  async processStampDutyInput(contactId, message, context) {
    const state = context.calculator_state;
    const data = context.calculator_data || {};

    if (state === 'awaiting_property_value_sd') {
      const value = this.extractNumber(message);
      if (value && value > 0) {
        const result = CalculatorService.calculateStampDuty(value, 'Maharashtra', false);

        const resultMessage = this.formatStampDutyResult(result);
        await this.sendTextMessage(contactId, resultMessage);

        // Reset calculator state
        this.updateConversationContext(contactId, {
          calculator_state: null,
          calculator_type: null,
          calculator_data: null
        });
      } else {
        await this.sendTextMessage(contactId, '❌ Please provide a valid property value:');
      }
    }
  }

  formatStampDutyResult(result) {
    return `📄 *Stamp Duty & Registration*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Cost Breakdown*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Property Value: ₹${this.formatCurrency(result.propertyValue)}
Stamp Duty (${result.stampDutyRate}%): ₹${this.formatCurrency(result.stampDuty)}
Registration Charges: ₹${this.formatCurrency(result.registrationCharges)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *Total Registration Cost*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
₹${this.formatCurrency(result.totalRegistrationCharges)}

Effective Rate: ${result.effectiveRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *Location & Details*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
State: ${result.state}
First-time Buyer: ${result.isFirstTimeBuyer ? 'Yes' : 'No'}

💡 *Rates may vary by location and buyer type.*`;
  }

  // ROI Calculator
  async startROICalculator(contactId) {
    this.updateConversationContext(contactId, {
      calculator_state: 'awaiting_investment',
      calculator_type: 'roi'
    });

    await this.sendTextMessage(contactId,
      '📈 *ROI Calculator*\n\nCalculate return on investment!\n\nWhat\'s your initial investment? (e.g., "5000000" for ₹50 lakhs):'
    );
  }

  async processROIInput(contactId, message, context) {
    const state = context.calculator_state;
    const data = context.calculator_data || {};

    switch (state) {
      case 'awaiting_investment':
        const investment = this.extractNumber(message);
        if (investment && investment > 0) {
          data.initialInvestment = investment;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_rental_income'
          });
          await this.sendTextMessage(contactId, `✅ Initial Investment: ₹${this.formatCurrency(investment)}\n\nExpected annual rental income? (e.g., "300000"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid investment amount:');
        }
        break;

      case 'awaiting_rental_income':
        const rentalIncome = this.extractNumber(message);
        if (rentalIncome && rentalIncome > 0) {
          data.annualRentalIncome = rentalIncome;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_expenses'
          });
          await this.sendTextMessage(contactId, `✅ Annual Rental Income: ₹${this.formatCurrency(rentalIncome)}\n\nAnnual expenses (maintenance, taxes, etc.)? (e.g., "50000"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid rental income:');
        }
        break;

      case 'awaiting_expenses':
        const expenses = this.extractNumber(message) || 0;
        if (expenses >= 0) {
          data.annualExpenses = expenses;
          this.updateConversationContext(contactId, {
            calculator_data: data,
            calculator_state: 'awaiting_tenure_roi'
          });
          await this.sendTextMessage(contactId, `✅ Annual Expenses: ₹${this.formatCurrency(expenses)}\n\nHolding period in years? (e.g., "5"):`);
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid expense amount:');
        }
        break;

      case 'awaiting_tenure_roi':
        const tenure = this.extractNumber(message);
        if (tenure && tenure > 0) {
          const result = CalculatorService.calculateROI(
            data.initialInvestment,
            data.annualRentalIncome,
            data.annualExpenses,
            tenure,
            5 // 5% appreciation
          );

          const resultMessage = this.formatROIResult(result);
          await this.sendTextMessage(contactId, resultMessage);

          // Reset calculator state
          this.updateConversationContext(contactId, {
            calculator_state: null,
            calculator_type: null,
            calculator_data: null
          });
        } else {
          await this.sendTextMessage(contactId, '❌ Please provide a valid holding period:');
        }
        break;
    }
  }

  formatROIResult(result) {
    return `📈 *ROI Analysis*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Investment Summary*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initial Investment: ₹${this.formatCurrency(result.initialInvestment)}
Holding Period: ${result.holdingPeriod} years
Annual Rental Income: ₹${this.formatCurrency(result.annualRentalIncome)}
Annual Expenses: ₹${this.formatCurrency(result.annualExpenses)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Returns*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Annual Income: ₹${this.formatCurrency(result.netIncome)}
Total Returns: ₹${this.formatCurrency(result.totalReturns)}
Total ROI: ${result.totalROI}%
Annualized ROI: ${result.annualizedROI}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *Cash Flow*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly Cash Flow: ₹${this.formatCurrency(result.monthlyCashFlow)}

💡 *Assumes 5% annual property appreciation.*`;
  }

  // Utility methods
  extractNumber(text) {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN').format(amount);
  }

  // Send document list
  async sendDocumentList(contactId) {
    await this.sendListMessage(contactId,
      '📄 Required Documents',
      'Here are the documents typically required for property purchase:',
      'View Documents',
      [
        {
          title: 'Identity Proof',
          rows: [
            { id: 'aadhar', title: 'Aadhar Card', description: 'Valid Aadhar card' },
            { id: 'pan', title: 'PAN Card', description: 'Permanent Account Number' },
            { id: 'passport', title: 'Passport', description: 'Valid passport (if applicable)' }
          ]
        },
        {
          title: 'Address Proof',
          rows: [
            { id: 'utility', title: 'Utility Bill', description: 'Electricity/Gas bill (3 months old)' },
            { id: 'bank', title: 'Bank Statement', description: 'Latest bank statement' }
          ]
        }
      ]
    );
  }

  // Escalate to human
  async escalateToHuman(contactId, priority = 'normal') {
    const handoffMessage = this.chatbotConfig.conversation_flow.human_handoff.handoff_message
      .replace('{{agent_name}}', 'our support team');

    await this.sendTextMessage(contactId, handoffMessage);

    // TODO: Implement actual agent assignment logic
    console.log(`Escalating conversation ${contactId} to human agent with priority: ${priority}`);
  }

  // Handle fallback responses
  async handleFallback(contactId, message) {
    const context = this.getConversationContext(contactId);
    const failedAttempts = context.failed_attempts + 1;

    this.updateConversationContext(contactId, { failed_attempts: failedAttempts });

    if (failedAttempts >= this.chatbotConfig.conversation_flow.fallback_handling.max_failed_attempts) {
      await this.escalateToHuman(contactId);
    } else {
      const fallbackResponses = this.chatbotConfig.conversation_flow.fallback_handling.responses;
      const response = fallbackResponses[failedAttempts - 1] || fallbackResponses[0];

      await this.sendTextMessage(contactId, response);

      // Send quick replies as fallback
      if (this.chatbotConfig.quick_replies.enabled) {
        await this.sendQuickReplyButtons(contactId, {
          text: 'Please select an option:',
          buttons: this.chatbotConfig.quick_replies.suggestions.slice(0, 3).map((reply, index) => ({
            title: reply,
            id: `fallback_reply_${index + 1}`
          }))
        });
      }
    }
  }

  // Send quick reply buttons
  async sendQuickReplyButtons(contactId, data) {
    await this.sendInteractiveMessage(contactId,
      '',
      data.text,
      data.buttons.map(btn => ({ title: btn.title }))
    );
  }

  // Utility methods for extracting information
  extractBudget(message) {
    const budgetPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:lakh|lac|l|crore|cr|c)/gi,
      /₹?\s*(\d+(?:,\d+)*)/g
    ];

    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0].replace(/[^\d.]/g, '');
      }
    }
    return null;
  }

  extractLocation(message) {
    const locations = ['mumbai', 'delhi', 'bangalore', 'chennai', 'pune', 'hyderabad', 'kolkata', 'ahmedabad'];
    const text = message.toLowerCase();

    for (const location of locations) {
      if (text.includes(location)) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }
    return null;
  }
}

module.exports = new WhatsAppService();