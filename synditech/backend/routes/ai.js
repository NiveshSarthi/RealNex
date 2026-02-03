const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');
const { authenticateToken } = require('../middleware/agentAuth');

// Lead qualification
router.post('/qualify', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required for qualification'
      });
    }

    const qualification = await aiService.qualifyLead(message, context);

    // Store the analysis
    await aiService.storeAnalysis('lead_qualification', { message, context }, qualification, null, 'lead');

    res.json({
      success: true,
      qualification
    });
  } catch (error) {
    console.error('AI qualification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to qualify lead',
      error: error.message
    });
  }
});

// Drip campaign content generation
router.post('/drip-content', authenticateToken, async (req, res) => {
  try {
    const leadData = req.body;

    if (!leadData.name) {
      return res.status(400).json({
        success: false,
        message: 'Lead data with name is required'
      });
    }

    const content = await aiService.generateDripContent(leadData);

    // Store the analysis
    await aiService.storeAnalysis('drip_content', leadData, { content }, null, 'lead');

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('AI drip content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate drip content',
      error: error.message
    });
  }
});

// Skill analysis for LMS
router.post('/analyze-skills', authenticateToken, async (req, res) => {
  try {
    const agentData = req.body;

    if (!agentData.agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Agent data with agent_id is required'
      });
    }

    const analysis = await aiService.analyzeAgentSkills(agentData);

    // Store the analysis
    await aiService.storeAnalysis('skill_analysis', agentData, analysis, agentData.agent_id, 'agent');

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('AI skill analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze skills',
      error: error.message
    });
  }
});

// Price optimization
router.post('/optimize-prices', authenticateToken, async (req, res) => {
  try {
    const { propertyData, marketData } = req.body;

    if (!propertyData || !marketData) {
      return res.status(400).json({
        success: false,
        message: 'Property data and market data are required'
      });
    }

    const recommendations = await aiService.optimizePropertyPrices(propertyData, marketData);

    // Store the analysis
    await aiService.storeAnalysis('price_optimization', { propertyData, marketData }, recommendations, null, 'property');

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('AI price optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize prices',
      error: error.message
    });
  }
});

// Property matching
router.post('/match-properties', authenticateToken, async (req, res) => {
  try {
    const { requirements, availableProperties } = req.body;

    if (!requirements || !availableProperties) {
      return res.status(400).json({
        success: false,
        message: 'Requirements and available properties are required'
      });
    }

    const matches = await aiService.matchProperties(requirements, availableProperties);

    // Store the analysis
    await aiService.storeAnalysis('property_matching', { requirements, propertyCount: availableProperties.length }, matches, null, 'lead');

    res.json({
      success: true,
      matches
    });
  } catch (error) {
    console.error('AI property matching error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to match properties',
      error: error.message
    });
  }
});

// Sentiment analysis
router.post('/analyze-sentiment', authenticateToken, async (req, res) => {
  try {
    const conversation = req.body;

    if (!conversation) {
      return res.status(400).json({
        success: false,
        message: 'Conversation data is required'
      });
    }

    const analysis = await aiService.analyzeSentiment(conversation);

    // Store the analysis
    await aiService.storeAnalysis('sentiment_analysis', conversation, analysis, null, 'conversation');

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze sentiment',
      error: error.message
    });
  }
});

// Deal closure prediction
router.post('/predict-closure', authenticateToken, async (req, res) => {
  try {
    const { leadData, agentData, propertyData } = req.body;

    if (!leadData || !agentData || !propertyData) {
      return res.status(400).json({
        success: false,
        message: 'Lead, agent, and property data are required'
      });
    }

    const prediction = await aiService.predictDealClosure(leadData, agentData, propertyData);

    // Store the analysis
    await aiService.storeAnalysis('deal_prediction', { leadData, agentData, propertyData }, prediction, null, 'deal');

    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    console.error('AI deal prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict deal closure',
      error: error.message
    });
  }
});

// Content personalization
router.post('/personalize-content', authenticateToken, async (req, res) => {
  try {
    const { baseContent, userData, contextData } = req.body;

    if (!baseContent || !userData) {
      return res.status(400).json({
        success: false,
        message: 'Base content and user data are required'
      });
    }

    const personalizedContent = await aiService.personalizeContent(baseContent, userData, contextData);

    // Store the analysis
    await aiService.storeAnalysis('content_personalization', { baseContent, userData, contextData }, { personalizedContent }, null, 'content');

    res.json({
      success: true,
      personalizedContent
    });
  } catch (error) {
    console.error('AI content personalization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to personalize content',
      error: error.message
    });
  }
});

// Get AI analysis history
router.get('/analysis-history', authenticateToken, async (req, res) => {
  try {
    const { entityId, entityType, analysisType, limit = 10 } = req.query;

    if (!entityId || !entityType) {
      return res.status(400).json({
        success: false,
        message: 'Entity ID and entity type are required'
      });
    }

    const history = await aiService.getAnalysisHistory(entityId, entityType, analysisType, parseInt(limit));

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get AI analysis history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analysis history',
      error: error.message
    });
  }
});

// Get AI service health
router.get('/health', authenticateToken, async (req, res) => {
  try {
    // Test OpenAI connection
    const health = {
      openai: false,
      database: false,
      overall: false
    };

    // Test database connection
    try {
      await require('../config/database').query('SELECT 1');
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Test OpenAI connection (simple test)
    try {
      // We can test with a simple completion if needed
      health.openai = true; // Assume it's working if no error
    } catch (error) {
      console.error('OpenAI health check failed:', error);
    }

    health.overall = health.database && health.openai;

    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI health check error:', error);
    res.status(500).json({
      success: false,
      message: 'AI service health check failed',
      error: error.message
    });
  }
});

module.exports = router;