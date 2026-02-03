const { query } = require('../config/database');

class Subscription {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.planId = data.plan_id;
    this.status = data.status; // active, cancelled, expired, suspended
    this.currentPeriodStart = data.current_period_start;
    this.currentPeriodEnd = data.current_period_end;
    this.cancelAtPeriodEnd = data.cancel_at_period_end;
    this.stripeSubscriptionId = data.stripe_subscription_id;
    this.razorpaySubscriptionId = data.razorpay_subscription_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(subscriptionData) {
    const {
      organizationId,
      planId,
      status = 'active',
      currentPeriodStart = new Date(),
      currentPeriodEnd,
      cancelAtPeriodEnd = false,
      stripeSubscriptionId,
      razorpaySubscriptionId
    } = subscriptionData;

    const queryText = `
      INSERT INTO subscriptions (
        organization_id, plan_id, status, current_period_start, current_period_end,
        cancel_at_period_end, stripe_subscription_id, razorpay_subscription_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      organizationId,
      planId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      stripeSubscriptionId || null,
      razorpaySubscriptionId || null
    ];

    const result = await query(queryText, values);
    return new Subscription(result.rows[0]);
  }

  static async findByOrganizationId(organizationId) {
    const queryText = 'SELECT * FROM subscriptions WHERE organization_id = $1 ORDER BY created_at DESC';
    const result = await query(queryText, [organizationId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows.map(row => new Subscription(row));
  }

  static async findActiveByOrganizationId(organizationId) {
    const queryText = `
      SELECT s.*, sp.name as plan_name, sp.tier as plan_tier, sp.price_monthly, sp.price_yearly, sp.features as plan_features
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.organization_id = $1 AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    const result = await query(queryText, [organizationId]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Subscription(result.rows[0]);
  }

  static async findById(id) {
    const queryText = 'SELECT * FROM subscriptions WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Subscription(result.rows[0]);
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
      UPDATE subscriptions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    values.push(this.id);

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
  }

  async cancel() {
    await this.update({
      status: 'cancelled',
      cancelAtPeriodEnd: true
    });
  }

  async renew(currentPeriodEnd) {
    await this.update({
      currentPeriodEnd,
      status: 'active'
    });
  }

  isActive() {
    return this.status === 'active' &&
      (this.currentPeriodEnd === null || new Date(this.currentPeriodEnd) > new Date());
  }

  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      planId: this.planId,
      status: this.status,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      stripeSubscriptionId: this.stripeSubscriptionId,
      razorpaySubscriptionId: this.razorpaySubscriptionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Subscription;