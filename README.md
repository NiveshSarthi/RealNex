# SyndiTech Intelligence System

A comprehensive WhatsApp-based CRM platform for real estate agents, featuring advanced marketing automation, lead management, analytics, and agent collaboration tools.

## 🚀 Features

### Core Features
- **WhatsApp Business API Integration** - Send and receive messages through WhatsApp
- **Lead Management** - Advanced lead tracking with scoring and segmentation
- **Campaign Management** - Bulk messaging with A/B testing capabilities
- **Template System** - Reusable message templates with variable substitution
- **Drip Sequences** - Automated follow-up campaigns
- **Agent Collaboration** - Professional networking and lead sharing
- **Analytics Dashboard** - Comprehensive reporting and insights
- **Payment Integration** - Multiple Indian payment gateways (Razorpay, PayU, Cashfree)

### Advanced Features
- **A/B Testing** - Test different message variants for optimization
- **Agent Network** - Connect with other real estate professionals
- **Commission Tracking** - Automated commission calculations for collaborations
- **Real-time Analytics** - Live performance monitoring
- **Automated Backups** - Scheduled database and file backups
- **Multi-environment Support** - Development, staging, and production configurations

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js framework
- **PostgreSQL** database with advanced querying
- **Redis** for caching and session management
- **RabbitMQ** for message queuing
- **JWT** authentication with role-based access control

### Frontend
- **Next.js 14** with React 18
- **Tailwind CSS** for responsive styling
- **TypeScript** for type safety
- **Recharts** for data visualization

### DevOps & Deployment
- **Docker** & Docker Compose for containerization
- **Nginx** reverse proxy with SSL termination
- **Automated backups** with cloud storage integration
- **Health monitoring** and logging
- **Multi-environment** configuration management

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Docker)
- Redis (if not using Docker)
- WhatsApp Business API account
- Payment gateway accounts (Razorpay/PayU/Cashfree)

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/synditech.git
   cd synditech
   ```

2. **Environment Configuration**
   ```bash
   cp .env.development .env
   # Edit .env with your configuration
   ```

3. **Start Development Environment**
   ```bash
   # Start all services
   docker-compose --profile development up -d

   # Or for production-like setup
   docker-compose --profile production up -d
   ```

4. **Database Setup**
   ```bash
   # Initialize database
   ./scripts/migrate.sh init development

   # Run migrations
   ./scripts/migrate.sh migrate development
   ```

5. **Install Dependencies & Start Services**
   ```bash
   # Backend
   cd backend
   npm install
   npm run dev

   # Frontend (new terminal)
   cd ../frontend
   npm install
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - pgAdmin: http://localhost:5050
   - Redis Commander: http://localhost:8081

## 📖 API Documentation

### Authentication
```bash
# Login
POST /api/agents/login
{
  "whatsappNumber": "+919876543210",
  "password": "your_password"
}

# Register
POST /api/agents/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "whatsappNumber": "+919876543210",
  "businessName": "Real Estate Pro",
  "password": "your_password"
}
```

### Leads Management
```bash
# Get leads
GET /api/leads?page=1&limit=20&search=john&status=new

# Create lead
POST /api/leads
{
  "name": "Jane Smith",
  "phone": "+919876543211",
  "email": "jane@example.com",
  "location": "Mumbai",
  "budgetMin": 5000000,
  "budgetMax": 10000000
}
```

### Campaign Management
```bash
# Create campaign
POST /api/campaigns
{
  "name": "New Property Launch",
  "messageTemplate": "Hi {{name}}, check out our new property in {{location}}!",
  "targetAudience": {
    "location": "Mumbai",
    "budgetMin": 5000000
  },
  "isABTest": true,
  "variants": [
    {
      "name": "Version A",
      "messageTemplate": "Hi {{name}}, exciting news! New property in {{location}}."
    }
  ]
}
```

## 🏗️ Project Structure

```
synditech/
├── backend/                 # Node.js/Express API server
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic services
│   ├── database/          # Schema and migrations
│   └── utils/             # Utility functions
├── frontend/               # Next.js React application
│   ├── components/        # Reusable React components
│   ├── pages/            # Next.js pages
│   ├── contexts/         # React contexts
│   ├── utils/            # Frontend utilities
│   └── styles/           # CSS and styling
├── scripts/               # Deployment and utility scripts
├── nginx/                # Nginx configuration
├── docker-compose.yml    # Docker Compose configuration
├── .env.development      # Development environment variables
├── .env.production       # Production environment variables
└── README.md            # This file
```

## 🚀 Deployment

### Production Deployment

1. **Configure Environment**
   ```bash
   cp .env.production .env
   # Edit with production values
   ```

2. **Build and Deploy**
   ```bash
   # Build and deploy
   ./scripts/deploy.sh production deploy

   # Or step by step
   ./scripts/deploy.sh production build
   ./scripts/deploy.sh production deploy
   ```

3. **SSL Configuration**
   ```bash
   # Place SSL certificates in nginx/ssl/
   cp your_certificate.crt nginx/ssl/synditech.crt
   cp your_private_key.key nginx/ssl/synditech.key
   ```

4. **Backup Setup**
   ```bash
   # Create initial backup
   ./scripts/backup.sh create full

   # List backups
   ./scripts/backup.sh list
   ```

### Environment Variables

#### Required for Production
```bash
# Database
DB_HOST=your_db_host
DB_PASSWORD=strong_production_password

# WhatsApp API
WHATSAPP_ACCESS_TOKEN=your_production_token
WHATSAPP_PHONE_NUMBER_ID=your_production_number_id

# Payment Gateways
RAZORPAY_KEY_ID=your_production_razorpay_key
RAZORPAY_KEY_SECRET=your_production_razorpay_secret

# Security
JWT_SECRET=64_character_random_string

# Email
SENDGRID_API_KEY=your_production_sendgrid_key
```

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check all services
curl http://your-domain.com/health

# API health
curl http://your-api.com/api/monitoring/health
```

### Backup Operations
```bash
# Create backup
./scripts/backup.sh create full

# List backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore full
```

### Logs
```bash
# View application logs
docker-compose logs -f backend

# View nginx logs
docker-compose logs -f nginx
```

## 🔧 Development

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Code Quality
```bash
# Lint code
cd backend && npm run lint
cd frontend && npm run lint

# Format code
cd backend && npm run format
cd frontend && npm run format
```

### Database Operations
```bash
# Create new migration
./scripts/migrate.sh create add_new_feature development

# Run migrations
./scripts/migrate.sh migrate development

# Check migration status
./scripts/migrate.sh status development
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions
- **Email**: support@synditech.com

## 🗺️ Roadmap

### Phase 7: Advanced AI Features
- AI-powered lead scoring
- Automated response suggestions
- Smart campaign optimization

### Phase 8: Mobile App
- React Native mobile application
- Push notifications
- Offline functionality

### Phase 9: Integration Ecosystem
- Third-party CRM integrations
- Property portal APIs
- Social media automation

---

**SyndiTech** - Revolutionizing real estate marketing through intelligent WhatsApp automation.