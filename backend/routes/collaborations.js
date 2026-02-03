const express = require('express');
const Collaboration = require('../models/Collaboration');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/collaborations
// @desc    Get all collaborations for agent
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const collaborations = await Collaboration.findByAgent(
      req.agent.id,
      status,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: collaborations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get collaborations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/collaborations/:id
// @desc    Get collaboration by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Check if agent is part of this collaboration
    if (collaboration.primaryAgent !== req.agent.id && collaboration.collaboratingAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: collaboration
    });
  } catch (error) {
    console.error('Get collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/collaborations
// @desc    Create a new collaboration
// @access  Private
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const {
      leadId,
      collaboratingAgentId,
      collaborationType,
      commissionSplit,
      notes
    } = req.body;

    if (!leadId || !collaboratingAgentId) {
      return res.status(400).json({
        success: false,
        message: 'Lead ID and collaborating agent ID are required'
      });
    }

    // Validate collaboration type
    const validTypes = ['referral', 'co_broking', 'joint_venture'];
    if (collaborationType && !validTypes.includes(collaborationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid collaboration type'
      });
    }

    // Validate commission split
    if (commissionSplit < 0 || commissionSplit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission split must be between 0 and 100'
      });
    }

    // Check if agent owns the lead
    const { query } = require('../config/database');
    const leadCheck = await query(
      'SELECT assigned_agent FROM leads WHERE id = $1',
      [leadId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (leadCheck.rows[0].assigned_agent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only create collaborations for leads you own'
      });
    }

    // Check if collaboration already exists
    const existingCheck = await query(
      'SELECT id FROM collaborations WHERE lead_id = $1 AND collaborating_agent = $2 AND status != $3',
      [leadId, collaboratingAgentId, 'cancelled']
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Collaboration already exists for this lead and agent'
      });
    }

    const collaboration = await Collaboration.create({
      leadId,
      primaryAgent: req.agent.id,
      collaboratingAgent: collaboratingAgentId,
      collaborationType: collaborationType || 'referral',
      commissionSplit: commissionSplit || 0,
      notes
    });

    res.status(201).json({
      success: true,
      data: collaboration
    });
  } catch (error) {
    console.error('Create collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/collaborations/:id
// @desc    Update collaboration
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Check if agent is part of this collaboration
    if (collaboration.primaryAgent !== req.agent.id && collaboration.collaboratingAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only primary agent can update certain fields
    const allowedFields = ['notes'];
    if (collaboration.primaryAgent === req.agent.id) {
      allowedFields.push('commissionSplit', 'collaborationType');
    }

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedCollaboration = await collaboration.update(updateData);

    res.json({
      success: true,
      data: updatedCollaboration
    });
  } catch (error) {
    console.error('Update collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/collaborations/:id/accept
// @desc    Accept collaboration invitation
// @access  Private
router.post('/:id/accept', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Only collaborating agent can accept
    if (collaboration.collaboratingAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the collaborating agent can accept this invitation'
      });
    }

    if (collaboration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Collaboration is not in pending status'
      });
    }

    await collaboration.accept();

    res.json({
      success: true,
      message: 'Collaboration accepted successfully'
    });
  } catch (error) {
    console.error('Accept collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/collaborations/:id/decline
// @desc    Decline collaboration invitation
// @access  Private
router.post('/:id/decline', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Only collaborating agent can decline
    if (collaboration.collaboratingAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the collaborating agent can decline this invitation'
      });
    }

    if (collaboration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Collaboration is not in pending status'
      });
    }

    await collaboration.decline();

    res.json({
      success: true,
      message: 'Collaboration declined successfully'
    });
  } catch (error) {
    console.error('Decline collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/collaborations/:id/complete
// @desc    Mark collaboration as completed
// @access  Private
router.post('/:id/complete', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { dealValue, dealStatus } = req.body;

    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Only primary agent can complete collaboration
    if (collaboration.primaryAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the primary agent can complete this collaboration'
      });
    }

    if (collaboration.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Collaboration must be active to complete'
      });
    }

    if (!dealValue || dealValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid deal value is required'
      });
    }

    await collaboration.complete(dealValue, dealStatus || 'won');

    const commission = collaboration.calculateCommission();

    res.json({
      success: true,
      message: 'Collaboration completed successfully',
      data: {
        commission
      }
    });
  } catch (error) {
    console.error('Complete collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/collaborations/:id/commission
// @desc    Get commission details for collaboration
// @access  Private
router.get('/:id/commission', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Check if agent is part of this collaboration
    if (collaboration.primaryAgent !== req.agent.id && collaboration.collaboratingAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const commission = collaboration.calculateCommission();

    res.json({
      success: true,
      data: {
        collaborationId: collaboration.id,
        dealValue: collaboration.dealValue,
        commissionSplit: collaboration.commissionSplit,
        ...commission
      }
    });
  } catch (error) {
    console.error('Get commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/collaborations/stats/overview
// @desc    Get collaboration statistics for agent
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await Collaboration.getStatsForAgent(req.agent.id);
    const networkStats = await Collaboration.getNetworkStats(req.agent.id);

    res.json({
      success: true,
      data: {
        ...stats,
        ...networkStats
      }
    });
  } catch (error) {
    console.error('Get collaboration stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/collaborations/leads/:leadId
// @desc    Get collaborations for a specific lead
// @access  Private
router.get('/leads/:leadId', authenticateAgent, async (req, res) => {
  try {
    const { leadId } = req.params;

    // Check if agent has access to this lead
    const { query } = require('../config/database');
    const leadCheck = await query(
      'SELECT assigned_agent FROM leads WHERE id = $1',
      [leadId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (leadCheck.rows[0].assigned_agent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaborations = await Collaboration.findByLead(leadId);

    res.json({
      success: true,
      data: collaborations
    });
  } catch (error) {
    console.error('Get lead collaborations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/collaborations/:id
// @desc    Delete collaboration
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    // Only primary agent can delete, and only if not completed
    if (collaboration.primaryAgent !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the primary agent can delete this collaboration'
      });
    }

    if (collaboration.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed collaborations'
      });
    }

    await collaboration.delete();

    res.json({
      success: true,
      message: 'Collaboration deleted successfully'
    });
  } catch (error) {
    console.error('Delete collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;