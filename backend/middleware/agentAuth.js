const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');

// Middleware to authenticate agent JWT tokens
const authenticateAgent = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies (if implemented later)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get agent from database
      const agent = await Agent.findById(decoded.id);

      if (!agent) {
        return res.status(401).json({
          success: false,
          message: 'Token is not valid. Agent not found.',
        });
      }

      if (!agent.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated.',
        });
      }

      // Check subscription status
      if (agent.subscriptionStatus === 'expired' || agent.subscriptionStatus === 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Subscription expired. Please renew to continue.',
        });
      }

      // Add agent to request
      req.agent = agent;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};

// Middleware to check subscription tier access
const checkSubscriptionTier = (requiredTier) => {
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const tierHierarchy = {
      'starter': 1,
      'professional': 2,
      'enterprise': 3,
    };

    const agentTier = tierHierarchy[req.agent.subscriptionTier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;

    if (agentTier < requiredTierLevel) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${requiredTier} plan or higher. Current plan: ${req.agent.subscriptionTier}`,
      });
    }

    next();
  };
};

// Middleware to check subscription limits
const checkSubscriptionLimits = (action) => {
  return async (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    try {
      let currentCount = 0;

      // Get current count based on action
      switch (action) {
        case 'add_lead':
          const leadResult = await req.agent.query(
            'SELECT COUNT(*) as count FROM leads WHERE assigned_agent = $1',
            [req.agent.id]
          );
          currentCount = parseInt(leadResult.rows[0].count);
          break;

        case 'add_property':
          const propertyResult = await req.agent.query(
            'SELECT COUNT(*) as count FROM properties WHERE agent_id = $1',
            [req.agent.id]
          );
          currentCount = parseInt(propertyResult.rows[0].count);
          break;

        case 'create_campaign':
          const campaignResult = await req.agent.query(
            'SELECT COUNT(*) as count FROM campaigns WHERE agent_id = $1',
            [req.agent.id]
          );
          currentCount = parseInt(campaignResult.rows[0].count);
          break;

        // Add more actions as needed
      }

      if (!req.agent.canPerformAction(action, currentCount)) {
        return res.status(403).json({
          success: false,
          message: `Subscription limit reached for ${action}. Please upgrade your plan.`,
          currentCount,
          limit: req.agent.getSubscriptionLimits()[action.replace('add_', '').replace('create_', '')]
        });
      }

      next();
    } catch (error) {
      console.error('Error checking subscription limits:', error);
      res.status(500).json({
        success: false,
        message: 'Server error checking limits.',
      });
    }
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAgentAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agent = await Agent.findById(decoded.id);

        if (agent && agent.isActive && agent.subscriptionStatus !== 'expired') {
          req.agent = agent;
        }
      } catch (err) {
        // Ignore invalid tokens for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticateToken: authenticateAgent,
  authenticateAgent,
  checkSubscriptionTier,
  checkSubscriptionLimits,
  optionalAgentAuth,
};