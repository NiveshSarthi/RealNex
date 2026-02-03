const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.phone = data.phone;
    this.password = data.password;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.role = data.role || 'user';
    this.organizationId = data.organization_id;
    this.subscriptionTier = data.subscription_tier || 'starter';
    this.isActive = data.is_active !== false;
    this.emailVerified = data.email_verified || false;
    this.phoneVerified = data.phone_verified || false;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new user
  static async create(userData) {
    const { email, phone, password, firstName, lastName, organizationId } = userData;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const queryText = `
      INSERT INTO users (email, phone, password, first_name, last_name, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [email, phone, hashedPassword, firstName, lastName, organizationId];

    try {
      const result = await query(queryText, values);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('User creation failed: No data returned from database. Please check your database connection.');
      }

      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Find user by email (case-insensitive)
  static async findByEmail(email) {
    const queryText = 'SELECT * FROM users WHERE email ILIKE $1';
    const result = await query(queryText, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  static async findByPhone(phone) {
    const queryText = 'SELECT * FROM users WHERE phone = $1';
    const result = await query(queryText, [phone]);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  // Find user by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM users WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  // Verify password
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Generate JWT token
  generateToken() {
    return jwt.sign(
      {
        id: this.id,
        email: this.email,
        role: this.role,
        organizationId: this.organizationId,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
  }

  // Update user
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
      throw new Error('No fields to update');
    }

    values.push(this.id); // Add ID at the end

    const queryText = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Delete user
  async delete() {
    const queryText = 'DELETE FROM users WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get user profile (without password)
  toProfile() {
    const { password, ...profile } = this;
    return profile;
  }
}

module.exports = User;