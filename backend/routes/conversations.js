const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/conversations
// @desc    Get all conversations with filters
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      status,
      assignedTo,
      contactId,
      priority,
      channel,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (assignedTo) filters.assignedTo = assignedTo;
    if (contactId) filters.contactId = contactId;
    if (priority) filters.priority = priority;
    if (channel) filters.channel = channel;

    const conversations = await Conversation.findAll(filters, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: conversations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/conversations/:id
// @desc    Get conversation by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Get messages for this conversation
    const messages = await Message.findByConversation(id);

    res.json({
      success: true,
      data: {
        conversation,
        messages
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/conversations
// @desc    Create a new conversation
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      whatsappAccountId,
      whatsappConversationId,
      contactId,
      assignedTo,
      status,
      priority,
      channel
    } = req.body;

    const conversation = await Conversation.create({
      whatsappAccountId,
      whatsappConversationId,
      contactId,
      assignedTo,
      status,
      priority,
      channel
    });

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/conversations/:id
// @desc    Update conversation
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const updatedConversation = await conversation.update(updates);

    res.json({
      success: true,
      data: updatedConversation
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/conversations/:id/assign
// @desc    Assign conversation to user
// @access  Private
router.put('/:id/assign', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const updatedConversation = await conversation.assignTo(assignedTo);

    res.json({
      success: true,
      data: updatedConversation
    });
  } catch (error) {
    console.error('Assign conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/conversations/:id/status
// @desc    Update conversation status
// @access  Private
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const updatedConversation = await conversation.updateStatus(status);

    res.json({
      success: true,
      data: updatedConversation
    });
  } catch (error) {
    console.error('Update conversation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/conversations/:id/priority
// @desc    Update conversation priority
// @access  Private
router.put('/:id/priority', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const updatedConversation = await conversation.updatePriority(priority);

    res.json({
      success: true,
      data: updatedConversation
    });
  } catch (error) {
    console.error('Update conversation priority error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    await conversation.delete();

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/conversations/:id/messages
// @desc    Get messages for a conversation
// @access  Private
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const messages = await Message.findByConversation(id, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: messages,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/conversations/:id/messages
// @desc    Send a message in a conversation
// @access  Private
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text', mediaUrl, mediaCaption } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Create message record
    const message = await Message.create({
      conversationId: id,
      direction: 'outbound',
      messageType,
      content,
      mediaUrl,
      mediaCaption,
      status: 'sent',
      sentAt: new Date()
    });

    // Update conversation last message time
    await conversation.update({ last_message_at: new Date() });

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/conversations/stats/overview
// @desc    Get conversation statistics
// @access  Private
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await Conversation.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get conversation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;