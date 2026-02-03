const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class PaymentService {
  constructor() {
    // Razorpay configuration
    this.razorpay = {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      baseUrl: 'https://api.razorpay.com/v1'
    };

    // PayU configuration
    this.payu = {
      merchantKey: process.env.PAYU_MERCHANT_KEY,
      merchantSalt: process.env.PAYU_MERCHANT_SALT,
      baseUrl: process.env.NODE_ENV === 'production'
        ? 'https://secure.payu.in'
        : 'https://test.payu.in'
    };

    // Cashfree configuration
    this.cashfree = {
      appId: process.env.CASHFREE_APP_ID,
      secretKey: process.env.CASHFREE_SECRET_KEY,
      baseUrl: process.env.NODE_ENV === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg'
    };
  }

  // Create Razorpay order
  async createRazorpayOrder(amount, currency = 'INR', receipt = null, notes = {}) {
    try {
      const orderData = {
        amount: amount * 100, // Razorpay expects amount in paisa
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
        notes
      };

      const response = await axios.post(
        `${this.razorpay.baseUrl}/orders`,
        orderData,
        {
          auth: {
            username: this.razorpay.keyId,
            password: this.razorpay.keySecret
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        orderId: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        gateway: 'razorpay',
        data: response.data
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Verify Razorpay payment
  verifyRazorpayPayment(orderId, paymentId, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.razorpay.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Razorpay verification error:', error);
      return false;
    }
  }

  // Create PayU payment hash
  createPayUHash(paymentData) {
    const { txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' } = paymentData;

    const hashString = `${this.payu.merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${this.payu.merchantSalt}`;

    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  // Verify PayU payment
  verifyPayUHash(paymentData) {
    const { status, firstname, amount, txnid, hash } = paymentData;

    const hashString = `${this.payu.merchantSalt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${this.payu.merchantKey}`;

    const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    return hash === expectedHash;
  }

  // Create Cashfree order
  async createCashfreeOrder(orderData) {
    try {
      const requestData = {
        order_id: orderData.orderId,
        order_amount: orderData.amount,
        order_currency: orderData.currency || 'INR',
        customer_details: {
          customer_id: orderData.customerId,
          customer_email: orderData.customerEmail,
          customer_phone: orderData.customerPhone
        },
        order_meta: {
          return_url: orderData.returnUrl,
          notify_url: orderData.notifyUrl
        },
        order_tags: orderData.tags || {}
      };

      const response = await axios.post(
        `${this.cashfree.baseUrl}/orders`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-version': '2022-09-01',
            'x-client-id': this.cashfree.appId,
            'x-client-secret': this.cashfree.secretKey
          }
        }
      );

      return {
        success: true,
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        gateway: 'cashfree',
        data: response.data
      };
    } catch (error) {
      console.error('Cashfree order creation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Process subscription payment
  async processSubscriptionPayment(agentId, planId, gateway = 'razorpay') {
    try {
      // Get plan details
      const planDetails = await this.getSubscriptionPlan(planId);
      if (!planDetails) {
        throw new Error('Invalid subscription plan');
      }

      const paymentData = {
        agentId,
        amount: planDetails.price,
        currency: 'INR',
        paymentType: 'subscription',
        description: `SyndiTech ${planDetails.name} Subscription`,
        relatedId: planId,
        gateway
      };

      let orderResult;
      switch (gateway) {
        case 'razorpay':
          orderResult = await this.createRazorpayOrder(
            planDetails.price,
            'INR',
            `sub_${agentId}_${Date.now()}`,
            { planId, agentId, type: 'subscription' }
          );
          break;
        case 'cashfree':
          orderResult = await this.createCashfreeOrder({
            orderId: `sub_${agentId}_${Date.now()}`,
            amount: planDetails.price,
            customerId: agentId,
            customerEmail: 'agent@example.com', // Would be fetched from agent data
            customerPhone: '9999999999', // Would be fetched from agent data
            returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
            notifyUrl: `${process.env.BACKEND_URL}/api/payments/webhook/${gateway}`,
            tags: { type: 'subscription', planId }
          });
          break;
        default:
          throw new Error('Unsupported payment gateway');
      }

      if (orderResult.success) {
        // Save payment record
        const paymentRecord = await this.savePaymentRecord({
          ...paymentData,
          gatewayOrderId: orderResult.orderId,
          status: 'pending'
        });

        return {
          success: true,
          paymentId: paymentRecord.id,
          gatewayOrderId: orderResult.orderId,
          gateway,
          amount: planDetails.price,
          currency: 'INR'
        };
      } else {
        throw new Error(orderResult.error);
      }
    } catch (error) {
      console.error('Subscription payment processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process commission payment
  async processCommissionPayment(agentId, amount, description, collaborationId = null) {
    try {
      const paymentData = {
        agentId,
        amount,
        currency: 'INR',
        paymentType: 'commission',
        description,
        relatedId: collaborationId,
        gateway: 'bank_transfer' // Commissions typically paid via bank transfer
      };

      const paymentRecord = await this.savePaymentRecord({
        ...paymentData,
        status: 'pending'
      });

      return {
        success: true,
        paymentId: paymentRecord.id,
        amount,
        gateway: 'bank_transfer'
      };
    } catch (error) {
      console.error('Commission payment processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save payment record to database
  async savePaymentRecord(paymentData) {
    const { query } = require('../config/database');

    const queryText = `
      INSERT INTO payments (
        agent_id, payment_type, amount, currency, status,
        gateway, description, related_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      paymentData.agentId,
      paymentData.paymentType,
      paymentData.amount,
      paymentData.currency || 'INR',
      paymentData.status || 'pending',
      paymentData.gateway,
      paymentData.description,
      paymentData.relatedId
    ];

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Update payment status
  async updatePaymentStatus(paymentId, status, gatewayTransactionId = null, gatewayResponse = null) {
    const { query } = require('../config/database');

    const queryText = `
      UPDATE payments
      SET status = $1, gateway_transaction_id = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await query(queryText, [status, gatewayTransactionId, paymentId]);
    return result.rows[0];
  }

  // Get subscription plans
  getSubscriptionPlans() {
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: 999, // ₹999/month
        features: [
          'Up to 500 leads',
          '5 campaigns/month',
          'Basic templates',
          'Email support'
        ],
        limits: {
          leads: 500,
          campaigns: 5,
          templates: 10
        }
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 2499, // ₹2499/month
        features: [
          'Up to 2000 leads',
          '25 campaigns/month',
          'Advanced templates',
          'A/B testing',
          'Priority support',
          'Basic analytics'
        ],
        limits: {
          leads: 2000,
          campaigns: 25,
          templates: 50
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 4999, // ₹4999/month
        features: [
          'Unlimited leads',
          'Unlimited campaigns',
          'Custom templates',
          'Advanced A/B testing',
          'Agent collaboration network',
          'Advanced analytics',
          'Dedicated support',
          'API access'
        ],
        limits: {
          leads: -1, // unlimited
          campaigns: -1, // unlimited
          templates: -1 // unlimited
        }
      }
    ];
  }

  // Get subscription plan by ID
  getSubscriptionPlan(planId) {
    const plans = this.getSubscriptionPlans();
    return plans.find(plan => plan.id === planId);
  }

  // Handle payment webhook
  async handleWebhook(gateway, webhookData) {
    try {
      let paymentUpdate = {};

      switch (gateway) {
        case 'razorpay':
          paymentUpdate = await this.handleRazorpayWebhook(webhookData);
          break;
        case 'cashfree':
          paymentUpdate = await this.handleCashfreeWebhook(webhookData);
          break;
        case 'payu':
          paymentUpdate = await this.handlePayUWebhook(webhookData);
          break;
        default:
          throw new Error('Unsupported gateway');
      }

      if (paymentUpdate.paymentId && paymentUpdate.status) {
        const updatedPayment = await this.updatePaymentStatus(
          paymentUpdate.paymentId,
          paymentUpdate.status,
          paymentUpdate.transactionId
        );

        // Handle subscription activation if payment was successful
        if (paymentUpdate.status === 'completed' && updatedPayment.payment_type === 'subscription') {
          await this.activateSubscription(updatedPayment);
        }

        return { success: true, payment: updatedPayment };
      }

      return { success: false, error: 'Invalid webhook data' };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle Razorpay webhook
  async handleRazorpayWebhook(webhookData) {
    const { event, payment } = webhookData;

    if (event === 'payment.captured') {
      // Find payment by gateway order ID
      const { query } = require('../config/database');
      const paymentRecord = await query(
        'SELECT id FROM payments WHERE gateway_transaction_id = $1',
        [payment.id]
      );

      if (paymentRecord.rows.length > 0) {
        return {
          paymentId: paymentRecord.rows[0].id,
          status: 'completed',
          transactionId: payment.id
        };
      }
    }

    return {};
  }

  // Handle Cashfree webhook
  async handleCashfreeWebhook(webhookData) {
    // Similar implementation for Cashfree webhooks
    return {};
  }

  // Handle PayU webhook
  async handlePayUWebhook(webhookData) {
    // Similar implementation for PayU webhooks
    return {};
  }

  // Activate subscription after successful payment
  async activateSubscription(paymentRecord) {
    const { query } = require('../config/database');

    // Update agent subscription
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 1 month subscription

    await query(
      `UPDATE agents
       SET subscription_tier = $1,
           subscription_status = 'active',
           subscription_start = NOW(),
           subscription_end = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [paymentRecord.related_id, subscriptionEnd, paymentRecord.agent_id]
    );

    console.log(`✅ Subscription activated for agent ${paymentRecord.agent_id}`);
  }

  // Get payment history for agent
  static async getPaymentHistory(agentId, limit = 50, offset = 0) {
    const { query } = require('../config/database');

    const queryText = `
      SELECT * FROM payments
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(queryText, [agentId, limit, offset]);
    return result.rows;
  }

  // Get payment statistics
  static async getPaymentStats(agentId) {
    const { query } = require('../config/database');

    const queryText = `
      SELECT
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN status = 'completed' THEN amount END) as avg_payment_amount,
        MAX(amount) as highest_payment,
        SUM(CASE WHEN payment_type = 'subscription' AND status = 'completed' THEN amount ELSE 0 END) as subscription_revenue,
        SUM(CASE WHEN payment_type = 'commission' AND status = 'completed' THEN amount ELSE 0 END) as commission_paid
      FROM payments
      WHERE agent_id = $1
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }
}

module.exports = new PaymentService();