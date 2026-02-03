const { query } = require('../config/database');

class Collaboration {
  constructor(data) {
    this.id = data.id;
    this.leadId = data.lead_id;
    this.primaryAgent = data.primary_agent;
    this.collaboratingAgent = data.collaborating_agent;
    this.collaborationType = data.collaboration_type || 'referral';
    this.status = data.status || 'pending';
    this.commissionSplit = data.commission_split || 0;
    this.dealValue = data.deal_value;
    this.dealStatus = data.deal_status;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new collaboration
  static async create(collaborationData) {
    const {
      leadId,
      primaryAgent,
      collaboratingAgent,
      collaborationType,
      commissionSplit,
      notes
    } = collaborationData;

    const queryText = `
      INSERT INTO collaborations (
        lead_id, primary_agent, collaborating_agent,
        collaboration_type, commission_split, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      leadId, primaryAgent, collaboratingAgent,
      collaborationType, commissionSplit, notes
    ];

    try {
      const result = await query(queryText, values);
      return new Collaboration(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating collaboration: ${error.message}`);
    }
  }

  // Find collaboration by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM collaborations WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Collaboration(result.rows[0]);
  }

  // Find collaborations for an agent (as primary or collaborating)
  static async findByAgent(agentId, status = null, limit = 50, offset = 0) {
    let queryText = `
      SELECT c.*,
             l.name as lead_name, l.phone as lead_phone,
             pa.name as primary_agent_name,
             ca.name as collaborating_agent_name
      FROM collaborations c
      JOIN leads l ON c.lead_id = l.id
      JOIN agents pa ON c.primary_agent = pa.id
      JOIN agents ca ON c.collaborating_agent = ca.id
      WHERE c.primary_agent = $1 OR c.collaborating_agent = $1
    `;
    const values = [agentId];

    if (status) {
      queryText += ' AND c.status = $2';
      values.push(status);
    }

    queryText += ' ORDER BY c.created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Collaboration(row));
  }

  // Find collaborations for a specific lead
  static async findByLead(leadId) {
    const queryText = `
      SELECT c.*,
             pa.name as primary_agent_name,
             ca.name as collaborating_agent_name
      FROM collaborations c
      JOIN agents pa ON c.primary_agent = pa.id
      JOIN agents ca ON c.collaborating_agent = ca.id
      WHERE c.lead_id = $1
      ORDER BY c.created_at DESC
    `;

    const result = await query(queryText, [leadId]);
    return result.rows.map(row => new Collaboration(row));
  }

  // Update collaboration
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id);

    const queryText = `
      UPDATE collaborations
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Update status
  async updateStatus(status, dealValue = null, dealStatus = null) {
    const updateData = { status };

    if (dealValue !== null) updateData.dealValue = dealValue;
    if (dealStatus !== null) updateData.dealStatus = dealStatus;

    return this.update(updateData);
  }

  // Accept collaboration invitation
  async accept() {
    return this.updateStatus('active');
  }

  // Decline collaboration invitation
  async decline() {
    return this.updateStatus('cancelled');
  }

  // Mark collaboration as completed
  async complete(dealValue, dealStatus = 'won') {
    return this.updateStatus('completed', dealValue, dealStatus);
  }

  // Calculate commission for each agent
  calculateCommission() {
    if (!this.dealValue || this.status !== 'completed') {
      return { primaryCommission: 0, collaboratingCommission: 0 };
    }

    const collaboratingCommission = (this.dealValue * this.commissionSplit) / 100;
    const primaryCommission = this.dealValue - collaboratingCommission;

    return {
      primaryCommission,
      collaboratingCommission,
      totalCommission: this.dealValue
    };
  }

  // Delete collaboration
  async delete() {
    const queryText = 'DELETE FROM collaborations WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get collaboration statistics for agent
  static async getStatsForAgent(agentId) {
    const queryText = `
      SELECT
        COUNT(*) as total_collaborations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_collaborations,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_collaborations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invitations,
        SUM(CASE WHEN status = 'completed' THEN deal_value ELSE 0 END) as total_deal_value,
        AVG(CASE WHEN status = 'completed' THEN commission_split ELSE NULL END) as avg_commission_split,
        SUM(CASE WHEN status = 'completed' THEN (deal_value * commission_split / 100) ELSE 0 END) as total_earned_commission
      FROM collaborations
      WHERE primary_agent = $1 OR collaborating_agent = $1
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }

  // Get network statistics (agents this agent has collaborated with)
  static async getNetworkStats(agentId) {
    const queryText = `
      SELECT
        COUNT(DISTINCT CASE WHEN primary_agent = $1 THEN collaborating_agent ELSE primary_agent END) as network_size,
        COUNT(DISTINCT CASE WHEN collaboration_type = 'referral' THEN 1 END) as referral_count,
        COUNT(DISTINCT CASE WHEN collaboration_type = 'co_broking' THEN 1 END) as co_broking_count,
        COUNT(DISTINCT CASE WHEN collaboration_type = 'joint_venture' THEN 1 END) as joint_venture_count
      FROM collaborations
      WHERE (primary_agent = $1 OR collaborating_agent = $1) AND status = 'completed'
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }
}

module.exports = Collaboration;