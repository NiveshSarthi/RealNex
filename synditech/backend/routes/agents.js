const express = require('express');
const Agent = require('../models/Agent');
const { authenticateAgent, checkSubscriptionLimits } = require('../middleware/agentAuth');

const router = express.Router();

// @route   POST /api/agents/register
// @desc    Register a new agent
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const {
      whatsappNumber,
      name,
      email,
      businessName,
      location,
      experienceYears,
      specializations
    } = req.body;

    // Validation
    if (!whatsappNumber || !name) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number and name are required'
      });
    }

    // Check if agent already exists
    const existingAgent = await Agent.findByWhatsApp(whatsappNumber);
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this WhatsApp number already exists'
      });
    }

    // Create agent
    const agent = await Agent.create({
      whatsappNumber,
      name,
      email,
      businessName,
      location,
      experienceYears,
      specializations
    });

    // Generate token
    const token = agent.generateToken();

    res.status(201).json({
      success: true,
      message: 'Agent registered successfully',
      data: {
        agent: agent.toProfile(),
        token,
      },
    });
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
});

// @route   POST /api/agents/login
// @desc    Login agent
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find agent by email (for now, we'll use a simple approach)
    // In production, you'd want proper user management
    const { query } = require('../config/database');
    const result = await query('SELECT * FROM agents WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const agentData = result.rows[0];
    const agent = new Agent(agentData);

    // For testing purposes, use simple password check
    // In production, implement proper password hashing
    const isPasswordValid = password === 'admin123'; // Simple check for test user
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Check subscription
    if (agent.subscriptionStatus === 'expired') {
      return res.status(403).json({
        success: false,
        message: 'Subscription expired. Please renew to continue.',
      });
    }

    // Generate token
    const token = agent.generateToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        agent: agent.toProfile(),
        token,
      },
    });
  } catch (error) {
    console.error('Agent login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// @route   GET /api/agents/me
// @desc    Get current agent profile
// @access  Private
router.get('/me', authenticateAgent, async (req, res) => {
  try {
    const stats = await req.agent.getStats();

    res.json({
      success: true,
      data: {
        agent: {
          ...req.agent.toProfile(),
          stats
        }
      },
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   PUT /api/agents/profile
// @desc    Update agent profile
// @access  Private
router.put('/profile', authenticateAgent, async (req, res) => {
  try {
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updates.id;
    delete updates.whatsappNumber;
    delete updates.subscriptionTier;
    delete updates.subscriptionStatus;
    delete updates.trustScore;
    delete updates.totalDeals;
    delete updates.totalCommission;

    const updatedAgent = await req.agent.update(updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        agent: updatedAgent.toProfile(),
      },
    });
  } catch (error) {
    console.error('Update agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/agents/stats
// @desc    Get agent statistics
// @access  Private
router.get('/stats', authenticateAgent, async (req, res) => {
  try {
    const stats = await req.agent.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/agents/limits
// @desc    Get subscription limits
// @access  Private
router.get('/limits', authenticateAgent, (req, res) => {
  try {
    const limits = req.agent.getSubscriptionLimits();

    res.json({
      success: true,
      data: {
        currentTier: req.agent.subscriptionTier,
        limits,
      },
    });
  } catch (error) {
    console.error('Get agent limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/agents/network
// @desc    Get agent network (collaborators)
// @access  Private
router.get('/network', authenticateAgent, async (req, res) => {
  try {
    const { query } = require('../config/database');

    // Get agents this agent has collaborated with
    const networkResult = await query(`
      SELECT DISTINCT
        CASE
          WHEN c.primary_agent = $1 THEN c.collaborating_agent
          ELSE c.primary_agent
        END as collaborator_id,
        a.name, a.business_name, a.location, a.trust_score,
        COUNT(*) as collaboration_count
      FROM collaborations c
      JOIN agents a ON (
        CASE
          WHEN c.primary_agent = $1 THEN c.collaborating_agent = a.id
          ELSE c.primary_agent = a.id
        END
      )
      WHERE (c.primary_agent = $1 OR c.collaborating_agent = $1)
        AND c.status = 'completed'
      GROUP BY collaborator_id, a.name, a.business_name, a.location, a.trust_score
      ORDER BY collaboration_count DESC
      LIMIT 20
    `, [req.agent.id]);

    res.json({
      success: true,
      data: networkResult.rows,
    });
  } catch (error) {
    console.error('Get agent network error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/agents/search
// @desc    Search agents by location or specialization
// @access  Private
router.get('/search', authenticateAgent, async (req, res) => {
  try {
    const { location, specialization, limit = 20 } = req.query;

    let agents = [];

    if (specialization) {
      agents = await Agent.findBySpecialization(specialization, location, parseInt(limit));
    } else if (location) {
      agents = await Agent.findByLocation(location, parseInt(limit));
    } else {
      return res.status(400).json({
        success: false,
        message: 'Location or specialization parameter required'
      });
    }

    // Remove sensitive data
    const safeAgents = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      businessName: agent.businessName,
      location: agent.location,
      specializations: agent.specializations,
      trustScore: agent.trustScore,
      totalDeals: agent.totalDeals,
      experienceYears: agent.experienceYears
    }));

    res.json({
      success: true,
      data: safeAgents,
    });
  } catch (error) {
    console.error('Search agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/agents/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', authenticateAgent, async (req, res) => {
  try {
    const token = req.agent.generateToken();

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        token,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/agents/logout
// @desc    Logout agent
// @access  Private
router.post('/logout', authenticateAgent, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;