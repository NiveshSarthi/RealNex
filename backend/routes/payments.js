const express = require('express');
const PaymentService = require('../services/payment');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/payments/plans
// @desc    Get available subscription plans
// @access  Public
router.get('/plans', (req, res) => {
  try {
    const plans = PaymentService.getSubscriptionPlans();

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/subscription
// @desc    Create subscription payment
// @access  Private
router.post('/subscription', authenticateAgent, async (req, res) => {
  try {
    const { planId, gateway = 'razorpay' } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    const result = await PaymentService.processSubscriptionPayment(
      req.agent.id,
      planId,
      gateway
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          gatewayOrderId: result.gatewayOrderId,
          gateway: result.gateway,
          amount: result.amount,
          currency: result.currency
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Create subscription payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/commission
// @desc    Process commission payment
// @access  Private (Admin only - would need admin middleware)
router.post('/commission', authenticateAgent, async (req, res) => {
  try {
    const { agentId, amount, description, collaborationId } = req.body;

    if (!agentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID and amount are required'
      });
    }

    const result = await PaymentService.processCommissionPayment(
      agentId,
      amount,
      description,
      collaborationId
    );

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Process commission payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/history
// @desc    Get payment history
// @access  Private
router.get('/history', authenticateAgent, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const payments = await PaymentService.getPaymentHistory(
      req.agent.id,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/stats
// @desc    Get payment statistics
// @access  Private
router.get('/stats', authenticateAgent, async (req, res) => {
  try {
    const stats = await PaymentService.getPaymentStats(req.agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/verify/:gateway
// @desc    Verify payment completion
// @access  Private
router.post('/verify/:gateway', authenticateAgent, async (req, res) => {
  try {
    const { gateway } = req.params;
    const verificationData = req.body;

    let isValid = false;

    switch (gateway) {
      case 'razorpay':
        isValid = PaymentService.verifyRazorpayPayment(
          verificationData.orderId,
          verificationData.paymentId,
          verificationData.signature
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported gateway'
        });
    }

    if (isValid) {
      // Update payment status
      const updatedPayment = await PaymentService.updatePaymentStatus(
        verificationData.paymentId,
        'completed',
        verificationData.gatewayTransactionId
      );

      // Activate subscription if it was a subscription payment
      if (updatedPayment.payment_type === 'subscription') {
        await PaymentService.activateSubscription(updatedPayment);
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: updatedPayment
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/webhook/:gateway
// @desc    Handle payment gateway webhooks
// @access  Public (but should be secured with gateway signatures)
router.post('/webhook/:gateway', async (req, res) => {
  try {
    const { gateway } = req.params;
    const webhookData = req.body;

    console.log(`🔄 Webhook received from ${gateway}:`, webhookData);

    const result = await PaymentService.handleWebhook(gateway, webhookData);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } else {
      console.error('Webhook processing failed:', result.error);
      res.status(400).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/invoice/:paymentId
// @desc    Generate payment invoice
// @access  Private
router.get('/invoice/:paymentId', authenticateAgent, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Verify payment ownership
    const { query } = require('../config/database');
    const payment = await query(
      'SELECT * FROM payments WHERE id = $1 AND agent_id = $2',
      [paymentId, req.agent.id]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const paymentData = payment.rows[0];

    // Generate simple invoice data (in production, would use PDF library)
    const invoice = {
      invoiceNumber: `INV-${paymentData.id}`,
      paymentId: paymentData.id,
      agentId: paymentData.agent_id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentType: paymentData.payment_type,
      status: paymentData.status,
      description: paymentData.description,
      gateway: paymentData.gateway,
      transactionId: paymentData.gateway_transaction_id,
      createdAt: paymentData.created_at,
      issuedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/refund/:paymentId
// @desc    Process payment refund
// @access  Private (Admin only)
router.post('/refund/:paymentId', authenticateAgent, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    // Verify payment exists and belongs to agent
    const { query } = require('../config/database');
    const payment = await query(
      'SELECT * FROM payments WHERE id = $1 AND agent_id = $2',
      [paymentId, req.agent.id]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const paymentData = payment.rows[0];

    if (paymentData.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    // Process refund based on gateway
    let refundResult;
    switch (paymentData.gateway) {
      case 'razorpay':
        refundResult = await PaymentService.processRazorpayRefund(paymentData, amount);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Refund not supported for this gateway'
        });
    }

    if (refundResult.success) {
      // Update payment status
      await PaymentService.updatePaymentStatus(paymentId, 'refunded');

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: refundResult
      });
    } else {
      res.status(400).json({
        success: false,
        message: refundResult.error
      });
    }
  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/methods
// @desc    Get available payment methods
// @access  Public
router.get('/methods', (req, res) => {
  const methods = [
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Pay using UPI, cards, net banking, and wallets',
      supportedCurrencies: ['INR'],
      features: ['UPI', 'Credit Cards', 'Debit Cards', 'Net Banking', 'Wallets']
    },
    {
      id: 'cashfree',
      name: 'Cashfree',
      description: 'Secure payments with multiple options',
      supportedCurrencies: ['INR'],
      features: ['UPI', 'Cards', 'Net Banking', 'Wallets', 'PayPal']
    },
    {
      id: 'payu',
      name: 'PayU',
      description: 'Comprehensive payment gateway',
      supportedCurrencies: ['INR'],
      features: ['UPI', 'Cards', 'Net Banking', 'Wallets', 'EMI']
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      description: 'Direct bank transfer for commissions',
      supportedCurrencies: ['INR'],
      features: ['NEFT', 'RTGS', 'IMPS']
    }
  ];

  res.json({
    success: true,
    data: methods
  });
});

module.exports = router;