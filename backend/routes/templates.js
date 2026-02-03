const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// @route   GET /api/templates
// @desc    Get all templates for organization
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, category, isGlobal = false } = req.query;

    let queryText = `
      SELECT * FROM templates
      WHERE (organization_id = $1 OR is_global = true)
    `;
    const values = [req.user.organization_id];

    if (type) {
      queryText += ' AND type = $2';
      values.push(type);
    }

    if (category) {
      queryText += ` AND category = $${values.length + 1}`;
      values.push(category);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, values);

    res.json({
      success: true,
      data: result.rows
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
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM templates WHERE id = $1 AND (organization_id = $2 OR is_global = true)',
      [id, req.user.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
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
// @desc    Create new template
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      type,
      category,
      content,
      variables = {},
      language = 'en',
      isGlobal = false
    } = req.body;

    if (!name || !type || !content) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and content are required'
      });
    }

    const queryText = `
      INSERT INTO templates (
        organization_id, name, type, category, content, variables,
        language, is_global, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      req.user.organization_id,
      name,
      type,
      category,
      JSON.stringify(content),
      JSON.stringify(variables),
      language,
      isGlobal,
      req.user.id
    ];

    const result = await query(queryText, values);

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: result.rows[0]
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
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check ownership
    const existing = await query(
      'SELECT * FROM templates WHERE id = $1 AND organization_id = $2',
      [id, req.user.organization_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or access denied'
      });
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id') {
        if (typeof updates[key] === 'object') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }

    fields.push('updated_at = NOW()');

    const queryText = `UPDATE templates SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const result = await query(queryText, values);

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/templates/:id/approve
// @desc    Approve template for WhatsApp
// @access  Private
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await query(
      'SELECT * FROM templates WHERE id = $1 AND organization_id = $2',
      [id, req.user.organization_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or access denied'
      });
    }

    const result = await query(
      'UPDATE templates SET is_approved = true, approved_by = $1, approved_at = NOW() WHERE id = $2 RETURNING *',
      [req.user.id, id]
    );

    res.json({
      success: true,
      message: 'Template approved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Approve template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/templates/:id
// @desc    Delete template
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await query(
      'SELECT * FROM templates WHERE id = $1 AND organization_id = $2',
      [id, req.user.organization_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or access denied'
      });
    }

    await query('DELETE FROM templates WHERE id = $1', [id]);

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

// @route   GET /api/templates/categories
// @desc    Get template categories
// @access  Private
router.get('/meta/categories', authenticate, async (req, res) => {
  try {
    const categories = [
      'welcome',
      'follow_up',
      'promotion',
      'reminder',
      'confirmation',
      'support',
      'marketing',
      'transactional'
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;