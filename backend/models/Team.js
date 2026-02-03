const { query } = require('../config/database');

class Team {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.name = data.name;
    this.description = data.description;
    this.leaderId = data.leader_id;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(teamData) {
    const { organizationId, name, description, leaderId } = teamData;

    const queryText = `
      INSERT INTO teams (organization_id, name, description, leader_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const values = [organizationId, name, description, leaderId];
    const result = await query(queryText, values);

    return new Team(result.rows[0]);
  }

  static async findById(id) {
    const queryText = 'SELECT * FROM teams WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Team(result.rows[0]);
  }

  static async findByOrganizationId(organizationId) {
    const queryText = 'SELECT * FROM teams WHERE organization_id = $1 AND is_active = true ORDER BY name';
    const result = await query(queryText, [organizationId]);

    return result.rows.map(row => new Team(row));
  }

  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = NOW()');

    const queryText = `
      UPDATE teams
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    values.push(this.id);

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
  }

  async delete() {
    // Soft delete by setting is_active to false
    await this.update({ isActive: false });
  }

  async addMember(userId, role = 'member') {
    const queryText = `
      INSERT INTO team_members (team_id, user_id, role, joined_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3
    `;

    await query(queryText, [this.id, userId, role]);
  }

  async removeMember(userId) {
    const queryText = 'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2';
    await query(queryText, [this.id, userId]);
  }

  async getMembers() {
    const queryText = `
      SELECT tm.*, u.first_name, u.last_name, u.email, u.role as user_role
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at
    `;

    const result = await query(queryText, [this.id]);
    return result.rows;
  }

  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      description: this.description,
      leaderId: this.leaderId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Team;