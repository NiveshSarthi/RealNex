const express = require('express');
const router = express.Router();
const QuickReply = require('../models/QuickReply');
const { authenticate } = require('../middleware/auth');

// @route   GET /api/quick-replies
// @desc    Get all quick replies
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const replies = await QuickReply.findAll(req.user.organizationId, req.query);
        res.json({
            success: true,
            data: replies
        });
    } catch (error) {
        console.error('Fetch replies error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/quick-replies/stats
// @desc    Get quick reply stats
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
    try {
        const replies = await QuickReply.findAll(req.user.organizationId);

        // Calculate simple stats
        const stats = {
            total_replies: replies.length,
            categories_count: new Set(replies.map(r => r.category)).size,
            total_usage: 0, // Placeholder
            avg_usage: 0 // Placeholder
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/quick-replies/categories
// @desc    Get quick reply categories
// @access  Private
router.get('/categories', authenticate, async (req, res) => {
    try {
        // Return hardcoded categories for now, or fetch distinct from DB
        const categories = [
            { id: 'greeting', name: 'Greeting' },
            { id: 'property', name: 'Property' },
            { id: 'schedule', name: 'Schedule' },
            { id: 'other', name: 'Other' }
        ];
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/quick-replies/setup-defaults
// @desc    Setup default quick replies
// @access  Private
router.post('/setup-defaults', authenticate, async (req, res) => {
    try {
        const defaults = [
            { title: '👋 Hello', category: 'greeting', action: 'greeting', replyText: 'Hi there! How can I help you today?', displayOrder: 1 },
            { title: '🏠 Buy Property', category: 'property', action: 'buy_property', replyText: 'I am looking to buy a property.', displayOrder: 2 },
            { title: '📅 Schedule Visit', category: 'schedule', action: 'schedule_visit', replyText: 'I would like to schedule a site visit.', displayOrder: 3 },
            { title: '📞 Contact Agent', category: 'other', action: 'contact_agent', replyText: 'Can I speak to a human agent?', displayOrder: 4 }
        ];

        for (const reply of defaults) {
            await QuickReply.create({
                organizationId: req.user.organizationId,
                ...reply
            });
        }

        res.json({ success: true, message: 'Defaults created' });
    } catch (error) {
        console.error('Setup defaults error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/quick-replies
// @desc    Create quick reply
// @access  Private
router.post('/', authenticate, async (req, res) => {
    try {
        const reply = await QuickReply.create({
            organizationId: req.user.organizationId,
            ...req.body
        });
        res.status(201).json({ success: true, data: reply });
    } catch (error) {
        console.error('Create reply error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/quick-replies/:id
// @desc    Update quick reply
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
    try {
        const reply = await QuickReply.update(req.params.id, req.body);
        if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });
        res.json({ success: true, data: reply });
    } catch (error) {
        console.error('Update reply error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   DELETE /api/quick-replies/:id
// @desc    Delete quick reply
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await QuickReply.delete(req.params.id);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete reply error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
