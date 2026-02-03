const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class Agent {
  constructor(data) {
    this.id = data.id;
    this.whatsappNumber = data.whatsapp_number;
    this.name = data.name;
    this.email = data.email;
    this.businessName = data.business_name;
    this.location = data.location;
    this.experienceYears = data.experience_years;
    this.specializations = data.specializations || [];
    this.subscriptionTier = data.subscription_tier || 'starter';
    this.subscriptionStatus = data.subscription_status || 'trial';
    this.subscriptionStart = data.subscription_start;
    this.subscriptionEnd = data.subscription_end;
    this.isActive = data.is_active !== false;
    this.aadhaarVerified = data.aadhaar_verified || false;
    this.trustScore = data.trust_score || 0.00;
    this.totalDeals = data.total_deals || 0;
    this.totalCommission = data.total_commission || 0.00;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new agent
  static async create(agentData) {
    const {
      whatsappNumber,
      name,
      email,
      businessName,
      location,
      experienceYears,
      specializations
    } = agentData;

    // Hash WhatsApp number as password for simplicity (in production, use proper auth)
    const hashedPassword = await bcrypt.hash(whatsappNumber, 12);

    const queryText = `
      INSERT INTO agents (
        whatsapp_number, name, email, business_name, location,
        experience_years, specializations
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      whatsappNumber, name, email, businessName, location,
      experienceYears, specializations || []
    ];

    try {
      const result = await query(queryText, values);
      return new Agent(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating agent: ${error.message}`);
    }
  }

  // Find agent by WhatsApp number
  static async findByWhatsApp(whatsappNumber) {
    const queryText = 'SELECT * FROM agents WHERE whatsapp_number = $1';
    const result = await query(queryText, [whatsappNumber]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Agent(result.rows[0]);
  }

  // Find agent by email
  static async findByEmail(email) {
    const queryText = 'SELECT * FROM agents WHERE email = $1';
    const result = await query(queryText, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Agent(result.rows[0]);
  }

  // Find agent by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM agents WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Agent(result.rows[0]);
  }

  // Find agents by location
  static async findByLocation(location, limit = 50) {
    const queryText = `
      SELECT * FROM agents
      WHERE location ILIKE $1 AND is_active = true
      ORDER BY trust_score DESC, total_deals DESC
      LIMIT $2
    `;
    const result = await query(queryText, [`%${location}%`, limit]);

    return result.rows.map(row => new Agent(row));
  }

  // Find agents by specialization
  static async findBySpecialization(specialization, location = null, limit = 50) {
    let queryText = `
      SELECT * FROM agents
      WHERE $1 = ANY(specializations) AND is_active = true
    `;
    const values = [specialization];

    if (location) {
      queryText += ' AND location ILIKE $2';
      values.push(`%${location}%`);
    }

    queryText += ' ORDER BY trust_score DESC, total_deals DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    const result = await query(queryText, values);
    return result.rows.map(row => new Agent(row));
  }

  // Verify password (WhatsApp number)
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.whatsappNumber);
  }

  // Generate JWT token
  generateToken() {
    return jwt.sign(
      {
        id: this.id,
        whatsappNumber: this.whatsappNumber,
        name: this.name,
        subscriptionTier: this.subscriptionTier
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
  }

  // Update agent profile
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (Array.isArray(updateData[key])) {
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE agents
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Update subscription
  async updateSubscription(tier, status, startDate = null, endDate = null) {
    const updateData = {
      subscription_tier: tier,
      subscription_status: status
    };

    if (startDate) updateData.subscription_start = startDate;
    if (endDate) updateData.subscription_end = endDate;

    return this.update(updateData);
  }

  // Update performance metrics
  async updatePerformance(deals = 0, commission = 0) {
    return this.update({
      total_deals: this.totalDeals + deals,
      total_commission: this.totalCommission + commission
    });
  }

  // Update trust score
  async updateTrustScore(score) {
    return this.update({ trust_score: Math.max(0, Math.min(5, score)) });
  }

  // Get agent statistics
  async getStats() {
    // Get leads count
    const leadsResult = await query(
      'SELECT COUNT(*) as total_leads FROM leads WHERE assigned_agent = $1',
      [this.id]
    );

    // Get properties count
    const propertiesResult = await query(
      'SELECT COUNT(*) as total_properties FROM properties WHERE agent_id = $1',
      [this.id]
    );

    // Get campaigns count
    const campaignsResult = await query(
      'SELECT COUNT(*) as total_campaigns FROM campaigns WHERE agent_id = $1',
      [this.id]
    );

    // Get collaborations count
    const collaborationsResult = await query(
      'SELECT COUNT(*) as collaborations FROM collaborations WHERE primary_agent = $1 OR collaborating_agent = $1',
      [this.id]
    );

    return {
      agentId: this.id,
      totalLeads: parseInt(leadsResult.rows[0].total_leads),
      totalProperties: parseInt(propertiesResult.rows[0].total_properties),
      totalCampaigns: parseInt(campaignsResult.rows[0].total_campaigns),
      totalCollaborations: parseInt(collaborationsResult.rows[0].collaborations),
      trustScore: this.trustScore,
      totalDeals: this.totalDeals,
      totalCommission: this.totalCommission,
      subscriptionTier: this.subscriptionTier,
      subscriptionStatus: this.subscriptionStatus
    };
  }

  // Get agent profile (without sensitive data)
  toProfile() {
    const { createdAt, updatedAt, ...profile } = this;
    return {
      ...profile,
      createdAt: this.createdAt,
      stats: null // Will be populated separately if needed
    };
  }

  // Delete agent
  async delete() {
    const queryText = 'DELETE FROM agents WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get subscription limits based on tier
  getSubscriptionLimits() {
    const limits = {
      starter: {
        leads: 100,
        properties: 50,
        campaigns: 5,
        messages: 500,
        collaborations: 5
      },
      professional: {
        leads: 1000,
        properties: 500,
        campaigns: 25,
        messages: 2000,
        collaborations: 25
      },
      enterprise: {
        leads: -1, // unlimited
        properties: -1,
        campaigns: -1,
        messages: -1,
        collaborations: -1
      }
    };

    return limits[this.subscriptionTier] || limits.starter;
  }

  // Check if agent can perform action based on subscription
  canPerformAction(action, currentCount = 0) {
    const limits = this.getSubscriptionLimits();

    switch (action) {
      case 'add_lead':
        return limits.leads === -1 || currentCount < limits.leads;
      case 'add_property':
        return limits.properties === -1 || currentCount < limits.properties;
      case 'create_campaign':
        return limits.campaigns === -1 || currentCount < limits.campaigns;
      case 'send_message':
        return limits.messages === -1 || currentCount < limits.messages;
      case 'add_collaboration':
        return limits.collaborations === -1 || currentCount < limits.collaborations;
      default:
        return true;
    }
  }
}

module.exports = Agent;