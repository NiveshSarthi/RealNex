// Production Configuration for SyndiTech
const path = require('path');

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    environment: 'production',
    trustProxy: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    }
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'synditech_prod',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    logging: false
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3
  },

  // RabbitMQ Configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    prefetch: 10,
    queues: {
      whatsapp: 'whatsapp_messages',
      campaigns: 'campaign_jobs',
      notifications: 'agent_notifications',
      analytics: 'analytics_events'
    }
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: '24h',
    bcryptRounds: 12,
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://synditech.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://api.cashfree.com']
        }
      }
    }
  },

  // WhatsApp Business API Configuration
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    apiVersion: 'v18.0',
    rateLimit: {
      messagesPerSecond: 10,
      campaignsPerHour: 100
    }
  },

  // Payment Gateway Configuration
  payments: {
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
    },
    cashfree: {
      appId: process.env.CASHFREE_APP_ID,
      secretKey: process.env.CASHFREE_SECRET_KEY,
      webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET
    },
    payu: {
      merchantKey: process.env.PAYU_MERCHANT_KEY,
      merchantSalt: process.env.PAYU_MERCHANT_SALT,
      webhookSalt: process.env.PAYU_WEBHOOK_SALT
    }
  },

  // File Upload Configuration
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    tempDir: path.join(__dirname, '../temp'),
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'),
    cloudStorage: {
      provider: process.env.CLOUD_STORAGE || 'aws', // aws, gcp, azure
      bucket: process.env.CLOUD_BUCKET,
      region: process.env.CLOUD_REGION,
      credentials: {
        accessKeyId: process.env.CLOUD_ACCESS_KEY,
        secretAccessKey: process.env.CLOUD_SECRET_KEY
      }
    }
  },

  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid',
    from: process.env.EMAIL_FROM || 'noreply@synditech.com',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },

  // Monitoring and Logging
  monitoring: {
    enabled: true,
    sentry: {
      dsn: process.env.SENTRY_DSN
    },
    datadog: {
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY
    },
    newRelic: {
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      appName: 'SyndiTech-API'
    }
  },

  // Cache Configuration
  cache: {
    ttl: 3600, // 1 hour
    analytics: 1800, // 30 minutes
    templates: 7200, // 2 hours
    agentProfiles: 3600 // 1 hour
  },

  // Feature Flags
  features: {
    abTesting: true,
    agentNetwork: true,
    analytics: true,
    collaborations: true,
    dripSequences: true,
    multiGatewayPayments: true,
    advancedReporting: true
  },

  // Subscription Limits
  limits: {
    starter: {
      leads: 500,
      campaigns: 5,
      templates: 10,
      apiCalls: 1000
    },
    professional: {
      leads: 2000,
      campaigns: 25,
      templates: 50,
      apiCalls: 5000
    },
    enterprise: {
      leads: -1, // unlimited
      campaigns: -1,
      templates: -1,
      apiCalls: -1
    }
  },

  // Backup Configuration
  backup: {
    enabled: true,
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: 30, // days
    s3: {
      bucket: process.env.BACKUP_BUCKET,
      region: process.env.BACKUP_REGION
    }
  },

  // CDN Configuration
  cdn: {
    provider: process.env.CDN_PROVIDER || 'cloudflare',
    url: process.env.CDN_URL,
    apiToken: process.env.CDN_API_TOKEN
  }
};