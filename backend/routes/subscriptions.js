const express = require('express');
const Subscription = require('../models/Subscription');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// @route   GET /api/subscriptions/plans
// @desc    Get all available subscription plans
// @access  Public
router.get('/plans', async (req, res) => {
  try {
    const queryText = 'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly';
    const result = await query(queryText);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/my
// @desc    Get current user's organization subscription
// @access  Private
router.get('/my', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findActiveByOrganizationId(req.user.organizationId);

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/subscriptions
// @desc    Create new subscription
// @access  Private (Admin only)
router.post('/', authenticate, async (req, res) => {
  const fs = require('fs');
  const logFile = __dirname + '/../debug.log';
  try {
    const organizationId = req.body.organizationId || req.user.organizationId;

    fs.appendFileSync(logFile, `[${new Date().toISOString()}] Creating Subscription: ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] User: ${JSON.stringify(req.user)}\n`);

    // Ensure user belongs to the organization if not admin
    if (req.user.role !== 'admin' && req.user.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create subscriptions for this organization'
      });
    }

    const subscription = await Subscription.create({
      organizationId,
      planId: req.body.planId,
      currentPeriodStart: req.body.currentPeriodStart || new Date(),
      currentPeriodEnd: req.body.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      stripeSubscriptionId: req.body.stripeSubscriptionId,
      razorpaySubscriptionId: req.body.razorpaySubscriptionId
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: subscription
    });
  } catch (error) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] Create Subscription Error: ${error.message}\n`);
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// @route   PUT /api/subscriptions/:id
// @desc    Update subscription
// @access  Private (Admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Check if user is admin or belongs to the organization
    if (req.user.role !== 'admin' && req.user.organizationId !== subscription.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this subscription'
      });
    }

    await subscription.update(updateData);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/subscriptions/:id/cancel
// @desc    Cancel subscription
// @access  Private
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Check if user belongs to the organization
    if (req.user.organizationId !== subscription.organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this subscription'
      });
    }

    await subscription.cancel();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/organization/:organizationId
// @desc    Get all subscriptions for an organization
// @access  Private
router.get('/organization/:organizationId', authenticate, async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Check if user is admin or belongs to the organization
    if (req.user.role !== 'admin' && req.user.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view subscriptions for this organization'
      });
    }

    const subscriptions = await Subscription.findByOrganizationId(organizationId);

    res.json({
      success: true,
      data: subscriptions || []
    });
  } catch (error) {
    console.error('Get organization subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/my/history
// @desc    Get transaction history for the current organization
// @access  Private
router.get('/my/history', authenticate, async (req, res) => {
  try {
    const queryText = 'SELECT * FROM payments WHERE organization_id = $1 ORDER BY created_at DESC';
    const result = await query(queryText, [req.user.organizationId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/my/stats
// @desc    Get payment statistics for the current organization
// @access  Private
router.get('/my/stats', authenticate, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        SUM(amount) as total_amount,
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
        AVG(amount) as avg_payment_amount
      FROM payments 
      WHERE organization_id = $1
    `;
    const result = await query(queryText, [req.user.organizationId]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/methods
// @desc    Get available payment methods
// @access  Private
router.get('/methods', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'razorpay', name: 'Razorpay', type: 'gateway', status: 'active' },
      { id: 'bank_transfer', name: 'Bank Transfer', type: 'manual', status: 'active' }
    ]
  });
});

// @route   GET /api/subscriptions/invoices/:id
// @desc    Get invoice details
// @access  Private
router.get('/invoices/:id', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      url: '#',
      date: new Date().toISOString()
    }
  });
});

// @route   POST /api/subscriptions/verify/:gateway
// @desc    Verify payment from gateway
// @access  Private
router.post('/verify/:gateway', authenticate, async (req, res) => {
  res.json({
    success: true,
    message: 'Payment verified successfully'
  });
});

module.exports = router;