const OpenAI = require('openai');
const { query } = require('../config/database');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.mockMode = !this.apiKey || this.apiKey === 'your_openai_api_key_here';

    if (!this.mockMode) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
    } else {
      console.warn('AIService: OPENAI_API_KEY is missing. Entering Mock Mode.');
      this.openai = {
        chat: {
          completions: {
            create: () => { throw new Error('AI Mock Mode: OpenAI key missing'); }
          }
        }
      };
    }

    // AI prompt templates
    this.prompts = {
      leadQualification: `You are an expert real estate lead qualification AI. Analyze this WhatsApp conversation and return structured data.

INPUT: WhatsApp message thread
CONTEXT: Indian real estate market, agent is helping buyers find properties

OUTPUT FORMAT:
{
  "lead_score": number (0-100),
  "intent": "buying|selling|renting|inquiring",
  "urgency": "hot|warm|cold" (hot = ready to buy within 3 months),
  "budget_range": "under_50L|50-1Cr|1-2Cr|above_2Cr",
  "preferred_locations": ["area1", "area2"],
  "property_types": ["2bhk", "3bhk", "villa"],
  "timeline": "immediate|3_months|6_months|just_researching",
  "pain_points": ["text description"],
  "next_action": "site_visit|send_catalog|price_negotiation|follow_up",
  "agent_notes": "Suggested response strategy"
}

RULES:
- Hot leads: Clear budget, timeline, specific requirements
- Warm leads: Some details but need more info
- Cold leads: Just browsing or vague requirements
- Consider Indian context: Budget in lakhs, locations in Delhi NCR/Gurgaon etc.
- Flag red flags: Unrealistic budgets, time-wasters`,

      dripCampaign: `You are a real estate follow-up AI specializing in Indian market psychology. Create personalized, urgency-creating messages that convert leads to buyers.

CONTEXT:
- Indian real estate: Budgets in lakhs, locations like Gurgaon/Delhi/Noida
- Buyer psychology: Fear of missing out, social proof, limited-time offers
- Agent goal: Move leads from interested to site visit booking

INPUT:
- Lead name, location preference, budget range
- Days since last contact
- Previous conversation topics
- Lead score (hot/warm/cold)

OUTPUT:
- 1-2 sentence personalized message
- Include specific property reference if possible
- End with clear call-to-action
- Create urgency without being pushy

EXAMPLES:
"Good morning Rajesh! I noticed you were interested in 3BHK flats in Sector 62. We just got 2 new units under ₹85L with immediate possession. Should I send the details? ⏰"

"Hi Priya! The 2BHK villa in Nirvana Country you inquired about last week - we have only 3 units left at the special price. Would you like to schedule a site visit this weekend? 🏠"

RULES:
- Keep under 150 characters
- Use emojis strategically (1-2 max)
- Personalize with name and specific details
- Create social proof ("only X left", "high demand")
- End with question to encourage response
- Hindi/English mix acceptable for Indian market`,

      skillAnalysis: `You are an expert real estate training AI. Analyze agent performance metrics and create personalized development plans.

INPUT DATA:
- Deals closed (number, average value)
- Lead response time (average minutes)
- Conversion rate (%)
- WhatsApp engagement (messages sent/received)
- Time in role (months)
- Quiz scores (by topic)
- Customer feedback ratings

OUTPUT FORMAT:
{
  "skill_gaps": ["closing_techniques", "market_knowledge", "communication"],
  "recommended_modules": [
    {
      "title": "Advanced Closing Techniques",
      "priority": "high",
      "estimated_time": "2 hours",
      "why": "Your conversion rate is 15% below average",
      "prerequisites": []
    }
  ],
  "learning_path": {
    "week_1": ["module_1", "module_2"],
    "week_2": ["module_3"],
    "week_3": ["assessment"]
  },
  "success_metrics": {
    "target_conversion_rate": 35,
    "target_response_time": 5,
    "certification_unlock": true
  },
  "motivational_message": "Complete these modules and you'll increase your commission by ₹25K/month!"
}

ANALYSIS FRAMEWORK:
1. Compare against top 25% performers in same experience bracket
2. Identify 3-5 most impactful skill gaps
3. Prioritize quick-wins (high impact, low effort)
4. Create realistic timelines (2-4 hours/week)
5. Include gamification elements (badges, leaderboards)
6. Link to business outcomes (more deals = more money)`,

      priceOptimization: `You are a real estate pricing AI specializing in Indian market dynamics. Optimize property prices based on market data, competition, and demand signals.

INPUT DATA:
- Current property prices and details
- Recent sales data in same area
- Active listings from competitors (99acres, MagicBricks)
- Market trends (price appreciation, demand/supply ratio)
- Days on market for similar properties
- Economic indicators (interest rates, developer activity)

ANALYSIS FRAMEWORK:
1. Competitive Positioning: Where does this property rank vs similar ones?
2. Market Momentum: Is the area appreciating or declining?
3. Days on Market: Properties over 60 days may need price reduction
4. Psychological Pricing: End numbers matter (₹85L vs ₹84.5L)
5. Seasonal Adjustments: Festival seasons, monsoon impact
6. Buyer Behavior: Weekend inquiries indicate serious buyers

OUTPUT FORMAT:
{
  "price_recommendations": [
    {
      "property_id": "PROP001",
      "current_price": 8500000,
      "recommended_price": 8750000,
      "adjustment_percentage": 2.9,
      "reasoning": "Area appreciating 8% YoY, similar properties sold 5% above list",
      "confidence_score": 85,
      "expected_dom_reduction": 12
    }
  ],
  "market_insights": {
    "area_trend": "bullish",
    "avg_dom": 45,
    "price_appreciation": 8.5,
    "buyer_activity": "high"
  },
  "risk_warnings": ["Monsoon season may slow viewings"],
  "action_items": ["Highlight recent area developments", "Offer flexible payment terms"]
}

RULES:
- Maximum price change: ±10% per month
- Consider transaction costs (stamp duty, registration)
- Factor in agent commission structure
- Account for property condition and amenities
- Validate against recent comparable sales`,

      propertyMatching: `You are a real estate matching AI. Find the best property matches for buyer requirements in the Indian market.

BUYER REQUIREMENTS:
- Budget: {{budget}} lakhs
- Location preferences: {{locations}}
- Property type: {{property_type}}
- BHK requirement: {{bhk}}
- Timeline: {{timeline}}
- Special requirements: {{requirements}}

AVAILABLE PROPERTIES DATABASE:
{{properties}}

MATCHING CRITERIA:
1. Budget: Within 10% of stated budget (flexible for hot leads)
2. Location: Exact match preferred, adjacent areas acceptable
3. Property Type: Exact match required
4. BHK: Exact match or one level variance acceptable
5. Timeline: Match ready-to-move for immediate buyers

OUTPUT FORMAT:
{
  "top_matches": [
    {
      "property_id": "PROP001",
      "match_score": 95,
      "match_reasons": ["Exact budget match", "Prime location", "Ready to move"],
      "price": 8500000,
      "location": "Sector 62, Gurgaon",
      "bhk": 3,
      "property_type": "apartment",
      "special_features": ["Swimming pool", "Gym", "Power backup"],
      "why_recommended": "Perfect match for your requirements with excellent amenities"
    }
  ],
  "alternative_matches": [...],
  "market_insights": {
    "avg_price_similar": 8200000,
    "price_trend": "increasing",
    "demand_level": "high",
    "competition_level": "medium"
  },
  "negotiation_strategy": "Property is priced competitively, room for 3-5% negotiation",
  "next_steps": ["Schedule site visit", "Check legal documents", "Compare with similar properties"]
}

RULES:
- Return maximum 5 top matches
- Score matches 0-100 based on requirement fit
- Consider Indian real estate context (RERA, possession, amenities)
- Factor in market demand and pricing psychology
- Provide actionable next steps for agent`,

      sentimentAnalysis: `You are a real estate conversation sentiment analyzer. Analyze buyer messages for emotional state, intent clarity, and engagement level.

INPUT: WhatsApp conversation thread
CONTEXT: Indian real estate buyer communication patterns

ANALYZE FOR:
1. Emotional State: excited|interested|hesitant|frustrated|neutral
2. Intent Clarity: very_clear|somewhat_clear|vague|confusing
3. Urgency Level: immediate|soon|flexible|just_browsing
4. Budget Seriousness: exact_figure|range_given|vague|no_budget
5. Decision Timeline: ready_to_book|need_more_info|comparison_shopping|future_planning
6. Pain Points: price|location|financing|documentation|trust
7. Buying Stage: awareness|consideration|decision|negotiation|purchase

OUTPUT FORMAT:
{
  "overall_sentiment": "positive|neutral|negative",
  "engagement_score": 85,
  "sentiment_breakdown": {
    "emotional_state": "excited",
    "intent_clarity": "very_clear",
    "urgency_level": "immediate",
    "budget_seriousness": "exact_figure"
  },
  "key_insights": [
    "Buyer is ready to make a decision this month",
    "Has done homework on similar properties",
    "Open to negotiation on price",
    "Needs financing assistance"
  ],
  "recommended_actions": [
    "Send detailed property brochure immediately",
    "Offer to connect with finance partner",
    "Schedule site visit for this weekend",
    "Prepare price negotiation strategy"
  ],
  "risk_factors": ["May be comparing with 2-3 other properties"],
  "conversion_probability": 75
}

INDIAN CONTEXT CONSIDERATIONS:
- Respectful communication style
- Family decision-making involvement
- Festival season impacts
- Cash vs loan preferences
- Documentation concerns
- Location preferences (schools, hospitals, commute)`
    };
  }

  // Lead Qualification AI
  async qualifyLead(message, context = {}) {
    try {
      const prompt = this.prompts.leadQualification;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Message: "${message}"\nContext: ${JSON.stringify(context)}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: 1000
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Lead qualification AI error:', error);
      return {
        lead_score: 50,
        intent: 'inquiring',
        urgency: 'warm',
        error: 'AI analysis failed'
      };
    }
  }

  // Drip Campaign Content Generation
  async generateDripContent(leadData) {
    try {
      const prompt = this.prompts.dripCampaign;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Lead Data: ${JSON.stringify(leadData)}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Drip campaign AI error:', error);
      return `Hi ${leadData.name || 'there'}! Following up on your interest in properties. Would you like to see some updated options?`;
    }
  }

  // Skill Gap Analysis for LMS
  async analyzeAgentSkills(agentData) {
    try {
      const prompt = this.prompts.skillAnalysis;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Agent Performance Data: ${JSON.stringify(agentData)}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.4,
        max_tokens: 1500
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Skill analysis AI error:', error);
      return {
        skill_gaps: ['communication', 'market_knowledge'],
        recommended_modules: [],
        error: 'AI analysis failed'
      };
    }
  }

  // Price Optimization AI
  async optimizePropertyPrices(propertyData, marketData) {
    try {
      const prompt = this.prompts.priceOptimization;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Property Data: ${JSON.stringify(propertyData)}\nMarket Data: ${JSON.stringify(marketData)}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.2,
        max_tokens: 1500
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Price optimization AI error:', error);
      return {
        price_recommendations: [],
        market_insights: {},
        error: 'AI analysis failed'
      };
    }
  }

  // Property Matching AI
  async matchProperties(requirements, availableProperties) {
    try {
      const prompt = this.prompts.propertyMatching;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Requirements: ${JSON.stringify(requirements)}\nProperties: ${JSON.stringify(availableProperties.slice(0, 20))}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: 2000
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Property matching AI error:', error);
      return {
        top_matches: [],
        alternative_matches: [],
        error: 'AI matching failed'
      };
    }
  }

  // Sentiment Analysis
  async analyzeSentiment(conversation) {
    try {
      const prompt = this.prompts.sentimentAnalysis;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Conversation: ${JSON.stringify(conversation)}`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: 1000
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Sentiment analysis AI error:', error);
      return {
        overall_sentiment: 'neutral',
        engagement_score: 50,
        error: 'AI analysis failed'
      };
    }
  }

  // Predictive Deal Closure
  async predictDealClosure(leadData, agentData, propertyData) {
    try {
      const prompt = `You are a real estate deal prediction AI. Analyze the likelihood of deal closure based on lead, agent, and property data.

INPUT DATA:
- Lead: ${JSON.stringify(leadData)}
- Agent: ${JSON.stringify(agentData)}
- Property: ${JSON.stringify(propertyData)}

OUTPUT: JSON with closure_probability (0-100), risk_factors, recommended_actions, estimated_timeline.`;

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: 'Predict deal closure probability and provide insights.'
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.2,
        max_tokens: 800
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      console.error('Deal prediction AI error:', error);
      return {
        closure_probability: 50,
        risk_factors: ['Unable to analyze'],
        recommended_actions: ['Continue standard follow-up']
      };
    }
  }

  // Content Personalization
  async personalizeContent(baseContent, userData, contextData) {
    try {
      const prompt = `Personalize this real estate content for the specific user and context. Make it more engaging and relevant.

BASE CONTENT: "${baseContent}"
USER DATA: ${JSON.stringify(userData)}
CONTEXT: ${JSON.stringify(contextData)}

Return personalized version that maintains professional tone but feels more personal and relevant.`;

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: 'Create personalized version.'
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.6,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Content personalization AI error:', error);
      return baseContent; // Fallback to original content
    }
  }

  // Store AI analysis results in database
  async storeAnalysis(analysisType, inputData, resultData, entityId, entityType) {
    try {
      await query(
        `INSERT INTO ai_analyses (analysis_type, input_data, result_data, entity_id, entity_type, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [analysisType, JSON.stringify(inputData), JSON.stringify(resultData), entityId, entityType]
      );
    } catch (error) {
      console.error('Store AI analysis error:', error);
    }
  }

  // Get AI analysis history
  async getAnalysisHistory(entityId, entityType, analysisType = null, limit = 10) {
    try {
      let queryText = 'SELECT * FROM ai_analyses WHERE entity_id = $1 AND entity_type = $2';
      const values = [entityId, entityType];

      if (analysisType) {
        queryText += ' AND analysis_type = $3';
        values.push(analysisType);
      }

      queryText += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1);
      values.push(limit);

      const result = await query(queryText, values);
      return result.rows;
    } catch (error) {
      console.error('Get AI analysis history error:', error);
      return [];
    }
  }
}

module.exports = new AIService();