const { query } = require('../config/database');

class DripSequence {
  constructor(data) {
    this.id = data.id;
    this.agentId = data.agent_id;
    this.name = data.name;
    this.description = data.description;
    this.triggerEvent = data.trigger_event;
    this.isActive = data.is_active || false;
    this.steps = data.steps || [];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new drip sequence
  static async create(sequenceData) {
    const {
      agentId,
      name,
      description,
      triggerEvent,
      isActive,
      steps
    } = sequenceData;

    const queryText = `
      INSERT INTO drip_sequences (
        agent_id, name, description, trigger_event, is_active, steps
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      agentId, name, description, triggerEvent, isActive || false, JSON.stringify(steps || [])
    ];

    try {
      const result = await query(queryText, values);
      return new DripSequence(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating drip sequence: ${error.message}`);
    }
  }

  // Find drip sequence by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM drip_sequences WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new DripSequence(result.rows[0]);
  }

  // Find drip sequences by agent
  static async findByAgent(agentId, activeOnly = false, limit = 50, offset = 0) {
    let queryText = 'SELECT * FROM drip_sequences WHERE agent_id = $1';
    const values = [agentId];

    if (activeOnly) {
      queryText += ' AND is_active = true';
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new DripSequence(row));
  }

  // Find sequences by trigger event
  static async findByTriggerEvent(triggerEvent, agentId = null) {
    let queryText = 'SELECT * FROM drip_sequences WHERE trigger_event = $1 AND is_active = true';
    const values = [triggerEvent];

    if (agentId) {
      queryText += ' AND agent_id = $2';
      values.push(agentId);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, values);
    return result.rows.map(row => new DripSequence(row));
  }

  // Update drip sequence
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'steps') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
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

    values.push(this.id);

    const queryText = `
      UPDATE drip_sequences
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Activate/deactivate sequence
  async setActive(active) {
    return this.update({ is_active: active });
  }

  // Add a step to the sequence
  async addStep(step) {
    const updatedSteps = [...this.steps, step];
    return this.update({ steps: updatedSteps });
  }

  // Update a step in the sequence
  async updateStep(stepIndex, stepData) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error('Invalid step index');
    }

    const updatedSteps = [...this.steps];
    updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...stepData };

    return this.update({ steps: updatedSteps });
  }

  // Remove a step from the sequence
  async removeStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error('Invalid step index');
    }

    const updatedSteps = this.steps.filter((_, index) => index !== stepIndex);
    return this.update({ steps: updatedSteps });
  }

  // Process sequence for a lead
  async processForLead(leadId, leadData = {}) {
    try {
      const sequenceExecutions = [];

      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        const executionTime = this.calculateExecutionTime(i, leadData);

        // Schedule the step execution
        sequenceExecutions.push({
          stepIndex: i,
          step: step,
          scheduledFor: executionTime,
          leadId: leadId
        });

        // In a real implementation, you would queue this for execution
        // For now, we'll just log it
        console.log(`📅 Scheduled step ${i + 1} for lead ${leadId} at ${executionTime}`);
      }

      return {
        success: true,
        sequenceId: this.id,
        leadId: leadId,
        executions: sequenceExecutions
      };
    } catch (error) {
      console.error('Error processing sequence for lead:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate execution time for a step
  calculateExecutionTime(stepIndex, leadData = {}) {
    const step = this.steps[stepIndex];
    if (!step) return null;

    let baseTime = new Date();

    // If this is not the first step, calculate from previous step
    if (stepIndex > 0) {
      const prevStep = this.steps[stepIndex - 1];
      baseTime = this.calculateExecutionTime(stepIndex - 1, leadData);
    }

    // Add delay for current step
    if (step.delay) {
      const delayMs = this.parseDelay(step.delay);
      baseTime = new Date(baseTime.getTime() + delayMs);
    }

    return baseTime;
  }

  // Parse delay string (e.g., "2 hours", "1 day", "30 minutes")
  parseDelay(delayString) {
    const delayRegex = /^(\d+)\s*(second|minute|hour|day)s?$/i;
    const match = delayString.match(delayRegex);

    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || 0);
  }

  // Validate sequence steps
  validateSteps() {
    if (!this.steps || this.steps.length === 0) {
      return { isValid: false, error: 'Sequence must have at least one step' };
    }

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];

      if (!step.messageTemplate && !step.templateId) {
        return { isValid: false, error: `Step ${i + 1}: Message template or template ID is required` };
      }

      if (!step.delay && i > 0) {
        return { isValid: false, error: `Step ${i + 1}: Delay is required for steps after the first` };
      }
    }

    return { isValid: true };
  }

  // Get sequence statistics
  static async getStats(agentId = null) {
    let queryText = `
      SELECT
        COUNT(*) as total_sequences,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_sequences,
        COUNT(CASE WHEN trigger_event = 'lead_created' THEN 1 END) as lead_creation_sequences,
        COUNT(CASE WHEN trigger_event = 'message_received' THEN 1 END) as message_response_sequences,
        AVG(array_length(steps, 1)) as avg_steps_per_sequence
      FROM drip_sequences
    `;

    const values = [];
    if (agentId) {
      queryText += ' WHERE agent_id = $1';
      values.push(agentId);
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Delete drip sequence
  async delete() {
    const queryText = 'DELETE FROM drip_sequences WHERE id = $1';
    await query(queryText, [this.id]);
  }

  // Get sequence preview
  getPreview(leadData = {}) {
    const preview = {
      id: this.id,
      name: this.name,
      triggerEvent: this.triggerEvent,
      isActive: this.isActive,
      steps: []
    };

    this.steps.forEach((step, index) => {
      const executionTime = this.calculateExecutionTime(index, leadData);
      preview.steps.push({
        stepNumber: index + 1,
        delay: step.delay,
        scheduledFor: executionTime,
        messageTemplate: step.messageTemplate,
        templateId: step.templateId
      });
    });

    return preview;
  }
}

module.exports = DripSequence;