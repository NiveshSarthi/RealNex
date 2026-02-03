const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get basic analytics overview
// @access  Private
router.get('/overview', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Get conversation count
    const conversationResult = await query(
      'SELECT COUNT(*) as total_conversations FROM conversations c JOIN contacts k ON c.contact_id = k.id WHERE k.organization_id = $1',
      [organizationId]
    );

    // Get message count
    const messageResult = await query(
      'SELECT COUNT(*) as total_messages FROM messages m JOIN conversations c ON m.conversation_id = c.id JOIN contacts k ON c.contact_id = k.id WHERE k.organization_id = $1',
      [organizationId]
    );

    // Get contact count
    const contactResult = await query(
      'SELECT COUNT(*) as total_contacts FROM contacts WHERE organization_id = $1',
      [organizationId]
    );

    // Get active conversations (last 24 hours)
    const activeConversationsResult = await query(
      'SELECT COUNT(*) as active_conversations FROM conversations c JOIN contacts k ON c.contact_id = k.id WHERE k.organization_id = $1 AND c.last_message_at > NOW() - INTERVAL \'24 hours\'',
      [organizationId]
    );

    // Get today's conversations
    const todayConversationsResult = await query(
      'SELECT COUNT(*) as today_conversations FROM conversations c JOIN contacts k ON c.contact_id = k.id WHERE k.organization_id = $1 AND DATE(c.created_at) = CURRENT_DATE',
      [organizationId]
    );

    // Get today's messages
    const todayMessagesResult = await query(
      'SELECT COUNT(*) as today_messages FROM messages m JOIN conversations c ON m.conversation_id = c.id JOIN contacts k ON c.contact_id = k.id WHERE k.organization_id = $1 AND DATE(m.created_at) = CURRENT_DATE',
      [organizationId]
    );

    const overview = {
      totalConversations: parseInt(conversationResult.rows[0].total_conversations),
      totalMessages: parseInt(messageResult.rows[0].total_messages),
      totalContacts: parseInt(contactResult.rows[0].total_contacts),
      activeConversations: parseInt(activeConversationsResult.rows[0].active_conversations),
      todayConversations: parseInt(todayConversationsResult.rows[0].today_conversations),
      todayMessages: parseInt(todayMessagesResult.rows[0].today_messages)
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/conversations
// @desc    Get conversation analytics
// @access  Private
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { period = '7' } = req.query; // days

    // Get conversation trends
    const trendsResult = await query(`
      SELECT
        DATE(c.created_at) as date,
        COUNT(*) as count
      FROM conversations c
      JOIN contacts co ON c.contact_id = co.id
      WHERE co.organization_id = $1
        AND c.created_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY DATE(c.created_at)
      ORDER BY date
    `, [organizationId]);

    // Get conversation status breakdown
    const statusResult = await query(`
      SELECT
        c.status,
        COUNT(*) as count
      FROM conversations c
      JOIN contacts co ON c.contact_id = co.id
      WHERE co.organization_id = $1
      GROUP BY c.status
    `, [organizationId]);

    // Get channel breakdown
    const channelResult = await query(`
      SELECT
        channel,
        COUNT(*) as count
      FROM conversations
      WHERE organization_id = $1
      GROUP BY channel
    `, [organizationId]);

    res.json({
      success: true,
      data: {
        trends: trendsResult.rows,
        statusBreakdown: statusResult.rows,
        channelBreakdown: channelResult.rows
      }
    });
  } catch (error) {
    console.error('Get conversation analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/messages
// @desc    Get message analytics
// @access  Private
router.get('/messages', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { period = '7' } = req.query; // days

    // Get message trends
    const trendsResult = await query(`
      SELECT
        DATE(m.created_at) as date,
        COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = $1
        AND m.created_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY DATE(m.created_at)
      ORDER BY date
    `, [organizationId]);

    // Get message direction breakdown
    const directionResult = await query(`
      SELECT
        m.direction,
        COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = $1
      GROUP BY m.direction
    `, [organizationId]);

    // Get message type breakdown
    const typeResult = await query(`
      SELECT
        m.message_type,
        COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.organization_id = $1
      GROUP BY m.message_type
    `, [organizationId]);

    res.json({
      success: true,
      data: {
        trends: trendsResult.rows,
        directionBreakdown: directionResult.rows,
        typeBreakdown: typeResult.rows
      }
    });
  } catch (error) {
    console.error('Get message analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/contacts
// @desc    Get contact analytics
// @access  Private
router.get('/contacts', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Get contact growth
    const growthResult = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM contacts
      WHERE organization_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [organizationId]);

    // Get contact channel breakdown
    const channelResult = await query(`
      SELECT
        channel,
        COUNT(*) as count
      FROM contacts
      WHERE organization_id = $1
      GROUP BY channel
    `, [organizationId]);

    // Get engagement score distribution
    const engagementResult = await query(`
      SELECT
        CASE
          WHEN engagement_score >= 80 THEN 'High'
          WHEN engagement_score >= 50 THEN 'Medium'
          ELSE 'Low'
        END as engagement_level,
        COUNT(*) as count
      FROM contacts
      WHERE organization_id = $1
      GROUP BY
        CASE
          WHEN engagement_score >= 80 THEN 'High'
          WHEN engagement_score >= 50 THEN 'Medium'
          ELSE 'Low'
        END
    `, [organizationId]);

    res.json({
      success: true,
      data: {
        growth: growthResult.rows,
        channelBreakdown: channelResult.rows,
        engagementBreakdown: engagementResult.rows
      }
    });
  } catch (error) {
    console.error('Get contact analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/dashboard
// @desc    Get detailed dashboard analytics for the Analytics page
// @access  Private
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Run all queries in parallel
    const [
      leadsResult,
      campaignsResult,
      revenueResult,
      activityResult
    ] = await Promise.all([
      // 1. Lead Stats
      query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(CASE WHEN custom_fields->>'status' = 'new' THEN 1 END) as new_leads,
          COUNT(CASE WHEN custom_fields->>'status' = 'contacted' THEN 1 END) as contacted_leads,
          COUNT(CASE WHEN custom_fields->>'status' = 'qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN custom_fields->>'status' = 'closed' THEN 1 END) as closed_leads
        FROM contacts
        WHERE organization_id = $1
      `, [organizationId]),

      // 2. Campaign Stats
      query(`
        SELECT
          COUNT(*) as total_campaigns,
          SUM(sent_count) as total_sent,
          SUM(read_count) as total_read,
          ROUND(
            CASE WHEN SUM(sent_count) > 0 
            THEN (SUM(read_count)::decimal / SUM(sent_count)::decimal) * 100 
            ELSE 0 END, 2
          ) as avg_response_rate
        FROM broadcasts
        WHERE organization_id = $1
      `, [organizationId]),

      // 3. Revenue Stats (Estimated from Closed Leads Budget)
      query(`
        SELECT
          COALESCE(SUM((custom_fields->>'budget_min')::numeric), 0) as total_revenue,
          COUNT(*) as closed_deals
        FROM contacts
        WHERE organization_id = $1 
        AND custom_fields->>'status' = 'closed'
        AND custom_fields->>'budget_min' IS NOT NULL
      `, [organizationId]),

      // 4. Recent Activity (Broadcasts + New Contacts)
      query(`
        (SELECT
          'New Lead: ' || first_name || ' ' || last_name as title,
          'completed' as status,
          created_at as timestamp
        FROM contacts
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 5)
        UNION ALL
        (SELECT
          'Campaign: ' || name as title,
          status,
          created_at as timestamp
        FROM broadcasts
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 5)
        ORDER BY timestamp DESC
        LIMIT 10
      `, [organizationId])
    ]);

    const leadStats = leadsResult.rows[0];
    const campaignStats = campaignsResult.rows[0];
    const revenueStats = revenueResult.rows[0];
    const recentActivity = activityResult.rows;

    // Calculate derived metrics
    leadStats.conversion_rate = leadStats.total_leads > 0
      ? Math.round((leadStats.closed_leads / leadStats.total_leads) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        leadStats: {
          totalLeads: parseInt(leadStats.total_leads),
          new_leads: parseInt(leadStats.new_leads),
          contacted_leads: parseInt(leadStats.contacted_leads),
          qualified_leads: parseInt(leadStats.qualified_leads),
          closed_leads: parseInt(leadStats.closed_leads),
          conversion_rate: leadStats.conversion_rate
        },
        campaignStats: {
          totalCampaigns: parseInt(campaignStats.total_campaigns),
          avg_response_rate: parseFloat(campaignStats.avg_response_rate)
        },
        revenueStats: {
          totalRevenue: parseFloat(revenueStats.total_revenue),
          deals: parseInt(revenueStats.closed_deals)
        },
        recentActivity: recentActivity.map(a => ({
          title: a.title,
          status: a.status,
          timestamp: a.timestamp
        }))
      }
    });

  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;