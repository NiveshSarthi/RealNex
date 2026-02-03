const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT tokens
const authenticate = async (req, res, next) => {
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

      // Get user from database
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or user not found. Please log in again.',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated.',
        });
      }

      // Add user to request
      req.user = user;
      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token is invalid or expired. Please log in again.',
        });
      }

      console.error('Auth middleware query error:', err);
      return res.status(500).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }
  } catch (error) {
    console.error('Critical auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Critical error during authentication.',
    });
  }
};

// Middleware to check user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};

// Middleware to check subscription tier access
const checkSubscription = (requiredTier) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const tierHierarchy = {
      'starter': 1,
      'professional': 2,
      'business': 3,
      'enterprise': 4,
    };

    const userTier = tierHierarchy[req.user.subscriptionTier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;

    if (userTier < requiredTierLevel) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${requiredTier} plan or higher. Current plan: ${req.user.subscriptionTier}`,
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user && user.isActive) {
          req.user = user;
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
  authenticate,
  authorize,
  checkSubscription,
  optionalAuth,
};