const express = require('express');
const Broadcast = require('../models/Broadcast');
const Template = require('../models/Template');
const whatsappService = require('../services/whatsapp');
const n8nService = require('../services/n8n');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/v1/campaigns
// @desc    Get all broadcasts for organization
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const broadcasts = await Broadcast.findByOrganization(
      req.user.organizationId,
      status,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: broadcasts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get broadcasts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/campaigns/:id
// @desc    Get broadcast by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await Broadcast.findById(id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Check ownership
    if (broadcast.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('Get broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/campaigns
// @desc    Create a new broadcast
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      description,
      templateId,
      audienceFilters,
      scheduledAt,
      scheduled_at,
      status: bodyStatus,
      workflowId,
      workflow_id
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Broadcast name is required'
      });
    }

    const finalScheduledAt = scheduledAt || scheduled_at;
    const finalStatus = bodyStatus || (finalScheduledAt ? 'scheduled' : 'draft');

    const broadcast = await Broadcast.create({
      organizationId: req.user.organizationId,
      name,
      description,
      templateId: templateId || null,
      workflowId: workflowId || workflow_id || null,
      audienceFilters: audienceFilters || {},
      status: finalStatus,
      scheduledAt: finalScheduledAt,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('Create broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/v1/campaigns/:id
// @desc    Update broadcast
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Check ownership
    if (broadcast.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedBroadcast = await broadcast.update(updates);

    res.json({
      success: true,
      data: updatedBroadcast
    });
  } catch (error) {
    console.error('Update broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/campaigns/:id/send
// @desc    Send broadcast
// @access  Private
router.post('/:id/send', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await Broadcast.findById(id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Check ownership
    if (broadcast.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update status to running
    await broadcast.updateStatus('running');

    // Get recipients based on filters
    const recipients = await broadcast.getRecipients();

    if (recipients.length === 0) {
      await broadcast.updateStatus('completed');
      return res.status(400).json({
        success: false,
        message: 'No recipients found matching the criteria'
      });
    }

    let sent = 0;
    let failed = 0;

    // Process each recipient
    for (const item of recipients) {
      const { recipient } = item;
      const to = recipient.whatsappNumber;

      if (!to) {
        failed++;
        continue;
      }

      let result;

      if (broadcast.workflowId) {
        // Send via n8n workflow
        result = await n8nService.executeWorkflow(broadcast.workflowId, {
          contact: recipient,
          broadcastId: broadcast.id
        });
      } else if (broadcast.templateId) {
        const template = await Template.findById(broadcast.templateId);

        if (template) {
          result = await whatsappService.sendTemplateMessage(to, template.name);
        } else {
          result = { success: false, error: 'Template not found' };
        }
      } else {
        result = await whatsappService.sendTextMessage(to, broadcast.description || broadcast.name);
      }

      if (result.success) {
        sent++;
        // Update recipient status to sent
        await query(
          'UPDATE broadcast_recipients SET status = $1, sent_at = NOW(), whatsapp_message_id = $2 WHERE broadcast_id = $3 AND contact_id = $4',
          ['sent', result.messageId, broadcast.id, recipient.id]
        );
      } else {
        failed++;
        // Update recipient status to failed
        await query(
          'UPDATE broadcast_recipients SET status = $1, error_message = $2 WHERE broadcast_id = $3 AND contact_id = $4',
          ['failed', result.error, broadcast.id, recipient.id]
        );
      }
    }

    // Final updates to broadcast
    await broadcast.updateStats(sent, 0, 0, failed);
    await broadcast.updateStatus('completed');

    res.json({
      success: true,
      message: `Broadcast completed. Sent: ${sent}, Failed: ${failed}`,
      data: {
        broadcastId: id,
        sentCount: sent,
        failedCount: failed
      }
    });
  } catch (error) {
    console.error('Send broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/campaigns/:id/recipients
// @desc    Get broadcast recipients
// @access  Private
router.get('/:id/recipients', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Check ownership
    if (broadcast.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const recipients = await broadcast.getRecipients(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: recipients,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get broadcast recipients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/campaigns/:id/audience-size
// @desc    Calculate audience size for broadcast
// @access  Private
router.post('/:id/audience-size', authenticate, async (req, res) => {
  try {
    const { filters } = req.body;

    const audienceSize = await Broadcast.getAudienceSize(
      req.user.organizationId,
      filters || {}
    );

    res.json({
      success: true,
      data: {
        audienceSize
      }
    });
  } catch (error) {
    console.error('Calculate audience size error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/v1/campaigns/:id
// @desc    Delete broadcast
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await Broadcast.findById(id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Check ownership
    if (broadcast.organizationId !== req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft broadcasts
    if (broadcast.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft broadcasts can be deleted'
      });
    }

    await broadcast.delete();

    res.json({
      success: true,
      message: 'Broadcast deleted successfully'
    });
  } catch (error) {
    console.error('Delete broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/campaigns/stats/overview
// @desc    Get broadcast statistics
// @access  Private
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await Broadcast.getStats(req.user.organizationId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get broadcast stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/campaigns/:id/logs
// @desc    Get broadcast delivery logs
// @access  Private
router.get('/:id/logs', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    // Check if broadcast belongs to organization
    const broadcast = await Broadcast.findById(id);
    if (!broadcast || broadcast.organizationId !== req.user.organizationId) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // TODO: Implement proper broadcast logs - messages table doesn't have broadcast_id
    // For now return empty array
    const result = { rows: [] };

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get broadcast logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
