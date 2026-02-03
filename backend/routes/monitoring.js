const express = require('express');
const MonitoringService = require('../services/monitoring');
const BackupService = require('../services/backup');

const router = express.Router();

// @route   GET /api/monitoring/health
// @desc    Health check endpoint
// @access  Public
router.get('/health', async (req, res) => {
  try {
    const health = await MonitoringService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'warning' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// @route   GET /api/monitoring/metrics
// @desc    Get application metrics
// @access  Private (Admin only)
router.get('/metrics', (req, res) => {
  try {
    const metrics = MonitoringService.getMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/monitoring/performance
// @desc    Get performance report
// @access  Private (Admin only)
router.get('/performance', async (req, res) => {
  try {
    const report = await MonitoringService.generatePerformanceReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/monitoring/logs
// @desc    Log application event
// @access  Private
router.post('/logs', (req, res) => {
  try {
    const { level, message, data } = req.body;

    if (!level || !message) {
      return res.status(400).json({
        success: false,
        message: 'Level and message are required'
      });
    }

    MonitoringService.logEvent(level, message, data || {});

    res.json({
      success: true,
      message: 'Log entry created'
    });
  } catch (error) {
    console.error('Log creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/backup/database
// @desc    Create database backup
// @access  Private (Admin only)
router.post('/backup/database', async (req, res) => {
  try {
    const result = await BackupService.createDatabaseBackup();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Database backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message
    });
  }
});

// @route   POST /api/backup/application
// @desc    Create application backup
// @access  Private (Admin only)
router.post('/backup/application', async (req, res) => {
  try {
    const result = await BackupService.createApplicationBackup();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Application backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message
    });
  }
});

// @route   POST /api/backup/full
// @desc    Create full system backup
// @access  Private (Admin only)
router.post('/backup/full', async (req, res) => {
  try {
    const result = await BackupService.createFullBackup();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Full backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message
    });
  }
});

// @route   GET /api/backup/list
// @desc    List available backups
// @access  Private (Admin only)
router.get('/backup/list', async (req, res) => {
  try {
    const backups = await BackupService.listBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/backup/stats
// @desc    Get backup statistics
// @access  Private (Admin only)
router.get('/backup/stats', async (req, res) => {
  try {
    const stats = await BackupService.getBackupStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Backup stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/backup/restore
// @desc    Restore from backup
// @access  Private (Admin only)
router.post('/backup/restore', async (req, res) => {
  try {
    const { filename, type = 'database' } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
    }

    const backupPath = path.join(BackupService.backupDir, filename);
    const result = await BackupService.restoreFromBackup(backupPath, type);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Restore failed',
      error: error.message
    });
  }
});

// @route   POST /api/backup/validate
// @desc    Validate backup integrity
// @access  Private (Admin only)
router.post('/backup/validate', async (req, res) => {
  try {
    const { filename, type = 'database' } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
    }

    const backupPath = path.join(BackupService.backupDir, filename);
    const result = await BackupService.validateBackup(backupPath, type);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Backup validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation failed',
      error: error.message
    });
  }
});

// @route   DELETE /api/backup/:filename
// @desc    Delete backup file
// @access  Private (Admin only)
router.delete('/backup/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs').promises;
    const path = require('path');

    const filepath = path.join(BackupService.backupDir, filename);

    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }

    await fs.unlink(filepath);

    MonitoringService.logEvent('info', 'Backup file deleted', { filename });

    res.json({
      success: true,
      message: 'Backup file deleted successfully'
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/system/info
// @desc    Get system information
// @access  Private (Admin only)
router.get('/system/info', (req, res) => {
  try {
    const os = require('os');
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      versions: process.versions
    };

    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/system/maintenance
// @desc    Run maintenance tasks
// @access  Private (Admin only)
router.post('/system/maintenance', async (req, res) => {
  try {
    const { task } = req.body;

    switch (task) {
      case 'cleanup_backups':
        await BackupService.cleanupOldBackups();
        MonitoringService.logEvent('info', 'Manual backup cleanup executed');
        break;

      case 'reset_metrics':
        // Reset monitoring metrics
        MonitoringService.metrics.requests = 0;
        MonitoringService.metrics.errors = 0;
        MonitoringService.metrics.responseTime = [];
        MonitoringService.lastReset = Date.now();
        MonitoringService.logEvent('info', 'Metrics manually reset');
        break;

      case 'validate_backups':
        const backups = await BackupService.listBackups();
        const validationResults = [];

        for (const backup of backups.slice(0, 5)) { // Validate last 5 backups
          const result = await BackupService.validateBackup(backup.filepath, backup.type);
          validationResults.push({
            filename: backup.filename,
            valid: result.valid,
            error: result.error
          });
        }

        MonitoringService.logEvent('info', 'Backup validation completed', { results: validationResults });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid maintenance task'
        });
    }

    res.json({
      success: true,
      message: `Maintenance task '${task}' completed successfully`
    });
  } catch (error) {
    console.error('Maintenance task error:', error);
    res.status(500).json({
      success: false,
      message: 'Maintenance task failed',
      error: error.message
    });
  }
});

module.exports = router;