const { query } = require('../config/database');

class AdvancedAnalyticsService {
  // Predictive Analytics

  // Predict lead conversion probability
  async predictLeadConversion(leadData) {
    try {
      // Get historical conversion data
      const historicalData = await this.getHistoricalConversionData();

      // Calculate conversion probability based on multiple factors
      const probability = this.calculateConversionProbability(leadData, historicalData);

      // Get confidence score
      const confidence = this.calculateConfidenceScore(leadData);

      // Generate insights and recommendations
      const insights = this.generateConversionInsights(leadData, probability);

      return {
        leadId: leadData.id,
        conversionProbability: Math.round(probability * 100) / 100,
        confidenceScore: Math.round(confidence * 100) / 100,
        insights,
        factors: this.analyzeConversionFactors(leadData),
        recommendedActions: this.getRecommendedActions(leadData, probability)
      };
    } catch (error) {
      console.error('Error predicting lead conversion:', error);
      throw error;
    }
  }

  // Calculate conversion probability
  calculateConversionProbability(leadData, historicalData) {
    let probability = 0.15; // Base conversion rate

    // Budget factor
    if (leadData.budget && leadData.budget > 5000000) {
      probability += 0.1;
    }

    // Urgency factor
    if (leadData.timeline === 'immediate' || leadData.timeline === '1_month') {
      probability += 0.08;
    }

    // Source factor
    const sourceMultipliers = {
      'whatsapp': 1.2,
      'website': 1.0,
      'referral': 1.3,
      'meta_ads': 0.9
    };
    probability *= sourceMultipliers[leadData.source] || 1.0;

    // Engagement factor
    if (leadData.message_count > 5) {
      probability += 0.05;
    }

    // Location factor (premium areas)
    const premiumAreas = ['bandra', 'juhu', 'south mumbai', 'lower parel'];
    if (leadData.location && premiumAreas.some(area =>
      leadData.location.toLowerCase().includes(area))) {
      probability += 0.07;
    }

    return Math.min(probability, 0.85); // Cap at 85%
  }

  // Calculate confidence score
  calculateConfidenceScore(leadData) {
    let confidence = 0.5; // Base confidence

    // More data points increase confidence
    if (leadData.budget) confidence += 0.1;
    if (leadData.location) confidence += 0.1;
    if (leadData.timeline) confidence += 0.1;
    if (leadData.property_type) confidence += 0.1;
    if (leadData.message_count > 3) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  // Generate conversion insights
  generateConversionInsights(leadData, probability) {
    const insights = [];

    if (probability > 0.6) {
      insights.push({
        type: 'positive',
        message: 'High conversion potential - prioritize this lead',
        icon: '🔥'
      });
    } else if (probability > 0.3) {
      insights.push({
        type: 'neutral',
        message: 'Moderate conversion potential - nurture actively',
        icon: '📈'
      });
    } else {
      insights.push({
        type: 'warning',
        message: 'Low conversion potential - consider qualification',
        icon: '⚠️'
      });
    }

    // Budget insights
    if (leadData.budget > 10000000) {
      insights.push({
        type: 'info',
        message: 'High budget lead - focus on premium properties',
        icon: '💰'
      });
    }

    // Timeline insights
    if (leadData.timeline === 'immediate') {
      insights.push({
        type: 'urgent',
        message: 'Immediate timeline - schedule viewing ASAP',
        icon: '⏰'
      });
    }

    return insights;
  }

  // Analyze conversion factors
  analyzeConversionFactors(leadData) {
    return {
      budget_score: leadData.budget ? Math.min(leadData.budget / 10000000, 1) : 0,
      urgency_score: this.getUrgencyScore(leadData.timeline),
      engagement_score: Math.min(leadData.message_count / 10, 1),
      location_score: this.getLocationScore(leadData.location),
      source_score: this.getSourceScore(leadData.source)
    };
  }

  // Get recommended actions
  getRecommendedActions(leadData, probability) {
    const actions = [];

    if (probability > 0.6) {
      actions.push({
        action: 'schedule_viewing',
        priority: 'high',
        description: 'Schedule property viewing within 24 hours'
      });
      actions.push({
        action: 'send_premium_properties',
        priority: 'high',
        description: 'Send curated list of premium properties'
      });
    } else if (probability > 0.3) {
      actions.push({
        action: 'send_market_report',
        priority: 'medium',
        description: 'Send personalized market report'
      });
      actions.push({
        action: 'follow_up_call',
        priority: 'medium',
        description: 'Schedule follow-up call in 2-3 days'
      });
    } else {
      actions.push({
        action: 'send_educational_content',
        priority: 'low',
        description: 'Send educational content about buying process'
      });
      actions.push({
        action: 'budget_clarification',
        priority: 'low',
        description: 'Ask for more details about budget and requirements'
      });
    }

    return actions;
  }

  // Helper methods
  getUrgencyScore(timeline) {
    const scores = {
      'immediate': 1.0,
      '1_month': 0.8,
      '3_months': 0.6,
      '6_months': 0.4,
      '1_year': 0.2
    };
    return scores[timeline] || 0.3;
  }

  getLocationScore(location) {
    if (!location) return 0.5;

    const premiumAreas = ['bandra', 'juhu', 'south mumbai', 'lower parel', 'worli'];
    const isPremium = premiumAreas.some(area =>
      location.toLowerCase().includes(area));

    return isPremium ? 0.8 : 0.6;
  }

  getSourceScore(source) {
    const scores = {
      'referral': 0.9,
      'whatsapp': 0.7,
      'website': 0.6,
      'meta_ads': 0.5,
      'cold_call': 0.3
    };
    return scores[source] || 0.5;
  }

  // Get historical conversion data
  async getHistoricalConversionData() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
          AVG(CASE WHEN budget IS NOT NULL THEN budget END) as avg_budget,
          source,
          COUNT(*) as source_count
        FROM leads
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY source
      `);

      return result.rows;
    } catch (error) {
      console.error('Error getting historical data:', error);
      return [];
    }
  }

  // Custom Reports Builder

  // Create custom report
  async createCustomReport(reportConfig) {
    try {
      const {
        name,
        description,
        dataSource,
        filters,
        groupBy,
        metrics,
        dateRange,
        schedule
      } = reportConfig;

      // Validate report configuration
      this.validateReportConfig(reportConfig);

      // Generate report data
      const reportData = await this.generateReportData(reportConfig);

      // Save report configuration
      const result = await query(`
        INSERT INTO custom_reports (
          name, description, config, created_by, organization_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        name,
        description,
        JSON.stringify(reportConfig),
        reportConfig.createdBy,
        reportConfig.organizationId
      ]);

      return {
        reportId: result.rows[0].id,
        data: reportData,
        config: reportConfig
      };
    } catch (error) {
      console.error('Error creating custom report:', error);
      throw error;
    }
  }

  // Generate report data
  async generateReportData(config) {
    const { dataSource, filters, groupBy, metrics, dateRange } = config;

    let query = this.buildReportQuery(dataSource, filters, groupBy, metrics, dateRange);

    try {
      const result = await query(query.text, query.values);
      return this.formatReportData(result.rows, config);
    } catch (error) {
      console.error('Error generating report data:', error);
      throw error;
    }
  }

  // Build report query
  buildReportQuery(dataSource, filters, groupBy, metrics, dateRange) {
    let selectClause = [];
    let fromClause = '';
    let whereClause = [];
    let groupClause = '';
    let params = [];
    let paramCount = 1;

    // Data source mapping
    const dataSourceMap = {
      leads: {
        table: 'leads',
        dateField: 'created_at'
      },
      conversations: {
        table: 'conversations',
        dateField: 'created_at'
      },
      campaigns: {
        table: 'broadcasts',
        dateField: 'created_at'
      },
      properties: {
        table: 'properties',
        dateField: 'created_at'
      }
    };

    const source = dataSourceMap[dataSource];
    if (!source) throw new Error(`Unsupported data source: ${dataSource}`);

    fromClause = `FROM ${source.table}`;

    // Date range filter
    if (dateRange) {
      whereClause.push(`${source.dateField} BETWEEN $${paramCount} AND $${paramCount + 1}`);
      params.push(dateRange.start, dateRange.end);
      paramCount += 2;
    }

    // Custom filters
    if (filters) {
      Object.entries(filters).forEach(([field, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          whereClause.push(`${field} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      });
    }

    // Metrics
    metrics.forEach(metric => {
      switch (metric) {
        case 'count':
          selectClause.push('COUNT(*) as total_count');
          break;
        case 'sum_budget':
          selectClause.push('SUM(budget) as total_budget');
          break;
        case 'avg_budget':
          selectClause.push('AVG(budget) as avg_budget');
          break;
        case 'conversion_rate':
          selectClause.push('AVG(CASE WHEN status = \'converted\' THEN 1 ELSE 0 END) * 100 as conversion_rate');
          break;
        default:
          selectClause.push(`${metric}`);
      }
    });

    // Group by
    if (groupBy && groupBy.length > 0) {
      groupClause = `GROUP BY ${groupBy.join(', ')}`;
      selectClause.unshift(...groupBy);
    }

    const whereStr = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    return {
      text: `SELECT ${selectClause.join(', ')} ${fromClause} ${whereStr} ${groupClause}`,
      values: params
    };
  }

  // Format report data
  formatReportData(rows, config) {
    return {
      summary: this.calculateSummaryStats(rows, config),
      data: rows,
      generatedAt: new Date(),
      config: config
    };
  }

  // Calculate summary statistics
  calculateSummaryStats(rows, config) {
    if (rows.length === 0) return {};

    const summary = {};

    // Calculate averages, totals, etc.
    const numericFields = Object.keys(rows[0]).filter(key =>
      typeof rows[0][key] === 'number'
    );

    numericFields.forEach(field => {
      const values = rows.map(row => row[field]).filter(val => val !== null);
      if (values.length > 0) {
        summary[`${field}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        summary[`${field}_total`] = values.reduce((a, b) => a + b, 0);
        summary[`${field}_min`] = Math.min(...values);
        summary[`${field}_max`] = Math.max(...values);
      }
    });

    return summary;
  }

  // Validate report configuration
  validateReportConfig(config) {
    const required = ['name', 'dataSource', 'metrics'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const validDataSources = ['leads', 'conversations', 'campaigns', 'properties'];
    if (!validDataSources.includes(config.dataSource)) {
      throw new Error(`Invalid data source: ${config.dataSource}`);
    }
  }

  // Scheduled Reports

  // Schedule a report
  async scheduleReport(reportId, scheduleConfig) {
    try {
      const { frequency, time, recipients, format } = scheduleConfig;

      const result = await query(`
        INSERT INTO scheduled_reports (
          report_id, frequency, schedule_time, recipients, format
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [reportId, frequency, time, JSON.stringify(recipients), format]);

      return result.rows[0];
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  // Process scheduled reports
  async processScheduledReports() {
    try {
      // Get reports due for execution
      const result = await query(`
        SELECT sr.*, cr.name, cr.config
        FROM scheduled_reports sr
        JOIN custom_reports cr ON sr.report_id = cr.id
        WHERE sr.next_run <= NOW() AND sr.is_active = true
      `);

      const reports = result.rows;

      for (const report of reports) {
        try {
          // Generate report data
          const reportData = await this.generateReportData(JSON.parse(report.config));

          // Send report to recipients
          await this.sendScheduledReport(report, reportData);

          // Update next run time
          await this.updateNextRunTime(report.id, report.frequency);

        } catch (error) {
          console.error(`Error processing scheduled report ${report.id}:`, error);
        }
      }

      return { processed: reports.length };
    } catch (error) {
      console.error('Error processing scheduled reports:', error);
      throw error;
    }
  }

  // Send scheduled report
  async sendScheduledReport(report, data) {
    const { recipients, format } = report;

    // Format report based on type
    let formattedReport;
    switch (format) {
      case 'pdf':
        formattedReport = await this.generatePDFReport(data);
        break;
      case 'excel':
        formattedReport = await this.generateExcelReport(data);
        break;
      default:
        formattedReport = JSON.stringify(data, null, 2);
    }

    // Send to each recipient
    for (const recipient of recipients) {
      await this.sendReportEmail(recipient, report.name, formattedReport, format);
    }
  }

  // Generate PDF report (placeholder)
  async generatePDFReport(data) {
    // Implementation would use a PDF library like puppeteer
    return `PDF Report: ${data.summary.total_count || 'N/A'} records`;
  }

  // Generate Excel report (placeholder)
  async generateExcelReport(data) {
    // Implementation would use a library like exceljs
    return `Excel Report: ${JSON.stringify(data.summary)}`;
  }

  // Send report email (placeholder)
  async sendReportEmail(recipient, reportName, reportData, format) {
    // Implementation would use an email service
    console.log(`Sending ${format} report "${reportName}" to ${recipient}`);
  }

  // Update next run time
  async updateNextRunTime(scheduledReportId, frequency) {
    let nextRun;

    switch (frequency) {
      case 'daily':
        nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextRun = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextRun = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    await query(
      'UPDATE scheduled_reports SET next_run = $1, last_run = NOW() WHERE id = $2',
      [nextRun, scheduledReportId]
    );
  }

  // AI Insights and Recommendations

  // Generate AI insights
  async generateAIInsights(organizationId, timeRange = '30_days') {
    try {
      const insights = [];

      // Performance insights
      const performanceInsights = await this.analyzePerformanceTrends(organizationId, timeRange);
      insights.push(...performanceInsights);

      // Conversion insights
      const conversionInsights = await this.analyzeConversionPatterns(organizationId, timeRange);
      insights.push(...conversionInsights);

      // Predictive insights
      const predictiveInsights = await this.generatePredictiveInsights(organizationId);
      insights.push(...predictiveInsights);

      // Actionable recommendations
      const recommendations = await this.generateRecommendations(organizationId, insights);
      insights.push(...recommendations);

      return {
        insights,
        generatedAt: new Date(),
        timeRange,
        organizationId
      };
    } catch (error) {
      console.error('Error generating AI insights:', error);
      throw error;
    }
  }

  // Analyze performance trends
  async analyzePerformanceTrends(organizationId, timeRange) {
    const insights = [];

    try {
      // Get performance data
      const result = await query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as leads_count,
          AVG(CASE WHEN budget IS NOT NULL THEN budget END) as avg_budget
        FROM leads
        WHERE organization_id = $1
        AND created_at >= NOW() - INTERVAL '${timeRange.replace('_', ' ')}'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [organizationId]);

      const data = result.rows;

      if (data.length < 7) return insights; // Need at least a week of data

      // Calculate trends
      const recent = data.slice(-7);
      const previous = data.slice(-14, -7);

      const recentAvg = recent.reduce((sum, d) => sum + d.leads_count, 0) / recent.length;
      const previousAvg = previous.reduce((sum, d) => sum + d.leads_count, 0) / previous.length;

      const trend = ((recentAvg - previousAvg) / previousAvg) * 100;

      if (Math.abs(trend) > 10) {
        insights.push({
          type: trend > 0 ? 'positive' : 'negative',
          category: 'performance',
          title: trend > 0 ? 'Lead Generation Improving' : 'Lead Generation Declining',
          description: `Lead inflow ${trend > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend).toFixed(1)}% compared to last week`,
          impact: trend > 0 ? 'high' : 'medium',
          recommendation: trend > 0
            ? 'Continue current marketing strategies'
            : 'Review and optimize lead generation channels'
        });
      }

    } catch (error) {
      console.error('Error analyzing performance trends:', error);
    }

    return insights;
  }

  // Analyze conversion patterns
  async analyzeConversionPatterns(organizationId, timeRange) {
    const insights = [];

    try {
      const result = await query(`
        SELECT
          source,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads
        FROM leads
        WHERE organization_id = $1
        AND created_at >= NOW() - INTERVAL '${timeRange.replace('_', ' ')}'
        GROUP BY source
        HAVING COUNT(*) > 5
      `, [organizationId]);

      result.rows.forEach(row => {
        const conversionRate = (row.converted_leads / row.total_leads) * 100;

        if (conversionRate > 25) {
          insights.push({
            type: 'positive',
            category: 'conversion',
            title: `High Conversion from ${row.source}`,
            description: `${row.source} leads have ${conversionRate.toFixed(1)}% conversion rate`,
            impact: 'high',
            recommendation: 'Increase investment in this channel'
          });
        } else if (conversionRate < 10) {
          insights.push({
            type: 'warning',
            category: 'conversion',
            title: `Low Conversion from ${row.source}`,
            description: `${row.source} leads have only ${conversionRate.toFixed(1)}% conversion rate`,
            impact: 'medium',
            recommendation: 'Review lead qualification or nurturing process'
          });
        }
      });

    } catch (error) {
      console.error('Error analyzing conversion patterns:', error);
    }

    return insights;
  }

  // Generate predictive insights
  async generatePredictiveInsights(organizationId) {
    const insights = [];

    try {
      // Predict next month's performance
      const prediction = await this.predictNextMonthPerformance(organizationId);

      if (prediction.confidence > 0.7) {
        insights.push({
          type: prediction.trend === 'up' ? 'positive' : 'warning',
          category: 'predictive',
          title: 'Next Month Prediction',
          description: `Expected ${prediction.metric} ${prediction.trend === 'up' ? 'increase' : 'decrease'} of ${Math.abs(prediction.change).toFixed(1)}%`,
          impact: 'medium',
          confidence: prediction.confidence
        });
      }

    } catch (error) {
      console.error('Error generating predictive insights:', error);
    }

    return insights;
  }

  // Predict next month performance
  async predictNextMonthPerformance(organizationId) {
    // Simple linear regression based on last 3 months
    try {
      const result = await query(`
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as leads_count
        FROM leads
        WHERE organization_id = $1
        AND created_at >= NOW() - INTERVAL '3 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `, [organizationId]);

      const data = result.rows;
      if (data.length < 2) return { confidence: 0 };

      // Simple trend calculation
      const recent = data[data.length - 1].leads_count;
      const previous = data[data.length - 2].leads_count;
      const change = ((recent - previous) / previous) * 100;

      return {
        metric: 'leads',
        trend: change > 0 ? 'up' : 'down',
        change: change,
        confidence: 0.8
      };
    } catch (error) {
      console.error('Error predicting performance:', error);
      return { confidence: 0 };
    }
  }

  // Generate recommendations
  async generateRecommendations(organizationId, insights) {
    const recommendations = [];

    // Based on insights, generate actionable recommendations
    const hasLowConversion = insights.some(i => i.type === 'warning' && i.category === 'conversion');
    const hasHighPerformance = insights.some(i => i.type === 'positive' && i.category === 'performance');

    if (hasLowConversion) {
      recommendations.push({
        type: 'action',
        category: 'optimization',
        title: 'Optimize Lead Nurturing',
        description: 'Implement automated follow-up sequences for low-converting leads',
        impact: 'high',
        effort: 'medium'
      });
    }

    if (hasHighPerformance) {
      recommendations.push({
        type: 'action',
        category: 'scaling',
        title: 'Scale Successful Channels',
        description: 'Increase budget allocation to high-performing lead sources',
        impact: 'high',
        effort: 'low'
      });
    }

    // General recommendations
    recommendations.push({
      type: 'action',
      category: 'engagement',
      title: 'Implement AI Chatbot',
      description: 'Deploy AI-powered chatbot for 24/7 lead engagement',
      impact: 'high',
      effort: 'medium'
    });

    return recommendations;
  }
}

module.exports = new AdvancedAnalyticsService();