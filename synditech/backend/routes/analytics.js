const express = require('express');
const Analytics = require('../models/Analytics');
const { authenticateAgent } = require('../middleware/agentAuth');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard overview data
// @access  Private
router.get('/dashboard', authenticateAgent, async (req, res) => {
  try {
    const dashboardData = await Analytics.getDashboardData(req.agent.id);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/campaigns
// @desc    Get campaign analytics
// @access  Private
router.get('/campaigns', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    const analytics = await Analytics.getCampaignAnalytics(req.agent.id, dateRange);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/campaigns/performance-trend
// @desc    Get campaign performance over time
// @access  Private
router.get('/campaigns/performance-trend', authenticateAgent, async (req, res) => {
  try {
    const { period = 'month', limit = 12 } = req.query;

    const trend = await Analytics.getCampaignPerformanceOverTime(
      req.agent.id,
      period,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    console.error('Get campaign performance trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/leads
// @desc    Get lead analytics
// @access  Private
router.get('/leads', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    const analytics = await Analytics.getLeadAnalytics(req.agent.id, dateRange);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get lead analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/leads/sources
// @desc    Get lead source performance
// @access  Private
router.get('/leads/sources', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    const performance = await Analytics.getLeadSourcePerformance(req.agent.id, dateRange);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get lead source performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/revenue
// @desc    Get revenue analytics
// @access  Private
router.get('/revenue', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    const analytics = await Analytics.getRevenueAnalytics(req.agent.id, dateRange);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/revenue/trend
// @desc    Get revenue trend over time
// @access  Private
router.get('/revenue/trend', authenticateAgent, async (req, res) => {
  try {
    const { months = 12 } = req.query;

    const trend = await Analytics.getRevenueTrend(req.agent.id, parseInt(months));

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    console.error('Get revenue trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/geographic
// @desc    Get geographic performance analytics
// @access  Private
router.get('/geographic', authenticateAgent, async (req, res) => {
  try {
    const performance = await Analytics.getGeographicPerformance(req.agent.id);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get geographic performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/ab-tests
// @desc    Get A/B test analytics
// @access  Private
router.get('/ab-tests', authenticateAgent, async (req, res) => {
  try {
    const { campaignId } = req.query;

    const analytics = await Analytics.getABTestAnalytics(req.agent.id, campaignId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get A/B test analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/network
// @desc    Get network analytics
// @access  Private
router.get('/network', authenticateAgent, async (req, res) => {
  try {
    const analytics = await Analytics.getNetworkAnalytics(req.agent.id);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get network analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/performance-comparison
// @desc    Get agent performance comparison
// @access  Private
router.get('/performance-comparison', authenticateAgent, async (req, res) => {
  try {
    const comparison = await Analytics.getAgentPerformanceComparison(req.agent.id);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Get performance comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/activity
// @desc    Get recent activity feed
// @access  Private
router.get('/activity', authenticateAgent, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const activity = await Analytics.getRecentActivity(req.agent.id, parseInt(limit));

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/analytics/custom
// @desc    Get custom date range analytics
// @access  Private
router.post('/custom', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const analytics = await Analytics.getCustomAnalytics(req.agent.id, startDate, endDate);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get custom analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get('/export', authenticateAgent, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Export type is required'
      });
    }

    let data;
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    switch (type) {
      case 'campaigns':
        data = await Analytics.getCampaignAnalytics(req.agent.id, dateRange);
        break;
      case 'leads':
        data = await Analytics.getLeadAnalytics(req.agent.id, dateRange);
        break;
      case 'revenue':
        data = await Analytics.getRevenueAnalytics(req.agent.id, dateRange);
        break;
      case 'dashboard':
        data = await Analytics.getDashboardData(req.agent.id);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_analytics_${new Date().toISOString().split('T')[0]}.json`);

    res.json({
      exportType: type,
      exportedAt: new Date().toISOString(),
      agentId: req.agent.id,
      dateRange,
      data
    });
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;