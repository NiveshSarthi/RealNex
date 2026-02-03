const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const router = express.Router();

// @route   GET /api/network
// @desc    Get network overview (connected agents)
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;

        // In a real app, this would query a 'connections' table
        // For now, we'll return other users in the system as "network"

        let queryText = `
      SELECT id, first_name, last_name, email, role, phone_number, profile_picture
      FROM users 
      WHERE id != $1
    `;
        const params = [req.user.id];

        if (search) {
            queryText += ` AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)`;
            params.push(`%${search}%`);
        }

        queryText += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count (for pagination)
        const countQuery = `SELECT COUNT(*) FROM users WHERE id != $1`;
        const countResult = await query(countQuery, [req.user.id]);

        res.json({
            success: true,
            data: result.rows.map(user => ({
                ...user,
                company: 'Partner Agency', // Mock data
                location: 'Mumbai, India', // Mock data
                specialization: 'Residential', // Mock data
                connectionStatus: 'connected'
            })),
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Network Fetch Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch network' });
    }
});

// @route   GET /api/network/requests
// @desc    Get pending connection requests
// @access  Private
router.get('/requests', authenticate, async (req, res) => {
    try {
        // Mock pending requests
        const mockRequests = [
            {
                id: 101,
                sender: {
                    id: 55,
                    name: 'Rahul Sharma',
                    role: 'Agent',
                    company: 'Sharma Estates',
                    avatar: null
                },
                sent_at: new Date().toISOString()
            },
            {
                id: 102,
                sender: {
                    id: 56,
                    name: 'Priya Verma',
                    role: 'Broker',
                    company: 'Prime Properties',
                    avatar: null
                },
                sent_at: new Date().toISOString()
            }
        ];

        res.json({
            success: true,
            data: mockRequests
        });
    } catch (error) {
        console.error('Network Requests Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch requests' });
    }
});

// @route   GET /api/network/search
// @desc    Search for agents to connect with
// @access  Private
router.get('/search', authenticate, async (req, res) => {
    try {
        const { query: searchQuery } = req.query;

        // Simulate searching a global director
        const result = await query(`
      SELECT id, first_name, last_name, email, role 
      FROM users 
      WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND id != $2
      LIMIT 10
    `, [`%${searchQuery}%`, req.user.id]);

        res.json({
            success: true,
            data: result.rows.map(u => ({
                ...u,
                connectionStatus: 'none',
                matchScore: 85 // Mock match score
            }))
        });
    } catch (error) {
        console.error('Network Search Error:', error);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
});

// @route   POST /api/network/connect
// @desc    Send connection request
// @access  Private
router.post('/connect', authenticate, async (req, res) => {
    try {
        const { userId } = req.body;
        // In a real app: INSERT INTO connections (sender_id, receiver_id, status) ...

        res.json({
            success: true,
            message: 'Connection request sent successfully'
        });
    } catch (error) {
        console.error('Connection Request Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send request' });
    }
});

module.exports = router;
