const { query } = require('../config/database');

class Campaign {
  constructor(data) {
    this.id = data.id;
    this.agentId = data.agent_id;
    this.name = data.name;
    this.description = data.description;
    this.campaignType = data.campaign_type || 'bulk';
    this.status = data.status || 'draft';
    this.targetAudience = data.target_audience;
    this.messageTemplate = data.message_template;
    this.scheduledAt = data.scheduled_at;
    this.completedAt = data.completed_at;
    this.totalRecipients = data.total_recipients || 0;
    this.sentCount = data.sent_count || 0;
    this.deliveredCount = data.delivered_count || 0;
    this.readCount = data.read_count || 0;
    this.responseCount = data.response_count || 0;
    this.conversionCount = data.conversion_count || 0;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;

    // A/B Testing fields
    this.isABTest = data.is_ab_test || false;
    this.testPercentage = data.test_percentage || 50;
    this.variants = data.variants || [];
  }

  // Create a new campaign
  static async create(campaignData) {
    const {
      agentId,
      name,
      description,
      campaignType,
      status,
      targetAudience,
      messageTemplate,
      scheduledAt,
      isABTest,
      testPercentage,
      variants
    } = campaignData;

    const queryText = `
      INSERT INTO campaigns (
        agent_id, name, description, campaign_type, status,
        target_audience, message_template, scheduled_at,
        is_ab_test, test_percentage, variants
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      agentId, name, description, campaignType, status,
      JSON.stringify(targetAudience), messageTemplate, scheduledAt,
      isABTest || false, testPercentage || 50, JSON.stringify(variants || [])
    ];

    try {
      const result = await query(queryText, values);
      return new Campaign(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating campaign: ${error.message}`);
    }
  }

  // Find campaign by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM campaigns WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Campaign(result.rows[0]);
  }

  // Find campaigns by agent
  static async findByAgent(agentId, status = null, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM campaigns WHERE agent_id = $1';
    const values = [agentId];

    if (status) {
      queryText += ' AND status = $2';
      values.push(status);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Campaign(row));
  }

  // Update campaign
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'targetAudience' || key === 'variants') {
          fields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          fields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ${paramCount}`);
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id);

    const queryText = `
      UPDATE campaigns
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Update status
  async updateStatus(status) {
    const updateData = { status };

    if (status === 'completed') {
      updateData.completed_at = new Date();
    }

    return this.update(updateData);
  }

  // Update statistics
  async updateStats(sent = 0, delivered = 0, read = 0, response = 0, conversion = 0) {
    return this.update({
      sent_count: this.sentCount + sent,
      delivered_count: this.deliveredCount + delivered,
      read_count: this.readCount + read,
      response_count: this.responseCount + response,
      conversion_count: this.conversionCount + conversion
    });
  }

  // Get target audience (leads matching criteria)
  async getTargetAudience(limit = 1000) {
    const audience = this.targetAudience || {};
    let queryText = 'SELECT id, phone, name FROM leads WHERE 1=1';
    const values = [];

    // Build WHERE clause based on audience filters
    if (audience.location) {
      queryText += ' AND location ILIKE $1';
      values.push(`%${audience.location}%`);
    }

    if (audience.budgetMin) {
      queryText += ` AND budget_min >= $${values.length + 1}`;
      values.push(audience.budgetMin);
    }

    if (audience.budgetMax) {
      queryText += ` AND budget_max <= $${values.length + 1}`;
      values.push(audience.budgetMax);
    }

    if (audience.propertyType) {
      queryText += ` AND property_type = $${values.length + 1}`;
      values.push(audience.propertyType);
    }

    if (audience.leadScore) {
      queryText += ` AND lead_score >= $${values.length + 1}`;
      values.push(audience.leadScore);
    }

    if (audience.tags && audience.tags.length > 0) {
      queryText += ` AND tags && $${values.length + 1}`;
      values.push(audience.tags);
    }

    // Only active leads
    queryText += ` AND status NOT IN ('lost', 'closed')`;

    // Limit results
    queryText += ` LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await query(queryText, values);
    return result.rows;
  }

  // Calculate audience size
  async getAudienceSize() {
    const audience = this.targetAudience || {};
    let queryText = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
    const values = [];

    // Same filters as getTargetAudience
    if (audience.location) {
      queryText += ' AND location ILIKE $1';
      values.push(`%${audience.location}%`);
    }

    if (audience.budgetMin) {
      queryText += ` AND budget_min >= $${values.length + 1}`;
      values.push(audience.budgetMin);
    }

    if (audience.budgetMax) {
      queryText += ` AND budget_max <= $${values.length + 1}`;
      values.push(audience.budgetMax);
    }

    if (audience.propertyType) {
      queryText += ` AND property_type = $${values.length + 1}`;
      values.push(audience.propertyType);
    }

    if (audience.leadScore) {
      queryText += ` AND lead_score >= $${values.length + 1}`;
      values.push(audience.leadScore);
    }

    if (audience.tags && audience.tags.length > 0) {
      queryText += ` AND tags && $${values.length + 1}`;
      values.push(audience.tags);
    }

    queryText += ` AND status NOT IN ('lost', 'closed')`;

    const result = await query(queryText, values);
    return result.rows[0].count;
  }

  // Execute campaign
  async execute() {
    try {
      // Get target audience
      const recipients = await this.getTargetAudience();

      if (recipients.length === 0) {
        throw new Error('No recipients found matching target audience criteria');
      }

      // Update campaign with recipient count
      await this.update({ total_recipients: recipients.length, status: 'running' });

      let results = [];

      if (this.isABTest && this.variants && this.variants.length > 0) {
        // A/B Testing execution
        results = await this.executeABTest(recipients);
      } else {
        // Regular campaign execution
        const whatsappService = require('../services/whatsapp');
        results = await whatsappService.sendBulkMessages(
          recipients.map(r => ({ id: r.id, phone: r.phone })),
          this.messageTemplate
        );
      }

      // Update statistics
      const sent = results.filter(r => r.success).length;
      await this.updateStats(sent, 0, 0, 0, 0);
      await this.updateStatus('completed');

      return {
        success: true,
        totalRecipients: recipients.length,
        sentCount: sent,
        failedCount: results.length - sent,
        results,
        isABTest: this.isABTest
      };
    } catch (error) {
      await this.updateStatus('failed');
      throw error;
    }
  }

  // Execute A/B test campaign
  async executeABTest(recipients) {
    const whatsappService = require('../services/whatsapp');
    const results = [];

    // Shuffle recipients for random assignment
    const shuffledRecipients = [...recipients].sort(() => Math.random() - 0.5);

    // Calculate test group size
    const testGroupSize = Math.floor((this.testPercentage / 100) * shuffledRecipients.length);
    const controlGroupSize = shuffledRecipients.length - testGroupSize;

    // Split into control and test groups
    const controlGroup = shuffledRecipients.slice(0, controlGroupSize);
    const testGroup = shuffledRecipients.slice(controlGroupSize);

    // Send control group messages (original template)
    if (controlGroup.length > 0) {
      const controlResults = await whatsappService.sendBulkMessages(
        controlGroup.map(r => ({ id: r.id, phone: r.phone })),
        this.messageTemplate,
        null, // templateName
        this.id, // campaignId
        'control', // variant
        'Control' // variantName
      );

      // Mark results as control variant
      controlResults.forEach(result => {
        result.variant = 'control';
        results.push(result);
      });
    }

    // Send test group messages (variants)
    if (testGroup.length > 0 && this.variants.length > 0) {
      // Distribute test group across variants
      const variantSize = Math.floor(testGroup.length / this.variants.length);
      let remaining = testGroup.length % this.variants.length;

      for (let i = 0; i < this.variants.length; i++) {
        const variantRecipients = testGroup.slice(
          i * variantSize + Math.min(i, remaining),
          (i + 1) * variantSize + Math.min(i + 1, remaining)
        );

        if (variantRecipients.length > 0) {
          const variantResults = await whatsappService.sendBulkMessages(
            variantRecipients.map(r => ({ id: r.id, phone: r.phone })),
            this.variants[i].messageTemplate,
            null, // templateName
            this.id, // campaignId
            `variant_${i + 1}`, // variant
            this.variants[i].name // variantName
          );

          // Mark results with variant info
          variantResults.forEach(result => {
            result.variant = `variant_${i + 1}`;
            result.variantName = this.variants[i].name;
            results.push(result);
          });
        }
      }
    }

    return results;
  }

  // Get campaign performance metrics
  getPerformanceMetrics() {
    const metrics = {
      totalRecipients: this.totalRecipients,
      sentCount: this.sentCount,
      deliveredCount: this.deliveredCount,
      readCount: this.readCount,
      responseCount: this.responseCount,
      conversionCount: this.conversionCount
    };

    // Calculate rates
    metrics.deliveryRate = this.sentCount > 0 ? (this.deliveredCount / this.sentCount) * 100 : 0;
    metrics.readRate = this.sentCount > 0 ? (this.readCount / this.sentCount) * 100 : 0;
    metrics.responseRate = this.sentCount > 0 ? (this.responseCount / this.sentCount) * 100 : 0;
    metrics.conversionRate = this.sentCount > 0 ? (this.conversionCount / this.sentCount) * 100 : 0;

    return metrics;
  }

  // Delete campaign
  async delete() {
    const queryText = 'DELETE FROM campaigns WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get A/B test results
  async getABTestResults() {
    if (!this.isABTest) {
      throw new Error('This campaign is not an A/B test');
    }

    const queryText = `
      SELECT
        cm.variant,
        cm.variant_name,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN cm.status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN cm.status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN cm.status = 'responded' THEN 1 END) as responses,
        COUNT(CASE WHEN cm.conversion = true THEN 1 END) as conversions
      FROM campaign_messages cm
      WHERE cm.campaign_id = $1
      GROUP BY cm.variant, cm.variant_name
      ORDER BY cm.variant
    `;

    const result = await query(queryText, [this.id]);
    const variants = result.rows;

    // Calculate rates for each variant
    variants.forEach(variant => {
      variant.deliveryRate = variant.total_sent > 0 ? (variant.delivered / variant.total_sent) * 100 : 0;
      variant.readRate = variant.total_sent > 0 ? (variant.read / variant.total_sent) * 100 : 0;
      variant.responseRate = variant.total_sent > 0 ? (variant.responses / variant.total_sent) * 100 : 0;
      variant.conversionRate = variant.total_sent > 0 ? (variant.conversions / variant.total_sent) * 100 : 0;
    });

    return {
      campaignId: this.id,
      campaignName: this.name,
      testPercentage: this.testPercentage,
      variants: variants,
      controlVariant: variants.find(v => v.variant === 'control'),
      testVariants: variants.filter(v => v.variant !== 'control')
    };
  }

  // Validate A/B test configuration
  validateABTest() {
    if (!this.isABTest) return { isValid: true };

    const errors = [];

    if (!this.variants || this.variants.length === 0) {
      errors.push('A/B test must have at least one variant');
    }

    if (this.testPercentage < 10 || this.testPercentage > 90) {
      errors.push('Test percentage must be between 10% and 90%');
    }

    this.variants.forEach((variant, index) => {
      if (!variant.name || !variant.messageTemplate) {
        errors.push(`Variant ${index + 1} must have a name and message template`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get campaign statistics for agent
  static async getStatsForAgent(agentId) {
    const queryText = `
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_campaigns,
        SUM(total_recipients) as total_recipients,
        SUM(sent_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(read_count) as total_read,
        SUM(response_count) as total_responses,
        SUM(conversion_count) as total_conversions,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(response_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_response_rate,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(conversion_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_conversion_rate
      FROM campaigns
      WHERE agent_id = $1
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }
}

module.exports = Campaign;