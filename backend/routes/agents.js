const express = require('express');
const userService = require('../services/userService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/agents/register
// @desc    Register a new agent
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, whatsappNumber, businessName, password } = req.body;

    // Validation
    if (!email || !password || !name || !whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, name, and WhatsApp number',
      });
    }

    // Create user using userService
    const user = await userService.create({
      email,
      phone: whatsappNumber,
      password,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' ') || '',
    });

    // Generate token
    const token = userService.generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Agent registered successfully',
      data: {
        token,
        agent: userService.toProfile(user),
      },
    });
  } catch (error) {
    console.error('Agent registration error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
});

// @route   POST /api/agents/login
// @desc    Login agent
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { whatsappNumber, password } = req.body;

    // Validation
    if (!whatsappNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide WhatsApp number and password',
      });
    }

    // Find user by phone number
    const user = await userService.findByPhone(whatsappNumber);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await userService.verifyPassword(user, password);
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
    const token = userService.generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        agent: userService.toProfile(user),
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

// @route   GET /api/agents/profile
// @desc    Get current agent profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        agent: userService.toProfile(req.user),
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
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const updateData = {};
    if (name) {
      const nameParts = name.split(' ');
      updateData.firstName = nameParts[0];
      updateData.lastName = nameParts.slice(1).join(' ') || '';
    }
    if (phone) updateData.phone = phone;

    const updatedUser = await userService.update(req.user.id, updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        agent: userService.toProfile(updatedUser),
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

module.exports = router;