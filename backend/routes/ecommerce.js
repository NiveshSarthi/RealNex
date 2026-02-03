const express = require('express');
const ecommerceService = require('../services/ecommerce');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/ecommerce/shopify/connect
// @desc    Connect to Shopify
// @access  Private
router.post('/shopify/connect', authenticate, async (req, res) => {
  try {
    const { shopDomain, accessToken } = req.body;

    if (!shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shop domain and access token are required'
      });
    }

    const result = await ecommerceService.connectShopify(shopDomain, accessToken);

    if (result.success) {
      res.json({
        success: true,
        message: 'Connected to Shopify successfully',
        data: {
          connectionId: result.connectionId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Shopify',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Shopify connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/ecommerce/woocommerce/connect
// @desc    Connect to WooCommerce
// @access  Private
router.post('/woocommerce/connect', authenticate, async (req, res) => {
  try {
    const { storeUrl, consumerKey, consumerSecret } = req.body;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'Store URL, consumer key, and consumer secret are required'
      });
    }

    const result = await ecommerceService.connectWooCommerce(storeUrl, consumerKey, consumerSecret);

    if (result.success) {
      res.json({
        success: true,
        message: 'Connected to WooCommerce successfully',
        data: {
          connectionId: result.connectionId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to WooCommerce',
        error: result.error
      });
    }
  } catch (error) {
    console.error('WooCommerce connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/ecommerce/:platform/orders
// @desc    Get orders from e-commerce platform
// @access  Private
router.get('/:platform/orders', authenticate, async (req, res) => {
  try {
    const { platform } = req.params;
    const { connectionId, ...options } = req.query;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required'
      });
    }

    const result = await ecommerceService.syncEcommerceData(platform, connectionId, 'orders', options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get orders from ${platform}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error(`Get ${req.params.platform} orders error:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/ecommerce/:platform/customers
// @desc    Get customers from e-commerce platform
// @access  Private
router.get('/:platform/customers', authenticate, async (req, res) => {
  try {
    const { platform } = req.params;
    const { connectionId, ...options } = req.query;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required'
      });
    }

    const result = await ecommerceService.syncEcommerceData(platform, connectionId, 'customers', options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get customers from ${platform}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error(`Get ${req.params.platform} customers error:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/ecommerce/shopify/abandoned-checkouts
// @desc    Get abandoned checkouts from Shopify
// @access  Private
router.get('/shopify/abandoned-checkouts', authenticate, async (req, res) => {
  try {
    const { connectionId, ...options } = req.query;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required'
      });
    }

    const result = await ecommerceService.syncEcommerceData('shopify', connectionId, 'abandoned_checkouts', options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get abandoned checkouts from Shopify',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Shopify abandoned checkouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/ecommerce/webhook/shopify
// @desc    Handle Shopify webhooks
// @access  Public (but should be verified)
router.post('/webhook/shopify', async (req, res) => {
  try {
    const topic = req.headers['x-shopify-topic'];
    const result = await ecommerceService.handleShopifyWebhook(req.body, topic);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      console.error('Shopify webhook processing failed:', result.error);
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('Shopify webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// @route   POST /api/ecommerce/webhook/woocommerce
// @desc    Handle WooCommerce webhooks
// @access  Public (but should be verified)
router.post('/webhook/woocommerce', async (req, res) => {
  try {
    const topic = req.headers['x-wc-webhook-topic'];
    const result = await ecommerceService.handleWooCommerceWebhook(req.body, topic);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      console.error('WooCommerce webhook processing failed:', result.error);
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('WooCommerce webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// @route   DELETE /api/ecommerce/disconnect/:connectionId
// @desc    Disconnect e-commerce platform
// @access  Private
router.delete('/disconnect/:connectionId', authenticate, (req, res) => {
  try {
    const { connectionId } = req.params;

    const result = ecommerceService.disconnectEcommerce(connectionId);

    res.json({
      success: true,
      message: 'E-commerce platform disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect e-commerce error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/ecommerce/connections
// @desc    Get active e-commerce connections
// @access  Private
router.get('/connections', authenticate, (req, res) => {
  try {
    const connections = ecommerceService.getActiveConnections();

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    console.error('Get e-commerce connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;