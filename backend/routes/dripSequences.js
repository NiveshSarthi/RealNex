const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/drip-sequences
// @desc    Get all drip sequences
router.get('/', authenticate, async (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 1, name: 'New Lead Nurture', status: 'active', steps: 5, enrolled: 120 },
            { id: 2, name: 'Post-Visit Follow-up', status: 'active', steps: 3, enrolled: 45 },
            { id: 3, name: 'Cold Lead Revival', status: 'paused', steps: 4, enrolled: 0 }
        ]
    });
});

module.exports = router;
