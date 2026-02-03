const { query } = require('../config/database');

class AgentNetwork {
  constructor(data) {
    this.id = data.id;
    this.agentId = data.agent_id;
    this.connectedAgentId = data.connected_agent_id;
    this.connectionType = data.connection_type || 'professional';
    this.status = data.status || 'pending';
    this.trustLevel = data.trust_level || 1;
    this.sharedLeadsCount = data.shared_leads_count || 0;
    this.successfulDealsCount = data.successful_deals_count || 0;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a connection request
  static async createConnection(agentId, connectedAgentId, connectionType = 'professional', notes = null) {
    // Check if connection already exists
    const existing = await query(
      `SELECT id FROM agent_network
       WHERE ((agent_id = $1 AND connected_agent_id = $2) OR (agent_id = $2 AND connected_agent_id = $1))
       AND status != 'blocked'`,
      [agentId, connectedAgentId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Connection already exists between these agents');
    }

    const queryText = `
      INSERT INTO agent_network (
        agent_id, connected_agent_id, connection_type, notes
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(queryText, [agentId, connectedAgentId, connectionType, notes]);
    return new AgentNetwork(result.rows[0]);
  }

  // Accept connection request
  static async acceptConnection(agentId, connectionId) {
    const connection = await AgentNetwork.findById(connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.connectedAgentId !== agentId) {
      throw new Error('Unauthorized to accept this connection');
    }

    if (connection.status !== 'pending') {
      throw new Error('Connection is not in pending status');
    }

    await query(
      'UPDATE agent_network SET status = $1, updated_at = NOW() WHERE id = $2',
      ['connected', connectionId]
    );

    connection.status = 'connected';
    return connection;
  }

  // Find connection by ID
  static async findById(id) {
    const result = await query('SELECT * FROM agent_network WHERE id = $1', [id]);
    return result.rows.length > 0 ? new AgentNetwork(result.rows[0]) : null;
  }

  // Get agent's network
  static async getNetwork(agentId, status = 'connected', limit = 50, offset = 0) {
    const queryText = `
      SELECT an.*,
             a.name as connected_agent_name,
             a.business_name,
             a.location,
             a.specializations,
             a.trust_score,
             a.total_deals
      FROM agent_network an
      JOIN agents a ON an.connected_agent_id = a.id
      WHERE an.agent_id = $1 AND an.status = $2
      ORDER BY an.trust_level DESC, an.updated_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await query(queryText, [agentId, status, limit, offset]);
    return result.rows.map(row => new AgentNetwork(row));
  }

  // Get connection requests (pending connections where agent is the target)
  static async getConnectionRequests(agentId, limit = 50, offset = 0) {
    const queryText = `
      SELECT an.*,
             a.name as requesting_agent_name,
             a.business_name,
             a.location,
             a.specializations,
             a.trust_score
      FROM agent_network an
      JOIN agents a ON an.agent_id = a.id
      WHERE an.connected_agent_id = $1 AND an.status = 'pending'
      ORDER BY an.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(queryText, [agentId, limit, offset]);
    return result.rows.map(row => ({
      ...row,
      connectionId: row.id
    }));
  }

  // Search agents for networking
  static async searchAgents(searchTerm, agentId, location = null, specializations = null, limit = 20) {
    let queryText = `
      SELECT id, name, business_name, location, specializations,
             trust_score, total_deals, experience_years
      FROM agents
      WHERE id != $1 AND is_active = true
    `;
    const values = [agentId];

    if (searchTerm) {
      queryText += ` AND (name ILIKE $2 OR business_name ILIKE $2 OR location ILIKE $2)`;
      values.push(`%${searchTerm}%`);
    }

    if (location) {
      queryText += ` AND location ILIKE $${values.length + 1}`;
      values.push(`%${location}%`);
    }

    if (specializations && specializations.length > 0) {
      queryText += ` AND specializations && $${values.length + 1}`;
      values.push(specializations);
    }

    queryText += ` ORDER BY trust_score DESC, total_deals DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await query(queryText, values);
    return result.rows;
  }

  // Update trust level based on collaboration success
  static async updateTrustLevel(agentId, connectedAgentId, success = true) {
    const connections = await query(
      `SELECT id FROM agent_network
       WHERE ((agent_id = $1 AND connected_agent_id = $2) OR (agent_id = $2 AND connected_agent_id = $1))
       AND status = 'connected'`,
      [agentId, connectedAgentId]
    );

    if (connections.rows.length === 0) return;

    const increment = success ? 1 : -1;
    await query(
      `UPDATE agent_network
       SET trust_level = GREATEST(1, LEAST(5, trust_level + $1)),
           updated_at = NOW()
       WHERE id = $2`,
      [increment, connections.rows[0].id]
    );
  }

  // Get network statistics
  static async getNetworkStats(agentId) {
    const queryText = `
      SELECT
        COUNT(CASE WHEN status = 'connected' THEN 1 END) as total_connections,
        AVG(trust_level) as avg_trust_level,
        SUM(shared_leads_count) as total_shared_leads,
        SUM(successful_deals_count) as total_successful_deals,
        COUNT(CASE WHEN status = 'pending' AND connected_agent_id = $1 THEN 1 END) as pending_requests
      FROM agent_network
      WHERE agent_id = $1 OR connected_agent_id = $1
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }

  // Block connection
  static async blockConnection(agentId, connectedAgentId) {
    await query(
      `UPDATE agent_network
       SET status = 'blocked', updated_at = NOW()
       WHERE ((agent_id = $1 AND connected_agent_id = $2) OR (agent_id = $2 AND connected_agent_id = $1))`,
      [agentId, connectedAgentId]
    );
  }

  // Remove connection
  static async removeConnection(agentId, connectedAgentId) {
    await query(
      `DELETE FROM agent_network
       WHERE ((agent_id = $1 AND connected_agent_id = $2) OR (agent_id = $2 AND connected_agent_id = $1))`,
      [agentId, connectedAgentId]
    );
  }

  // Get mutual connections
  static async getMutualConnections(agentId, otherAgentId) {
    const queryText = `
      SELECT COUNT(*) as mutual_count
      FROM agent_network an1
      JOIN agent_network an2 ON an1.connected_agent_id = an2.connected_agent_id
      WHERE an1.agent_id = $1
        AND an2.agent_id = $2
        AND an1.status = 'connected'
        AND an2.status = 'connected'
        AND an1.connected_agent_id != $2
    `;

    const result = await query(queryText, [agentId, otherAgentId]);
    return result.rows[0].mutual_count;
  }

  // Recommend agents based on network and activity
  static async getRecommendations(agentId, limit = 10) {
    // Find agents connected to agent's connections (second-degree connections)
    const queryText = `
      WITH first_degree AS (
        SELECT connected_agent_id
        FROM agent_network
        WHERE agent_id = $1 AND status = 'connected'
      ),
      second_degree AS (
        SELECT DISTINCT an.connected_agent_id
        FROM agent_network an
        JOIN first_degree fd ON an.agent_id = fd.connected_agent_id
        WHERE an.status = 'connected'
          AND an.connected_agent_id != $1
          AND an.connected_agent_id NOT IN (
            SELECT connected_agent_id FROM agent_network
            WHERE agent_id = $1
          )
      )
      SELECT a.id, a.name, a.business_name, a.location,
             a.specializations, a.trust_score, a.total_deals,
             COUNT(*) as common_connections
      FROM agents a
      JOIN second_degree sd ON a.id = sd.connected_agent_id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.business_name, a.location,
               a.specializations, a.trust_score, a.total_deals
      ORDER BY common_connections DESC, a.trust_score DESC
      LIMIT $2
    `;

    const result = await query(queryText, [agentId, limit]);
    return result.rows;
  }
}

module.exports = AgentNetwork;