const Shopify = require('shopify-api-node');
const WooCommerceAPI = require('woocommerce-api');
const axios = require('axios');
require('dotenv').config();

class EcommerceService {
  constructor() {
    this.connections = new Map();
  }

  // Shopify Integration
  async connectShopify(shopDomain, accessToken) {
    try {
      const shopify = new Shopify({
        shopName: shopDomain.replace('.myshopify.com', ''),
        accessToken: accessToken,
        apiVersion: '2023-10'
      });

      // Test connection
      await shopify.shop.get();

      const connectionId = `shopify_${Date.now()}`;
      this.connections.set(connectionId, {
        type: 'shopify',
        client: shopify,
        shopDomain,
        accessToken
      });

      return {
        success: true,
        connectionId
      };
    } catch (error) {
      console.error('Shopify connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getShopifyOrders(connectionId, options = {}) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'shopify') {
        throw new Error('Invalid Shopify connection');
      }

      const orders = await connData.client.order.list(options);
      return {
        success: true,
        data: orders
      };
    } catch (error) {
      console.error('Get Shopify orders error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getShopifyCustomers(connectionId, options = {}) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'shopify') {
        throw new Error('Invalid Shopify connection');
      }

      const customers = await connData.client.customer.list(options);
      return {
        success: true,
        data: customers
      };
    } catch (error) {
      console.error('Get Shopify customers error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getShopifyAbandonedCheckouts(connectionId, options = {}) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'shopify') {
        throw new Error('Invalid Shopify connection');
      }

      const checkouts = await connData.client.checkout.list(options);
      return {
        success: true,
        data: checkouts
      };
    } catch (error) {
      console.error('Get Shopify abandoned checkouts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // WooCommerce Integration
  async connectWooCommerce(storeUrl, consumerKey, consumerSecret) {
    try {
      const wooCommerce = new WooCommerceAPI({
        url: storeUrl,
        consumerKey,
        consumerSecret,
        wpAPI: true,
        version: 'wc/v3'
      });

      // Test connection
      await axios.get(`${storeUrl}/wp-json/wc/v3/`, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        }
      });

      const connectionId = `woocommerce_${Date.now()}`;
      this.connections.set(connectionId, {
        type: 'woocommerce',
        client: wooCommerce,
        storeUrl,
        consumerKey,
        consumerSecret
      });

      return {
        success: true,
        connectionId
      };
    } catch (error) {
      console.error('WooCommerce connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWooCommerceOrders(connectionId, options = {}) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'woocommerce') {
        throw new Error('Invalid WooCommerce connection');
      }

      const response = await axios.get(`${connData.storeUrl}/wp-json/wc/v3/orders`, {
        auth: {
          username: connData.consumerKey,
          password: connData.consumerSecret
        },
        params: options
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get WooCommerce orders error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWooCommerceCustomers(connectionId, options = {}) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'woocommerce') {
        throw new Error('Invalid WooCommerce connection');
      }

      const response = await axios.get(`${connData.storeUrl}/wp-json/wc/v3/customers`, {
        auth: {
          username: connData.consumerKey,
          password: connData.consumerSecret
        },
        params: options
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get WooCommerce customers error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generic e-commerce sync method
  async syncEcommerceData(ecommerceType, connectionId, dataType, options = {}) {
    switch (ecommerceType) {
      case 'shopify':
        switch (dataType) {
          case 'orders':
            return await this.getShopifyOrders(connectionId, options);
          case 'customers':
            return await this.getShopifyCustomers(connectionId, options);
          case 'abandoned_checkouts':
            return await this.getShopifyAbandonedCheckouts(connectionId, options);
          default:
            return { success: false, error: 'Unsupported data type for Shopify' };
        }
      case 'woocommerce':
        switch (dataType) {
          case 'orders':
            return await this.getWooCommerceOrders(connectionId, options);
          case 'customers':
            return await this.getWooCommerceCustomers(connectionId, options);
          default:
            return { success: false, error: 'Unsupported data type for WooCommerce' };
        }
      default:
        return { success: false, error: 'Unsupported e-commerce platform' };
    }
  }

  // Disconnect e-commerce platform
  disconnectEcommerce(connectionId) {
    this.connections.delete(connectionId);
    return { success: true };
  }

  // Get all active connections
  getActiveConnections() {
    const connections = [];
    for (const [id, data] of this.connections) {
      connections.push({
        id,
        type: data.type,
        connected: true,
        shopDomain: data.shopDomain || data.storeUrl
      });
    }
    return connections;
  }

  // Webhook handlers for real-time updates
  async handleShopifyWebhook(webhookData, topic) {
    try {
      console.log(`Received Shopify webhook: ${topic}`, webhookData);

      // Process webhook based on topic
      switch (topic) {
        case 'orders/create':
          // Handle new order
          break;
        case 'orders/paid':
          // Handle order payment
          break;
        case 'checkouts/create':
          // Handle abandoned checkout
          break;
        case 'customers/create':
          // Handle new customer
          break;
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Handle Shopify webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleWooCommerceWebhook(webhookData, topic) {
    try {
      console.log(`Received WooCommerce webhook: ${topic}`, webhookData);

      // Process webhook based on topic
      switch (topic) {
        case 'order.created':
          // Handle new order
          break;
        case 'customer.created':
          // Handle new customer
          break;
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Handle WooCommerce webhook error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EcommerceService();