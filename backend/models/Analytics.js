const { query } = require('../config/database');

class Analytics {
  // Campaign Analytics
  static async getCampaignAnalytics(agentId, dateRange = null) {
    let dateFilter = '';
    const values = [agentId];

    if (dateRange) {
      dateFilter = 'AND c.created_at >= $2 AND c.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    const queryText = `
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_campaigns,
        COUNT(CASE WHEN c.status = 'running' THEN 1 END) as running_campaigns,
        SUM(c.total_recipients) as total_recipients,
        SUM(c.sent_count) as total_sent,
        SUM(c.delivered_count) as total_delivered,
        SUM(c.read_count) as total_read,
        SUM(c.response_count) as total_responses,
        SUM(c.conversion_count) as total_conversions,
        ROUND(
          CASE
            WHEN SUM(c.sent_count) > 0
            THEN (SUM(c.response_count)::decimal / SUM(c.sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_response_rate,
        ROUND(
          CASE
            WHEN SUM(c.sent_count) > 0
            THEN (SUM(c.conversion_count)::decimal / SUM(c.sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_conversion_rate,
        ROUND(
          CASE
            WHEN SUM(c.delivered_count) > 0
            THEN (SUM(c.read_count)::decimal / SUM(c.delivered_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as avg_read_rate
      FROM campaigns c
      WHERE c.agent_id = $1 ${dateFilter}
    `;

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Campaign Performance Over Time
  static async getCampaignPerformanceOverTime(agentId, period = 'month', limit = 12) {
    const periodMap = {
      'day': "DATE_TRUNC('day', c.created_at)",
      'week': "DATE_TRUNC('week', c.created_at)",
      'month': "DATE_TRUNC('month', c.created_at)"
    };

    const queryText = `
      SELECT
        ${periodMap[period]} as period,
        COUNT(*) as campaigns_count,
        SUM(total_recipients) as total_recipients,
        SUM(sent_count) as total_sent,
        SUM(response_count) as total_responses,
        SUM(conversion_count) as total_conversions,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(response_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as response_rate,
        ROUND(
          CASE
            WHEN SUM(sent_count) > 0
            THEN (SUM(conversion_count)::decimal / SUM(sent_count)::decimal) * 100
            ELSE 0
          END, 2
        ) as conversion_rate
      FROM campaigns c
      WHERE c.agent_id = $1 AND c.status = 'completed'
      GROUP BY ${periodMap[period]}
      ORDER BY period DESC
      LIMIT $2
    `;

    const result = await query(queryText, [agentId, limit]);
    return result.rows;
  }

  // Lead Analytics
  static async getLeadAnalytics(agentId, dateRange = null) {
    let dateFilter = '';
    const values = [agentId];

    if (dateRange) {
      dateFilter = 'AND l.created_at >= $2 AND l.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    const queryText = `
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN l.status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN l.status = 'contacted' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN l.status = 'closed' THEN 1 END) as closed_leads,
        COUNT(CASE WHEN l.status = 'lost' THEN 1 END) as lost_leads,
        AVG(l.lead_score) as avg_lead_score,
        COUNT(CASE WHEN l.source = 'whatsapp' THEN 1 END) as whatsapp_leads,
        COUNT(CASE WHEN l.source = 'referral' THEN 1 END) as referral_leads,
        COUNT(CASE WHEN l.source = 'website' THEN 1 END) as website_leads,
        ROUND(
          CASE
            WHEN COUNT(CASE WHEN l.status IN ('qualified', 'closed') THEN 1 END) > 0
            THEN (COUNT(CASE WHEN l.status = 'closed' THEN 1 END)::decimal /
                  COUNT(CASE WHEN l.status IN ('qualified', 'closed') THEN 1 END)::decimal) * 100
            ELSE 0
          END, 2
        ) as conversion_rate
      FROM leads l
      WHERE l.assigned_agent = $1 ${dateFilter}
    `;

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Lead Source Performance
  static async getLeadSourcePerformance(agentId, dateRange = null) {
    let dateFilter = '';
    const values = [agentId];

    if (dateRange) {
      dateFilter = 'AND l.created_at >= $2 AND l.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    const queryText = `
      SELECT
        l.source,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN l.status = 'closed' THEN 1 END) as closed_leads,
        AVG(l.lead_score) as avg_lead_score,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN l.status IN ('qualified', 'closed') THEN 1 END)::decimal / COUNT(*)::decimal) * 100
            ELSE 0
          END, 2
        ) as qualification_rate
      FROM leads l
      WHERE l.assigned_agent = $1 ${dateFilter}
      GROUP BY l.source
      ORDER BY total_leads DESC
    `;

    const result = await query(queryText, values);
    return result.rows;
  }

  // Revenue Analytics
  static async getRevenueAnalytics(agentId, dateRange = null) {
    let dateFilter = '';
    const values = [agentId];

    if (dateRange) {
      dateFilter = 'AND p.created_at >= $2 AND p.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    const queryText = `
      SELECT
        SUM(CASE WHEN p.payment_type = 'commission' THEN p.amount ELSE 0 END) as total_commission,
        SUM(CASE WHEN p.payment_type = 'subscription' THEN p.amount ELSE 0 END) as total_subscription,
        SUM(CASE WHEN p.payment_type = 'referral' THEN p.amount ELSE 0 END) as total_referral,
        SUM(p.amount) as total_revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments,
        AVG(CASE WHEN p.payment_type = 'commission' THEN p.amount END) as avg_commission,
        MAX(p.amount) as highest_payment
      FROM payments p
      WHERE p.agent_id = $1 ${dateFilter}
    `;

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Monthly Revenue Trend
  static async getRevenueTrend(agentId, months = 12) {
    const queryText = `
      SELECT
        DATE_TRUNC('month', p.created_at) as month,
        SUM(CASE WHEN p.payment_type = 'commission' THEN p.amount ELSE 0 END) as commission_revenue,
        SUM(CASE WHEN p.payment_type = 'subscription' THEN p.amount ELSE 0 END) as subscription_revenue,
        SUM(CASE WHEN p.payment_type = 'referral' THEN p.amount ELSE 0 END) as referral_revenue,
        SUM(p.amount) as total_revenue,
        COUNT(*) as total_payments
      FROM payments p
      WHERE p.agent_id = $1 AND p.status = 'completed'
        AND p.created_at >= DATE_TRUNC('month', NOW() - INTERVAL '${months} months')
      GROUP BY DATE_TRUNC('month', p.created_at)
      ORDER BY month DESC
    `;

    const result = await query(queryText, [agentId]);
    return result.rows;
  }

  // Agent Performance Comparison
  static async getAgentPerformanceComparison(agentId) {
    const queryText = `
      WITH agent_stats AS (
        SELECT
          a.id,
          a.name,
          a.trust_score,
          a.total_deals,
          COUNT(l.id) as total_leads,
          COUNT(CASE WHEN l.status = 'closed' THEN 1 END) as closed_leads,
          AVG(l.lead_score) as avg_lead_score,
          COUNT(c.id) as total_campaigns,
          COALESCE(SUM(c.response_count), 0) as total_responses,
          ROUND(
            CASE
              WHEN COUNT(c.id) > 0 AND SUM(c.sent_count) > 0
              THEN (SUM(c.response_count)::decimal / SUM(c.sent_count)::decimal) * 100
              ELSE 0
            END, 2
          ) as avg_response_rate
        FROM agents a
        LEFT JOIN leads l ON a.id = l.assigned_agent
        LEFT JOIN campaigns c ON a.id = c.agent_id AND c.status = 'completed'
        WHERE a.is_active = true
        GROUP BY a.id, a.name, a.trust_score, a.total_deals
      )
      SELECT * FROM agent_stats
      WHERE id = $1
      UNION ALL
      SELECT * FROM (
        SELECT * FROM agent_stats
        WHERE id != $1
        ORDER BY total_deals DESC, avg_response_rate DESC
        LIMIT 10
      ) as peers
      ORDER BY total_deals DESC, avg_response_rate DESC
    `;

    const result = await query(queryText, [agentId]);
    return result.rows;
  }

  // Geographic Performance
  static async getGeographicPerformance(agentId) {
    const queryText = `
      SELECT
        l.location as city,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN l.status = 'closed' THEN 1 END) as closed_leads,
        AVG(l.lead_score) as avg_lead_score,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN l.status IN ('qualified', 'closed') THEN 1 END)::decimal / COUNT(*)::decimal) * 100
            ELSE 0
          END, 2
        ) as conversion_rate
      FROM leads l
      WHERE l.assigned_agent = $1 AND l.location IS NOT NULL
      GROUP BY l.location
      HAVING COUNT(*) >= 3
      ORDER BY total_leads DESC
      LIMIT 20
    `;

    const result = await query(queryText, [agentId]);
    return result.rows;
  }

  // Campaign A/B Test Analytics
  static async getABTestAnalytics(agentId, campaignId = null) {
    let campaignFilter = '';
    const values = [agentId];

    if (campaignId) {
      campaignFilter = 'AND cm.campaign_id = $2';
      values.push(campaignId);
    }

    const queryText = `
      SELECT
        c.id as campaign_id,
        c.name as campaign_name,
        cm.variant,
        cm.variant_name,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN cm.status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN cm.status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN cm.status = 'responded' THEN 1 END) as responses,
        COUNT(CASE WHEN cm.conversion = true THEN 1 END) as conversions,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN cm.status = 'read' THEN 1 END)::decimal / COUNT(*)::decimal) * 100
            ELSE 0
          END, 2
        ) as read_rate,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN cm.status = 'responded' THEN 1 END)::decimal / COUNT(*)::decimal) * 100
            ELSE 0
          END, 2
        ) as response_rate,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN cm.conversion = true THEN 1 END)::decimal / COUNT(*)::decimal) * 100
            ELSE 0
          END, 2
        ) as conversion_rate
      FROM campaign_messages cm
      JOIN campaigns c ON cm.campaign_id = c.id
      WHERE c.agent_id = $1 AND c.is_ab_test = true ${campaignFilter}
      GROUP BY c.id, c.name, cm.variant, cm.variant_name
      ORDER BY c.created_at DESC, cm.variant
    `;

    const result = await query(queryText, values);
    return result.rows;
  }

  // Network Analytics
  static async getNetworkAnalytics(agentId) {
    const queryText = `
      SELECT
        COUNT(CASE WHEN an.status = 'connected' THEN 1 END) as total_connections,
        AVG(an.trust_level) as avg_trust_level,
        SUM(an.shared_leads_count) as total_shared_leads,
        SUM(an.successful_deals_count) as total_successful_deals,
        COUNT(CASE WHEN col.status = 'completed' THEN 1 END) as completed_collaborations,
        SUM(col.deal_value) as total_collaboration_value,
        AVG(col.commission_split) as avg_commission_split
      FROM agent_network an
      LEFT JOIN collaborations col ON (an.agent_id = col.primary_agent OR an.connected_agent_id = col.collaborating_agent)
        AND col.status = 'completed'
      WHERE an.agent_id = $1 OR an.connected_agent_id = $1
    `;

    const result = await query(queryText, [agentId]);
    return result.rows[0];
  }

  // Real-time Dashboard Data
  static async getDashboardData(agentId) {
    const [
      campaignStats,
      leadStats,
      revenueStats,
      recentActivity
    ] = await Promise.all([
      this.getCampaignAnalytics(agentId),
      this.getLeadAnalytics(agentId),
      this.getRevenueAnalytics(agentId),
      this.getRecentActivity(agentId, 10)
    ]);

    return {
      campaignStats,
      leadStats,
      revenueStats,
      recentActivity,
      generatedAt: new Date().toISOString()
    };
  }

  // Recent Activity Feed
  static async getRecentActivity(agentId, limit = 20) {
    const queryText = `
      SELECT
        'campaign' as activity_type,
        c.id as entity_id,
        c.name as title,
        c.status as status,
        c.created_at as timestamp,
        json_build_object(
          'total_recipients', c.total_recipients,
          'sent_count', c.sent_count,
          'response_count', c.response_count
        ) as metadata
      FROM campaigns c
      WHERE c.agent_id = $1

      UNION ALL

      SELECT
        'lead' as activity_type,
        l.id as entity_id,
        COALESCE(l.name, 'New Lead') as title,
        l.status as status,
        l.created_at as timestamp,
        json_build_object(
          'phone', l.phone,
          'source', l.source,
          'lead_score', l.lead_score
        ) as metadata
      FROM leads l
      WHERE l.assigned_agent = $1

      UNION ALL

      SELECT
        'collaboration' as activity_type,
        col.id as entity_id,
        CASE
          WHEN col.primary_agent = $1 THEN 'Collaboration started'
          ELSE 'Collaboration invitation'
        END as title,
        col.status as status,
        col.created_at as timestamp,
        json_build_object(
          'collaboration_type', col.collaboration_type,
          'commission_split', col.commission_split,
          'deal_value', col.deal_value
        ) as metadata
      FROM collaborations col
      WHERE col.primary_agent = $1 OR col.collaborating_agent = $1

      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await query(queryText, [agentId, limit]);
    return result.rows;
  }

  // Custom Date Range Analytics
  static async getCustomAnalytics(agentId, startDate, endDate) {
    const dateRange = { start: startDate, end: endDate };

    const [
      campaignAnalytics,
      leadAnalytics,
      revenueAnalytics,
      leadSourcePerformance
    ] = await Promise.all([
      this.getCampaignAnalytics(agentId, dateRange),
      this.getLeadAnalytics(agentId, dateRange),
      this.getRevenueAnalytics(agentId, dateRange),
      this.getLeadSourcePerformance(agentId, dateRange)
    ]);

    return {
      period: { start: startDate, end: endDate },
      campaignAnalytics,
      leadAnalytics,
      revenueAnalytics,
      leadSourcePerformance
    };
  }
}

module.exports = Analytics;