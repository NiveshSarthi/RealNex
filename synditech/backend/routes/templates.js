const express = require('express');
const Template = require('../models/Template');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/templates
// @desc    Get all templates for agent
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query;

    let templates;
    if (search) {
      templates = await Template.search(search, req.agent.id, parseInt(limit));
    } else {
      templates = await Template.findByAgent(
        req.agent.id,
        category,
        parseInt(limit),
        parseInt(offset)
      );
    }

    res.json({
      success: true,
      data: templates,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/templates/:id
// @desc    Get template by ID
// @access  Private
router.get('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check ownership (allow access to system templates)
    if (!template.isSystem && template.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/templates
// @desc    Create a new template
// @access  Private
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const {
      name,
      category,
      content,
      variables,
      language
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: 'Template name and content are required'
      });
    }

    const template = await Template.create({
      agentId: req.agent.id,
      name,
      category: category || 'general',
      content,
      variables: variables || {},
      language: language || 'en',
      isSystem: false,
      isApproved: true
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/templates/:id
// @desc    Update template
// @access  Private
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check ownership and prevent editing system templates
    if (template.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit system templates'
      });
    }

    if (template.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedTemplate = await template.update(req.body);

    res.json({
      success: true,
      data: updatedTemplate
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/templates/:id/use
// @desc    Increment template usage count
// @access  Private
router.post('/:id/use', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await template.incrementUsage();

    res.json({
      success: true,
      message: 'Template usage recorded'
    });
  } catch (error) {
    console.error('Record template usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/templates/:id/preview
// @desc    Preview template with variables
// @access  Private
router.post('/:id/preview', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check ownership (allow preview of system templates)
    if (!template.isSystem && template.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const preview = template.getPreview(variables || {});

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/templates/categories/list
// @desc    Get available template categories
// @access  Private
router.get('/categories/list', authenticateAgent, (req, res) => {
  const categories = [
    { id: 'greeting', name: 'Greeting', description: 'Welcome messages and introductions' },
    { id: 'follow_up', name: 'Follow-up', description: 'Nurture and follow-up messages' },
    { id: 'property_info', name: 'Property Information', description: 'Property details and specifications' },
    { id: 'closing', name: 'Closing', description: 'Deal closing and final negotiations' },
    { id: 'general', name: 'General', description: 'General purpose messages' }
  ];

  res.json({
    success: true,
    data: categories
  });
});

// @route   GET /api/templates/popular/list
// @desc    Get popular templates
// @access  Private
router.get('/popular/list', authenticateAgent, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const templates = await Template.getPopular(req.agent.id, parseInt(limit));

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get popular templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/templates/:id
// @desc    Delete template
// @access  Private
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check ownership and prevent deleting system templates
    if (template.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete system templates'
      });
    }

    if (template.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await template.delete();

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/templates/stats/overview
// @desc    Get template statistics
// @access  Private
router.get('/stats/overview', authenticateAgent, async (req, res) => {
  try {
    const stats = await Template.getStats(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get template stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/templates/validate-variables
// @desc    Validate template variables
// @access  Private
router.post('/validate-variables', authenticateAgent, async (req, res) => {
  try {
    const { templateId, variables } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    const template = await Template.findById(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check ownership (allow validation of system templates)
    if (!template.isSystem && template.agentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const validation = template.validateVariables(variables || {});

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Validate template variables error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;