const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Mock LMS Data
const courses = [
    { id: 1, title: 'Real Estate Fundamentals', progress: 45, total_modules: 10, completed_modules: 4 },
    { id: 2, title: 'Advanced Negotiation Skills', progress: 0, total_modules: 8, completed_modules: 0 },
    { id: 3, title: 'Digital Marketing for Agents', progress: 100, total_modules: 6, completed_modules: 6 }
];

// @route   GET /api/lms/modules
// @desc    Get assigned modules
router.get('/modules', authenticate, async (req, res) => {
    res.json({ success: true, data: courses });
});

module.exports = router;
