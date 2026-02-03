const express = require('express');
const Campaign = require('../models/Campaign');
const { authenticateAgent, checkSubscriptionLimits } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/campaigns
// @desc    Get all campaigns for agent
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const campaigns = await Campaign.findByAgent(
      req.agent.id,
      status,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/campaigns/:id
// @desc    Get campaign by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/campaigns
// @desc    Create a new campaign
// @access  Private
router.post('/', authenticateAgent, checkSubscriptionLimits('create_campaign'), async (req, res) => {
  try {
    const {
      name,
      description,
      campaignType,
      targetAudience,
      messageTemplate,
      scheduledAt,
      isABTest,
      testPercentage,
      variants
    } = req.body;

    if (!name || !messageTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name and message template are required'
      });
    }

    // Validate A/B test configuration if enabled
    if (isABTest) {
      if (!variants || variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'A/B test must include at least one variant'
        });
      }

      if (testPercentage < 10 || testPercentage > 90) {
        return res.status(400).json({
          success: false,
          message: 'Test percentage must be between 10% and 90%'
        });
      }

      // Validate each variant
      for (let i = 0; i < variants.length; i++) {
        if (!variants[i].name || !variants[i].messageTemplate) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1} must have a name and message template`
          });
        }
      }
    }

    const campaign = await Campaign.create({
      agentId: req.agent.id,
      name,
      description,
      campaignType: campaignType || 'bulk',
      status: scheduledAt ? 'scheduled' : 'draft',
      targetAudience: targetAudience || {},
      messageTemplate,
      scheduledAt,
      isABTest: isABTest || false,
      testPercentage: testPercentage || 50,
      variants: variants || []
    });

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow updates to running or completed campaigns
    if (campaign.status === 'running' || campaign.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update running or completed campaigns'
      });
    }

    const updatedCampaign = await campaign.update(req.body);

    res.json({
      success: true,
      data: updatedCampaign
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/campaigns/:id/send
// @desc    Execute/send campaign
// @access  Private
router.post('/:id/send', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if campaign can be sent
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Campaign cannot be sent in current status'
      });
    }

    // Execute campaign
    const result = await campaign.execute();

    res.json({
      success: true,
      message: 'Campaign executed successfully',
      data: result
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   GET /api/campaigns/:id/audience
// @desc    Get campaign target audience
// @access  Private
router.get('/:id/audience', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const audience = await campaign.getTargetAudience(parseInt(limit));

    res.json({
      success: true,
      data: audience,
      count: audience.length
    });
  } catch (error) {
    console.error('Get campaign audience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/campaigns/:id/audience-size
// @desc    Get campaign audience size
// @access  Private
router.get('/:id/audience-size', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const audienceSize = await campaign.getAudienceSize();

    res.json({
      success: true,
      data: {
        audienceSize
      }
    });
  } catch (error) {
    console.error('Get audience size error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/campaigns/:id/performance
// @desc    Get campaign performance metrics
// @access  Private
router.get('/:id/performance', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const metrics = campaign.getPerformanceMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Get campaign performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/campaigns/:id
// @desc    Delete campaign
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft campaigns
    if (campaign.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft campaigns can be deleted'
      });
    }

    await campaign.delete();

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/campaigns/stats/overview
// @desc    Get campaign statistics for agent
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await Campaign.getStatsForAgent(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/campaigns/preview
// @desc    Preview campaign audience and message
// @access  Private
router.post('/preview', authenticateAgent, async (req, res) => {
  try {
    const { targetAudience, messageTemplate, limit = 10 } = req.body;

    if (!targetAudience || !messageTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Target audience and message template are required'
      });
    }

    // Create a temporary campaign-like object to test audience
    const tempCampaign = {
      targetAudience,
      getTargetAudience: async (limit) => {
        // Simulate the audience query
        const audience = targetAudience || {};
        let queryText = 'SELECT id, phone, name FROM leads WHERE 1=1';
        const values = [];

        if (audience.location) {
          queryText += ' AND location ILIKE $1';
          values.push(`%${audience.location}%`);
        }

        if (audience.budgetMin) {
          queryText += ` AND budget_min >= $${values.length + 1}`;
          values.push(audience.budgetMin);
        }

        if (audience.budgetMax) {
          queryText += ` AND budget_max <= $${values.length + 1}`;
          values.push(audience.budgetMax);
        }

        if (audience.propertyType) {
          queryText += ` AND property_type = $${values.length + 1}`;
          values.push(audience.propertyType);
        }

        if (audience.leadScore) {
          queryText += ` AND lead_score >= $${values.length + 1}`;
          values.push(audience.leadScore);
        }

        queryText += ` AND status NOT IN ('lost', 'closed') LIMIT $${values.length + 1}`;
        values.push(limit);

        const { query } = require('../config/database');
        const result = await query(queryText, values);
        return result.rows;
      }
    };

    const audience = await tempCampaign.getTargetAudience(limit);

    res.json({
      success: true,
      data: {
        audience,
        audienceSize: audience.length,
        messageTemplate,
        previewMessage: messageTemplate.substring(0, 100) + (messageTemplate.length > 100 ? '...' : '')
      }
    });
  } catch (error) {
    console.error('Campaign preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/campaigns/:id/ab-test-results
// @desc    Get A/B test results for campaign
// @access  Private
router.get('/:id/ab-test-results', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check ownership
    if (campaign.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if this is an A/B test campaign
    if (!campaign.isABTest) {
      return res.status(400).json({
        success: false,
        message: 'This campaign is not an A/B test'
      });
    }

    // Check if campaign is completed
    if (campaign.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'A/B test results are only available for completed campaigns'
      });
    }

    const results = await campaign.getABTestResults();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get A/B test results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;