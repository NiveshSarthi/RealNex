const express = require('express');
const AgentNetwork = require('../models/AgentNetwork');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/network
// @desc    Get agent's professional network
// @access  Private
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { status = 'connected', limit = 50, offset = 0 } = req.query;

    const network = await AgentNetwork.getNetwork(
      req.agent.id,
      status,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: network,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get network error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/requests
// @desc    Get connection requests
// @access  Private
router.get('/requests', authenticateAgent, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const requests = await AgentNetwork.getConnectionRequests(
      req.agent.id,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: requests,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get connection requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/network/connect/:agentId
// @desc    Send connection request to another agent
// @access  Private
router.post('/connect/:agentId', authenticateAgent, async (req, res) => {
  try {
    const { agentId: targetAgentId } = req.params;
    const { connectionType, notes } = req.body;

    if (req.agent.id === targetAgentId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot connect to yourself'
      });
    }

    // Check if target agent exists
    const { query } = require('../config/database');
    const agentCheck = await query(
      'SELECT id, name FROM agents WHERE id = $1 AND is_active = true',
      [targetAgentId]
    );

    if (agentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const connection = await AgentNetwork.createConnection(
      req.agent.id,
      targetAgentId,
      connectionType,
      notes
    );

    res.status(201).json({
      success: true,
      data: connection,
      message: 'Connection request sent successfully'
    });
  } catch (error) {
    console.error('Create connection error:', error);

    if (error.message.includes('Connection already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/network/accept/:connectionId
// @desc    Accept connection request
// @access  Private
router.post('/accept/:connectionId', authenticateAgent, async (req, res) => {
  try {
    const { connectionId } = req.params;

    await AgentNetwork.acceptConnection(req.agent.id, connectionId);

    res.json({
      success: true,
      message: 'Connection request accepted'
    });
  } catch (error) {
    console.error('Accept connection error:', error);

    if (error.message.includes('not found') || error.message.includes('Unauthorized')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/network/reject/:connectionId
// @desc    Reject connection request
// @access  Private
router.post('/reject/:connectionId', authenticateAgent, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Verify the connection belongs to the agent
    const connection = await AgentNetwork.findById(connectionId);

    if (!connection || connection.connectedAgentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        message: 'Connection not found or access denied'
      });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection is not in pending status'
      });
    }

    await AgentNetwork.removeConnection(req.agent.id, connection.connectedAgentId);

    res.json({
      success: true,
      message: 'Connection request rejected'
    });
  } catch (error) {
    console.error('Reject connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/network/:agentId
// @desc    Remove connection with an agent
// @access  Private
router.delete('/:agentId', authenticateAgent, async (req, res) => {
  try {
    const { agentId: targetAgentId } = req.params;

    await AgentNetwork.removeConnection(req.agent.id, targetAgentId);

    res.json({
      success: true,
      message: 'Connection removed successfully'
    });
  } catch (error) {
    console.error('Remove connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/network/block/:agentId
// @desc    Block an agent
// @access  Private
router.post('/block/:agentId', authenticateAgent, async (req, res) => {
  try {
    const { agentId: targetAgentId } = req.params;

    await AgentNetwork.blockConnection(req.agent.id, targetAgentId);

    res.json({
      success: true,
      message: 'Agent blocked successfully'
    });
  } catch (error) {
    console.error('Block agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/search
// @desc    Search for agents to connect with
// @access  Private
router.get('/search', authenticateAgent, async (req, res) => {
  try {
    const { q: searchTerm, location, specializations, limit = 20 } = req.query;

    const agents = await AgentNetwork.searchAgents(
      searchTerm,
      req.agent.id,
      location,
      specializations ? specializations.split(',') : null,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('Search agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/recommendations
// @desc    Get agent recommendations based on network
// @access  Private
router.get('/recommendations', authenticateAgent, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recommendations = await AgentNetwork.getRecommendations(
      req.agent.id,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/stats
// @desc    Get network statistics
// @access  Private
router.get('/stats', authenticateAgent, async (req, res) => {
  try {
    const stats = await AgentNetwork.getNetworkStats(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get network stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/:agentId/mutual
// @desc    Get mutual connections with another agent
// @access  Private
router.get('/:agentId/mutual', authenticateAgent, async (req, res) => {
  try {
    const { agentId: otherAgentId } = req.params;

    const mutualCount = await AgentNetwork.getMutualConnections(
      req.agent.id,
      otherAgentId
    );

    res.json({
      success: true,
      data: {
        mutualConnections: mutualCount
      }
    });
  } catch (error) {
    console.error('Get mutual connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/network/:agentId/profile
// @desc    Get public profile of another agent
// @access  Private
router.get('/:agentId/profile', authenticateAgent, async (req, res) => {
  try {
    const { agentId: targetAgentId } = req.params;

    const { query } = require('../config/database');
    const agent = await query(
      `SELECT id, name, business_name, location, experience_years,
              specializations, trust_score, total_deals, created_at
       FROM agents
       WHERE id = $1 AND is_active = true`,
      [targetAgentId]
    );

    if (agent.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check connection status
    const connectionStatus = await query(
      `SELECT status, trust_level
       FROM agent_network
       WHERE (agent_id = $1 AND connected_agent_id = $2) OR (agent_id = $2 AND connected_agent_id = $1)
       LIMIT 1`,
      [req.agent.id, targetAgentId]
    );

    const profile = {
      ...agent.rows[0],
      connectionStatus: connectionStatus.rows.length > 0 ? connectionStatus.rows[0].status : 'none',
      trustLevel: connectionStatus.rows.length > 0 ? connectionStatus.rows[0].trust_level : null
    };

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;