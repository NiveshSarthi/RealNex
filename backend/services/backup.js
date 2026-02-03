const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { query } = require('../config/database');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
    this.retentionDays = process.env.BACKUP_RETENTION_DAYS || 30;

    // AWS S3 configuration
    if (process.env.AWS_ACCESS_KEY_ID) {
      this.s3 = new S3Client({
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        region: process.env.AWS_REGION || 'us-east-1'
      });
      this.s3Bucket = process.env.AWS_BACKUP_BUCKET;
    }

    this.ensureBackupDirectory();
  }

  // Ensure backup directory exists
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
    }
  }

  // Create database backup
  async createDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `synditech_backup_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      console.log('📦 Starting database backup...');

      const pgDumpCommand = `pg_dump --host=${process.env.DB_HOST} --port=${process.env.DB_PORT} --username=${process.env.DB_USER} --dbname=${process.env.DB_NAME} --no-password --format=custom --compress=9 --file="${filepath}"`;

      await this.executeCommand(pgDumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASSWORD
        }
      });

      console.log(`✅ Database backup created: ${filename}`);

      // Upload to cloud storage
      if (this.s3) {
        await this.uploadToS3(filepath, filename);
      }

      // Clean up old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        filename,
        filepath,
        size: await this.getFileSize(filepath)
      };
    } catch (error) {
      console.error('❌ Database backup failed:', error);
      throw error;
    }
  }

  // Create application data backup
  async createApplicationBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `synditech_app_backup_${timestamp}.tar.gz`;
    const filepath = path.join(this.backupDir, filename);

    try {
      console.log('📦 Starting application backup...');

      // Backup uploads, logs, and configuration
      const sourceDirs = [
        path.join(__dirname, '../uploads'),
        path.join(__dirname, '../logs'),
        path.join(__dirname, '../config')
      ].filter(dir => {
        try {
          require('fs').existsSync(dir);
          return true;
        } catch {
          return false;
        }
      });

      if (sourceDirs.length > 0) {
        const tarCommand = `tar -czf "${filepath}" -C "${path.dirname(sourceDirs[0])}" ${sourceDirs.map(dir => `"${path.basename(dir)}"`).join(' ')}`;
        await this.executeCommand(tarCommand);
      } else {
        // Create empty archive if no directories exist
        await this.executeCommand(`tar -czf "${filepath}" --files-from /dev/null`);
      }

      console.log(`✅ Application backup created: ${filename}`);

      // Upload to cloud storage
      if (this.s3) {
        await this.uploadToS3(filepath, filename);
      }

      return {
        success: true,
        filename,
        filepath,
        size: await this.getFileSize(filepath)
      };
    } catch (error) {
      console.error('❌ Application backup failed:', error);
      throw error;
    }
  }

  // Create full system backup
  async createFullBackup() {
    try {
      console.log('🚀 Starting full system backup...');

      const dbBackup = await this.createDatabaseBackup();
      const appBackup = await this.createApplicationBackup();

      // Create backup manifest
      const manifest = {
        timestamp: new Date().toISOString(),
        type: 'full_backup',
        components: {
          database: {
            filename: dbBackup.filename,
            size: dbBackup.size
          },
          application: {
            filename: appBackup.filename,
            size: appBackup.size
          }
        },
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      };

      const manifestPath = path.join(this.backupDir, `manifest_${Date.now()}.json`);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      console.log('✅ Full system backup completed');

      return {
        success: true,
        manifest,
        backups: [dbBackup, appBackup]
      };
    } catch (error) {
      console.error('❌ Full system backup failed:', error);
      throw error;
    }
  }

  // Restore from backup
  async restoreFromBackup(backupPath, type = 'database') {
    try {
      console.log(`🔄 Starting ${type} restore from: ${backupPath}`);

      if (type === 'database') {
        const pgRestoreCommand = `pg_restore --host=${process.env.DB_HOST} --port=${process.env.DB_PORT} --username=${process.env.DB_USER} --dbname=${process.env.DB_NAME} --no-password --clean --if-exists "${backupPath}"`;

        await this.executeCommand(pgRestoreCommand, {
          env: {
            ...process.env,
            PGPASSWORD: process.env.DB_PASSWORD
          }
        });
      } else if (type === 'application') {
        const extractPath = path.join(__dirname, '../restore_temp');
        await fs.mkdir(extractPath, { recursive: true });

        const tarCommand = `tar -xzf "${backupPath}" -C "${extractPath}"`;
        await this.executeCommand(tarCommand);

        // Copy restored files to appropriate locations
        // This would need to be customized based on your directory structure
        console.log('📂 Application files extracted to:', extractPath);
      }

      console.log(`✅ ${type} restore completed`);
      return { success: true };
    } catch (error) {
      console.error(`❌ ${type} restore failed:`, error);
      throw error;
    }
  }

  // Upload file to S3
  async uploadToS3(filepath, filename) {
    try {
      if (!this.s3 || !this.s3Bucket) {
        console.log('⚠️ S3 not configured, skipping cloud upload');
        return;
      }

      const fileContent = await fs.readFile(filepath);
      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.s3Bucket,
          Key: `backups/${filename}`,
          Body: fileContent,
          Metadata: {
            'backup-timestamp': new Date().toISOString(),
            'environment': process.env.NODE_ENV || 'development'
          }
        }
      });

      const result = await upload.done();
      console.log(`☁️ Backup uploaded to S3: ${result.Location}`);

      return result;
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      throw error;
    }
  }

  // Download backup from S3
  async downloadFromS3(filename) {
    try {
      if (!this.s3 || !this.s3Bucket) {
        throw new Error('S3 not configured');
      }

      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: `backups/${filename}`
      });

      const result = await this.s3.send(command);
      const localPath = path.join(this.backupDir, `downloaded_${filename}`);

      // SDK v3 returns a stream for result.Body
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      await fs.writeFile(localPath, buffer);
      console.log(`☁️ Backup downloaded from S3: ${localPath}`);

      return localPath;
    } catch (error) {
      console.error('❌ S3 download failed:', error);
      throw error;
    }
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.sql') || file.endsWith('.tar.gz')) {
          const filepath = path.join(this.backupDir, file);
          const stats = await fs.stat(filepath);

          backups.push({
            filename: file,
            filepath,
            size: stats.size,
            createdAt: stats.birthtime,
            type: file.includes('app_backup') ? 'application' : 'database'
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.createdAt - a.createdAt);

      return backups;
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  // Clean up old backups
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;
      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          await fs.unlink(backup.filepath);
          console.log(`🗑️ Deleted old backup: ${backup.filename}`);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old backups`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old backups:', error);
    }
  }

  // Get backup statistics
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

      const stats = {
        totalBackups: backups.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
        newestBackup: backups.length > 0 ? backups[0].createdAt : null,
        databaseBackups: backups.filter(b => b.type === 'database').length,
        applicationBackups: backups.filter(b => b.type === 'application').length,
        retentionDays: this.retentionDays
      };

      return stats;
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error);
      return {};
    }
  }

  // Execute shell command
  executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          console.error('Command failed:', command);
          console.error('Error:', error);
          console.error('Stderr:', stderr);
          reject(error);
        } else {
          if (stdout) console.log('Command output:', stdout);
          resolve(stdout);
        }
      });
    });
  }

  // Get file size
  async getFileSize(filepath) {
    try {
      const stats = await fs.stat(filepath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Schedule automated backups
  scheduleAutomatedBackups() {
    const cron = require('node-cron');

    // Daily full backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('⏰ Running scheduled daily backup...');
        await this.createFullBackup();
        console.log('✅ Scheduled backup completed');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    });

    // Database backup every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('⏰ Running scheduled database backup...');
        await this.createDatabaseBackup();
        console.log('✅ Scheduled database backup completed');
      } catch (error) {
        console.error('❌ Scheduled database backup failed:', error);
      }
    });

    console.log('📅 Automated backup scheduling enabled');
  }

  // Validate backup integrity
  async validateBackup(filepath, type = 'database') {
    try {
      if (type === 'database') {
        // Test if the backup file can be read by pg_restore
        const testCommand = `pg_restore --list "${filepath}" > /dev/null 2>&1`;
        await this.executeCommand(testCommand);
      } else if (type === 'application') {
        // Test if the tar archive is valid
        const testCommand = `tar -tzf "${filepath}" > /dev/null 2>&1`;
        await this.executeCommand(testCommand);
      }

      console.log(`✅ Backup validation passed: ${filepath}`);
      return { valid: true };
    } catch (error) {
      console.error(`❌ Backup validation failed: ${filepath}`, error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new BackupService();