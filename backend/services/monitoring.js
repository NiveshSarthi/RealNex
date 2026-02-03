const os = require('os');
const { query } = require('../config/database');

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      activeConnections: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    this.startTime = Date.now();
    this.lastReset = Date.now();

    // Start collecting system metrics
    this.startSystemMonitoring();
  }

  // Middleware for request monitoring
  requestTracker() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metrics.responseTime.push(duration);

        // Keep only last 100 response times
        if (this.metrics.responseTime.length > 100) {
          this.metrics.responseTime.shift();
        }

        // Track errors
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }

        // Log slow requests
        if (duration > 5000) { // 5 seconds
          console.warn(`🐌 Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
      });

      next();
    };
  }

  // Start system monitoring
  startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    // Reset daily metrics
    setInterval(() => {
      this.resetDailyMetrics();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  // Collect system metrics
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
    this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // Log if memory usage is high
    if (this.metrics.memoryUsage > 0.8) {
      console.warn(`⚠️ High memory usage: ${(this.metrics.memoryUsage * 100).toFixed(2)}%`);
    }

    // Log if CPU usage is high
    if (this.metrics.cpuUsage > 80) {
      console.warn(`⚠️ High CPU usage: ${this.metrics.cpuUsage.toFixed(2)}%`);
    }
  }

  // Reset daily metrics
  resetDailyMetrics() {
    console.log('📊 Resetting daily metrics...');
    this.metrics.requests = 0;
    this.metrics.errors = 0;
    this.metrics.responseTime = [];
    this.lastReset = Date.now();
  }

  // Get current metrics
  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;

    const errorRate = this.metrics.requests > 0
      ? (this.metrics.errors / this.metrics.requests) * 100
      : 0;

    return {
      uptime: Date.now() - this.startTime,
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: errorRate.toFixed(2),
      avgResponseTime: avgResponseTime.toFixed(2),
      memoryUsage: (this.metrics.memoryUsage * 100).toFixed(2),
      cpuUsage: this.metrics.cpuUsage.toFixed(2),
      activeConnections: this.metrics.activeConnections,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()
      },
      lastReset: new Date(this.lastReset).toISOString()
    };
  }

  // Health check
  async healthCheck() {
    try {
      // Database health check
      const dbStart = Date.now();
      await query('SELECT 1');
      const dbLatency = Date.now() - dbStart;

      // System health
      const systemHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'healthy',
            latency: dbLatency
          },
          memory: {
            status: this.metrics.memoryUsage < 0.9 ? 'healthy' : 'warning',
            usage: (this.metrics.memoryUsage * 100).toFixed(2) + '%'
          },
          cpu: {
            status: this.metrics.cpuUsage < 80 ? 'healthy' : 'warning',
            usage: this.metrics.cpuUsage.toFixed(2) + '%'
          }
        }
      };

      // Overall status
      const hasWarnings = Object.values(systemHealth.services).some(service => service.status === 'warning');
      systemHealth.status = hasWarnings ? 'warning' : 'healthy';

      return systemHealth;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Log application events
  logEvent(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // In production, this would be sent to a logging service
    const logMessage = `[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'error':
        console.error(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }

    // Store critical logs in database
    if (level === 'error' || level === 'warn') {
      this.storeLogEntry(logEntry).catch(err => {
        console.error('Failed to store log entry:', err);
      });
    }
  }

  // Store log entry in database
  async storeLogEntry(logEntry) {
    try {
      await query(
        `INSERT INTO system_logs (level, message, data, created_at)
         VALUES ($1, $2, $3, $4)`,
        [logEntry.level, logEntry.message, JSON.stringify(logEntry.data), logEntry.timestamp]
      );
    } catch (error) {
      console.error('Failed to store log entry in database:', error);
    }
  }

  // Performance monitoring for specific operations
  async monitorOperation(operationName, operation) {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      // Log slow operations
      if (duration > 1000) { // 1 second
        this.logEvent('warn', `Slow operation: ${operationName}`, { duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logEvent('error', `Operation failed: ${operationName}`, {
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Database query monitoring
  async monitorQuery(queryText, params = []) {
    const startTime = Date.now();
    try {
      const result = await query(queryText, params);
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > 500) { // 500ms
        this.logEvent('warn', 'Slow database query', {
          query: queryText.substring(0, 100) + '...',
          duration,
          params: JSON.stringify(params).substring(0, 100)
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logEvent('error', 'Database query failed', {
        query: queryText,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // API rate limiting monitoring
  checkRateLimit(identifier, limit = 1000, windowMs = 15 * 60 * 1000) {
    // Simple in-memory rate limiting (use Redis in production)
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    if (!this.rateLimitCache) {
      this.rateLimitCache = new Map();
    }

    const userLimit = this.rateLimitCache.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }

    userLimit.count++;
    this.rateLimitCache.set(key, userLimit);

    const isLimited = userLimit.count > limit;

    if (isLimited) {
      this.logEvent('warn', 'Rate limit exceeded', { identifier, count: userLimit.count });
    }

    return {
      limited: isLimited,
      remaining: Math.max(0, limit - userLimit.count),
      resetTime: userLimit.resetTime
    };
  }

  // Generate performance report
  async generatePerformanceReport() {
    const metrics = this.getMetrics();

    // Get database performance stats
    const dbStats = await this.getDatabaseStats();

    // Get API performance stats
    const apiStats = await this.getAPIStats();

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: new Date(this.lastReset).toISOString(),
        to: new Date().toISOString()
      },
      system: metrics,
      database: dbStats,
      api: apiStats,
      recommendations: this.generateRecommendations(metrics, dbStats, apiStats)
    };
  }

  // Get database performance statistics
  async getDatabaseStats() {
    try {
      const result = await query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
      `);

      return result.rows;
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return [];
    }
  }

  // Get API performance statistics
  async getAPIStats() {
    try {
      // This would typically come from a logging/analytics service
      // For now, return basic stats
      return {
        totalEndpoints: 25, // Approximate count
        mostUsedEndpoints: [
          '/api/campaigns',
          '/api/leads',
          '/api/whatsapp',
          '/api/analytics/dashboard'
        ],
        averageResponseTime: '245ms',
        errorRate: '0.02%'
      };
    } catch (error) {
      console.error('Failed to get API stats:', error);
      return {};
    }
  }

  // Generate performance recommendations
  generateRecommendations(metrics, dbStats, apiStats) {
    const recommendations = [];

    if (metrics.memoryUsage > 0.8) {
      recommendations.push('Consider increasing server memory or optimizing memory usage');
    }

    if (metrics.cpuUsage > 70) {
      recommendations.push('High CPU usage detected. Consider scaling horizontally or optimizing code');
    }

    if (metrics.avgResponseTime > 1000) {
      recommendations.push('Average response time is high. Consider implementing caching or database optimization');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and fix critical issues');
    }

    return recommendations;
  }
}

module.exports = new MonitoringService();