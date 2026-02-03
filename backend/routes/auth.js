const express = require('express');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, whatsappNumber, password, businessName } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create organization
    const orgResult = await query(
      'INSERT INTO organizations (name, email) VALUES ($1, $2) RETURNING id',
      [businessName || `${name}'s Organization`, email]
    );
    const organizationId = orgResult.rows[0].id;

    // Create user
    const user = await User.create({
      email,
      phone: whatsappNumber,
      password,
      firstName: name,
      lastName: '',
      organizationId: organizationId,
    });

    // Generate token
    const token = user.generateToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toProfile(),
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Check for unique constraint violation (PostgreSQL error code 23505)
    if (error.message.includes('unique constraint') || error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'A user with this email or phone number already exists.',
      });
    }

    if (error.message.includes('timeout') || error.message.includes('Connection terminated')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again in a few moments.',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Generate token
    const token = user.generateToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toProfile(),
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error.message.includes('timeout') || error.message.includes('Connection terminated')) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable due to database connection issues.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user.toProfile(),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const token = req.user.generateToken();

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

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @route   PUT /api/auth/update-profile
// @desc    Update user profile
// @access  Private
router.put('/update-profile', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone) updateData.phone = phone;

    await req.user.update(updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: req.user.toProfile(),
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;