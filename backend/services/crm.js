const jsforce = require('jsforce');
const axios = require('axios');
require('dotenv').config();

class CRMService {
  constructor() {
    this.connections = new Map();
  }

  // Salesforce Integration
  async connectSalesforce(credentials) {
    try {
      const { loginUrl, username, password, securityToken } = credentials;

      const conn = new jsforce.Connection({
        loginUrl: loginUrl || 'https://login.salesforce.com',
      });

      await conn.login(username, password + securityToken);

      const connectionId = `salesforce_${Date.now()}`;
      this.connections.set(connectionId, {
        type: 'salesforce',
        connection: conn,
        credentials
      });

      return {
        success: true,
        connectionId,
        instanceUrl: conn.instanceUrl,
        userInfo: conn.userInfo
      };
    } catch (error) {
      console.error('Salesforce connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSalesforceLead(connectionId, leadData) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'salesforce') {
        throw new Error('Invalid Salesforce connection');
      }

      const conn = connData.connection;

      const lead = await conn.sobject('Lead').create({
        FirstName: leadData.firstName,
        LastName: leadData.lastName,
        Company: leadData.company || 'Individual',
        Email: leadData.email,
        Phone: leadData.phone,
        LeadSource: leadData.source || 'WhatsApp',
        Status: leadData.status || 'Open - Not Contacted',
        Description: leadData.description,
        // Custom fields can be added here
      });

      return {
        success: true,
        leadId: lead.id,
        data: lead
      };
    } catch (error) {
      console.error('Create Salesforce lead error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateSalesforceLead(connectionId, leadId, updateData) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'salesforce') {
        throw new Error('Invalid Salesforce connection');
      }

      const conn = connData.connection;

      const result = await conn.sobject('Lead').update({
        Id: leadId,
        ...updateData
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Update Salesforce lead error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // HubSpot Integration
  async connectHubSpot(apiKey) {
    try {
      // Test connection
      const response = await axios.get('https://api.hubapi.com/contacts/v1/lists/all/contacts/all', {
        params: {
          hapikey: apiKey,
          count: 1
        }
      });

      const connectionId = `hubspot_${Date.now()}`;
      this.connections.set(connectionId, {
        type: 'hubspot',
        apiKey,
        baseUrl: 'https://api.hubapi.com'
      });

      return {
        success: true,
        connectionId
      };
    } catch (error) {
      console.error('HubSpot connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createHubSpotContact(connectionId, contactData) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'hubspot') {
        throw new Error('Invalid HubSpot connection');
      }

      const properties = [];

      if (contactData.firstName) properties.push({ property: 'firstname', value: contactData.firstName });
      if (contactData.lastName) properties.push({ property: 'lastname', value: contactData.lastName });
      if (contactData.email) properties.push({ property: 'email', value: contactData.email });
      if (contactData.phone) properties.push({ property: 'phone', value: contactData.phone });
      if (contactData.company) properties.push({ property: 'company', value: contactData.company });

      // Add custom properties
      if (contactData.source) properties.push({ property: 'lead_source', value: contactData.source });
      if (contactData.status) properties.push({ property: 'lead_status', value: contactData.status });

      const response = await axios.post(
        `${connData.baseUrl}/contacts/v1/contact`,
        { properties },
        {
          params: { hapikey: connData.apiKey }
        }
      );

      return {
        success: true,
        contactId: response.data.vid,
        data: response.data
      };
    } catch (error) {
      console.error('Create HubSpot contact error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateHubSpotContact(connectionId, contactId, updateData) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'hubspot') {
        throw new Error('Invalid HubSpot connection');
      }

      const properties = [];

      Object.keys(updateData).forEach(key => {
        properties.push({ property: key, value: updateData[key] });
      });

      const response = await axios.post(
        `${connData.baseUrl}/contacts/v1/contact/vid/${contactId}/profile`,
        { properties },
        {
          params: { hapikey: connData.apiKey }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Update HubSpot contact error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Zoho CRM Integration
  async connectZohoCRM(clientId, clientSecret, refreshToken) {
    try {
      // Get access token
      const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }
      });

      const accessToken = tokenResponse.data.access_token;

      const connectionId = `zoho_${Date.now()}`;
      this.connections.set(connectionId, {
        type: 'zoho',
        accessToken,
        clientId,
        clientSecret,
        refreshToken,
        baseUrl: 'https://www.zohoapis.com/crm/v2'
      });

      return {
        success: true,
        connectionId
      };
    } catch (error) {
      console.error('Zoho CRM connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createZohoLead(connectionId, leadData) {
    try {
      const connData = this.connections.get(connectionId);
      if (!connData || connData.type !== 'zoho') {
        throw new Error('Invalid Zoho CRM connection');
      }

      const lead = {
        Last_Name: leadData.lastName,
        First_Name: leadData.firstName,
        Email: leadData.email,
        Phone: leadData.phone,
        Company: leadData.company || 'Individual',
        Lead_Source: leadData.source || 'WhatsApp',
        Lead_Status: leadData.status || 'Attempted Contact',
        Description: leadData.description
      };

      const response = await axios.post(
        `${connData.baseUrl}/Leads`,
        { data: [lead] },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${connData.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        leadId: response.data.data[0].details.id,
        data: response.data
      };
    } catch (error) {
      console.error('Create Zoho lead error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generic CRM sync method
  async syncContactToCRM(crmType, connectionId, contactData) {
    switch (crmType) {
      case 'salesforce':
        return await this.createSalesforceLead(connectionId, contactData);
      case 'hubspot':
        return await this.createHubSpotContact(connectionId, contactData);
      case 'zoho':
        return await this.createZohoLead(connectionId, contactData);
      default:
        return {
          success: false,
          error: 'Unsupported CRM type'
        };
    }
  }

  // Disconnect CRM
  disconnectCRM(connectionId) {
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
        connected: true
      });
    }
    return connections;
  }
}

module.exports = new CRMService();