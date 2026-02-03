const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   GET /api/leads
// @desc    Get all leads
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        // Assuming leads are any contacts for now, or we could filter by specific tags/channels
        // For now, let's return all contacts as leads
        const result = await query(
            'SELECT * FROM contacts WHERE organization_id = $1 ORDER BY created_at DESC',
            [organizationId]
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
                phone: row.phone,
                email: row.email,
                status: row.custom_fields?.status || 'new',
                source: row.channel,
                location: row.custom_fields?.location,
                budget_min: row.custom_fields?.budget_min,
                budget_max: row.custom_fields?.budget_max,
                type: row.custom_fields?.type,
                lead_score: row.engagement_score,
                last_contact: row.last_contacted_at,
                created_at: row.created_at
            }))
        });
    } catch (error) {
        console.error('Get leads error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/leads
// @desc    Create a new lead
// @access  Private
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, phone, email, status, source, location, budget_min, budget_max, type, notes } = req.body;
        const organizationId = req.user.organizationId;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: 'Name and Phone are required' });
        }

        // Check if lead already exists
        const checkLead = await query(
            'SELECT * FROM contacts WHERE organization_id = $1 AND phone = $2',
            [organizationId, phone]
        );

        if (checkLead.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Lead with this phone number already exists' });
        }

        const firstName = name.split(' ')[0];
        const lastName = name.split(' ').slice(1).join(' ') || '';

        // Store extra fields in custom_fields JSONB
        const customFields = {
            status: status || 'new',
            source: source || 'manual',
            location,
            budget_min,
            budget_max,
            type,
            notes
        };

        const result = await query(
            `INSERT INTO contacts (
        organization_id, 
        contact_id, 
        channel, 
        phone, 
        email, 
        first_name, 
        last_name, 
        custom_fields,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
            [
                organizationId,
                phone, // Using phone as contact_id for manual leads
                'manual', // Channel
                phone,
                email,
                firstName,
                lastName,
                customFields
            ]
        );

        const newLead = result.rows[0];

        res.status(201).json({
            success: true,
            data: {
                id: newLead.id,
                name: `${newLead.first_name} ${newLead.last_name}`.trim(),
                phone: newLead.phone,
                email: newLead.email,
                // ... transform other fields if needed
            }
        });

    } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

module.exports = router;
