const express = require('express');
const DripSequence = require('../models/DripSequence');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/drip-sequences
// @desc    Get all drip sequences for agent
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { activeOnly, limit = 50, offset = 0 } = req.query;

    const sequences = await DripSequence.findByAgent(
      req.agent.id,
      activeOnly === 'true',
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: sequences,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get drip sequences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drip-sequences/:id
// @desc    Get drip sequence by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error('Get drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences
// @desc    Create a new drip sequence
// @access  Private
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const {
      name,
      description,
      triggerEvent,
      isActive,
      steps
    } = req.body;

    if (!name || !triggerEvent || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        message: 'Name, trigger event, and steps array are required'
      });
    }

    // Validate steps
    const tempSequence = { steps };
    const validation = new DripSequence(tempSequence).validateSteps();

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    const sequence = await DripSequence.create({
      agentId: req.agent.id,
      name,
      description,
      triggerEvent,
      isActive: isActive || false,
      steps
    });

    res.status(201).json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error('Create drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/drip-sequences/:id
// @desc    Update drip sequence
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate steps if they're being updated
    if (req.body.steps) {
      const tempSequence = { steps: req.body.steps };
      const validation = new DripSequence(tempSequence).validateSteps();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }

    const updatedSequence = await sequence.update(req.body);

    res.json({
      success: true,
      data: updatedSequence
    });
  } catch (error) {
    console.error('Update drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences/:id/activate
// @desc    Activate drip sequence
// @access  Private
router.post('/:id/activate', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await sequence.setActive(true);

    res.json({
      success: true,
      message: 'Drip sequence activated successfully'
    });
  } catch (error) {
    console.error('Activate drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences/:id/deactivate
// @desc    Deactivate drip sequence
// @access  Private
router.post('/:id/deactivate', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await sequence.setActive(false);

    res.json({
      success: true,
      message: 'Drip sequence deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences/:id/steps
// @desc    Add a step to drip sequence
// @access  Private
router.post('/:id/steps', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const stepData = req.body;

    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedSequence = await sequence.addStep(stepData);

    res.json({
      success: true,
      data: updatedSequence
    });
  } catch (error) {
    console.error('Add step to drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/drip-sequences/:id/steps/:stepIndex
// @desc    Update a step in drip sequence
// @access  Private
router.put('/:id/steps/:stepIndex', authenticateAgent, async (req, res) => {
  try {
    const { id, stepIndex } = req.params;
    const stepData = req.body;

    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedSequence = await sequence.updateStep(parseInt(stepIndex), stepData);

    res.json({
      success: true,
      data: updatedSequence
    });
  } catch (error) {
    console.error('Update step in drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/drip-sequences/:id/steps/:stepIndex
// @desc    Remove a step from drip sequence
// @access  Private
router.delete('/:id/steps/:stepIndex', authenticateAgent, async (req, res) => {
  try {
    const { id, stepIndex } = req.params;

    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedSequence = await sequence.removeStep(parseInt(stepIndex));

    res.json({
      success: true,
      data: updatedSequence
    });
  } catch (error) {
    console.error('Remove step from drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences/:id/preview
// @desc    Preview drip sequence
// @access  Private
router.post('/:id/preview', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { leadData } = req.body;

    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const preview = sequence.getPreview(leadData || {});

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Preview drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drip-sequences/trigger
// @desc    Trigger drip sequences for an event
// @access  Private
router.post('/trigger', authenticateAgent, async (req, res) => {
  try {
    const { triggerEvent, leadId, leadData } = req.body;

    if (!triggerEvent || !leadId) {
      return res.status(400).json({
        success: false,
        message: 'Trigger event and lead ID are required'
      });
    }

    // Find active sequences for this trigger event
    const sequences = await DripSequence.findByTriggerEvent(triggerEvent, req.agent.id);

    const results = [];
    for (const sequence of sequences) {
      try {
        const result = await sequence.processForLead(leadId, leadData || {});
        results.push({
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          success: result.success,
          executions: result.executions,
          error: result.error
        });
      } catch (error) {
        results.push({
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        triggerEvent,
        leadId,
        sequencesTriggered: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Trigger drip sequences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drip-sequences/trigger-events/list
// @desc    Get available trigger events
// @access  Private
router.get('/trigger-events/list', authenticateAgent, (req, res) => {
  const triggerEvents = [
    { id: 'lead_created', name: 'New Lead Created', description: 'When a new lead is added to the system' },
    { id: 'message_received', name: 'Message Received', description: 'When a lead sends a WhatsApp message' },
    { id: 'property_inquiry', name: 'Property Inquiry', description: 'When a lead inquires about a property' },
    { id: 'site_visit_scheduled', name: 'Site Visit Scheduled', description: 'When a site visit is booked' },
    { id: 'site_visit_completed', name: 'Site Visit Completed', description: 'When a site visit is marked as completed' },
    { id: 'offer_made', name: 'Offer Made', description: 'When an offer is submitted' },
    { id: 'deal_closed', name: 'Deal Closed', description: 'When a deal is successfully closed' }
  ];

  res.json({
    success: true,
    data: triggerEvents
  });
});

// @route   DELETE /api/drip-sequences/:id
// @desc    Delete drip sequence
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = await DripSequence.findById(id);

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: 'Drip sequence not found'
      });
    }

    // Check ownership
    if (sequence.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await sequence.delete();

    res.json({
      success: true,
      message: 'Drip sequence deleted successfully'
    });
  } catch (error) {
    console.error('Delete drip sequence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drip-sequences/stats/overview
// @desc    Get drip sequence statistics
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await DripSequence.getStats(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get drip sequence stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;