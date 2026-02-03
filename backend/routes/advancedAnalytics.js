const express = require('express');
const router = express.Router();
const AdvancedAnalyticsService = require('../services/advancedAnalytics');
const { authenticate } = require('../middleware/auth');

// Predictive Analytics

// Predict lead conversion
router.post('/predict-conversion', authenticate, async (req, res) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: 'Lead ID is required'
      });
    }

    // Get lead data (simplified - in real implementation, fetch from database)
    const leadData = {
      id: leadId,
      budget: req.body.budget,
      location: req.body.location,
      timeline: req.body.timeline,
      source: req.body.source,
      message_count: req.body.messageCount || 0
    };

    const prediction = await AdvancedAnalyticsService.predictLeadConversion(leadData);

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error predicting conversion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Custom Reports

// Create custom report
router.post('/reports/custom', authenticate, async (req, res) => {
  try {
    const reportConfig = {
      ...req.body,
      createdBy: req.user.id,
      organizationId: req.user.organizationId
    };

    const result = await AdvancedAnalyticsService.createCustomReport(reportConfig);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating custom report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get custom reports
router.get('/reports/custom', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');

    const result = await query(
      'SELECT * FROM custom_reports WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.user.organizationId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting custom reports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific custom report
router.get('/reports/custom/:id', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM custom_reports WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const report = result.rows[0];
    const reportData = await AdvancedAnalyticsService.generateReportData(JSON.parse(report.config));

    res.json({
      success: true,
      data: {
        report: report,
        data: reportData
      }
    });
  } catch (error) {
    console.error('Error getting custom report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update custom report
router.put('/reports/custom/:id', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await query(
      'SELECT * FROM custom_reports WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Update report
    const result = await query(
      'UPDATE custom_reports SET name = $1, description = $2, config = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [updates.name, updates.description, JSON.stringify(updates.config), id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating custom report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete custom report
router.delete('/reports/custom/:id', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { id } = req.params;

    // Delete scheduled reports first
    await query('DELETE FROM scheduled_reports WHERE report_id = $1', [id]);

    // Delete the report
    const result = await query(
      'DELETE FROM custom_reports WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduled Reports

// Schedule a report
router.post('/reports/schedule', authenticate, async (req, res) => {
  try {
    const { reportId, frequency, time, recipients, format } = req.body;

    // Verify report ownership
    const { query } = require('../config/database');
    const reportCheck = await query(
      'SELECT * FROM custom_reports WHERE id = $1 AND organization_id = $2',
      [reportId, req.user.organizationId]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const scheduleConfig = {
      frequency,
      time,
      recipients,
      format: format || 'pdf'
    };

    const result = await AdvancedAnalyticsService.scheduleReport(reportId, scheduleConfig);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error scheduling report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scheduled reports
router.get('/reports/scheduled', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');

    const result = await query(`
      SELECT sr.*, cr.name as report_name
      FROM scheduled_reports sr
      JOIN custom_reports cr ON sr.report_id = cr.id
      WHERE cr.organization_id = $1
      ORDER BY sr.created_at DESC
    `, [req.user.organizationId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting scheduled reports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Insights

// Generate AI insights
router.get('/insights', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    const insights = await AdvancedAnalyticsService.generateAIInsights(
      req.user.organizationId,
      timeRange || '30_days'
    );

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unread insights count
router.get('/insights/unread-count', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');

    const result = await query(
      'SELECT COUNT(*) as unread_count FROM ai_insights WHERE organization_id = $1 AND is_read = false',
      [req.user.organizationId]
    );

    res.json({
      success: true,
      data: { unreadCount: parseInt(result.rows[0].unread_count) }
    });
  } catch (error) {
    console.error('Error getting unread insights count:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark insight as read
router.put('/insights/:id/read', authenticate, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { id } = req.params;

    const result = await query(
      'UPDATE ai_insights SET is_read = true WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Insight not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking insight as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Report Templates

// Get available report templates
router.get('/report-templates', authenticate, (req, res) => {
  const templates = [
    {
      id: 'lead_performance',
      name: 'Lead Performance Report',
      description: 'Comprehensive analysis of lead generation and conversion',
      dataSource: 'leads',
      metrics: ['count', 'conversion_rate', 'avg_budget'],
      groupBy: ['source'],
      filters: {}
    },
    {
      id: 'campaign_analysis',
      name: 'Campaign Performance Analysis',
      description: 'Detailed breakdown of marketing campaign effectiveness',
      dataSource: 'campaigns',
      metrics: ['count', 'conversion_rate'],
      groupBy: ['status'],
      filters: {}
    },
    {
      id: 'property_performance',
      name: 'Property Performance Matrix',
      description: 'Analysis of property listing performance and engagement',
      dataSource: 'properties',
      metrics: ['count', 'avg_budget'],
      groupBy: ['type', 'status'],
      filters: {}
    },
    {
      id: 'conversation_analytics',
      name: 'Conversation Analytics',
      description: 'Insights into customer communication patterns',
      dataSource: 'conversations',
      metrics: ['count'],
      groupBy: ['channel'],
      filters: {}
    }
  ];

  res.json({
    success: true,
    data: templates
  });
});

// Data Export

// Export report data
router.get('/export/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format } = req.query;

    // Get report configuration
    const { query } = require('../config/database');
    const reportResult = await query(
      'SELECT * FROM custom_reports WHERE id = $1 AND organization_id = $2',
      [reportId, req.user.organizationId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const report = reportResult.rows[0];
    const reportData = await AdvancedAnalyticsService.generateReportData(JSON.parse(report.config));

    // Format based on requested type
    let exportData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        exportData = AdvancedAnalyticsService.convertToCSV(reportData);
        contentType = 'text/csv';
        filename = `${report.name}.csv`;
        break;
      case 'excel':
        exportData = await AdvancedAnalyticsService.generateExcelReport(reportData);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${report.name}.xlsx`;
        break;
      default:
        exportData = JSON.stringify(reportData, null, 2);
        contentType = 'application/json';
        filename = `${report.name}.json`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Utility methods (would be implemented in the service)
AdvancedAnalyticsService.convertToCSV = (data) => {
  // Simple CSV conversion - in real implementation, use a proper CSV library
  if (!data.data || data.data.length === 0) return '';

  const headers = Object.keys(data.data[0]).join(',');
  const rows = data.data.map(row =>
    Object.values(row).map(value =>
      typeof value === 'object' ? JSON.stringify(value) : value
    ).join(',')
  ).join('\n');

  return `${headers}\n${rows}`;
};

module.exports = router;