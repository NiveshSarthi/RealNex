-- WhatsApp Automation Platform Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    industry VARCHAR(100),
    size VARCHAR(50),
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    organization_id UUID REFERENCES organizations(id),
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    phone_verification_code VARCHAR(10),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Business Accounts
CREATE TABLE whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    business_account_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    display_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    verified BOOLEAN DEFAULT false,
    webhook_url TEXT,
    webhook_verify_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table (Multi-channel support)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    contact_id VARCHAR(255) NOT NULL, -- Universal contact identifier (phone, user_id, etc.)
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp', -- whatsapp, telegram, instagram, facebook, sms
    whatsapp_number VARCHAR(20), -- Keep for backward compatibility
    phone VARCHAR(20),
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_picture_url TEXT,
    tags TEXT[], -- Array of tags
    custom_fields JSONB, -- Flexible custom fields
    engagement_score INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contact_id, channel, organization_id)
);

-- Conversations table (Multi-channel support)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_account_id UUID REFERENCES whatsapp_accounts(id), -- Optional for non-WhatsApp
    whatsapp_conversation_id VARCHAR(255), -- Keep for backward compatibility
    contact_id UUID NOT NULL REFERENCES contacts(id),
    assigned_to UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'open', -- open, closed, pending
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp', -- whatsapp, telegram, instagram, facebook, sms
    external_conversation_id VARCHAR(255), -- Universal external conversation ID
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (Multi-channel support)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    contact_id VARCHAR(255), -- Universal contact identifier
    whatsapp_message_id VARCHAR(255), -- Keep for backward compatibility
    external_message_id VARCHAR(255), -- Universal external message ID
    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp', -- whatsapp, telegram, instagram, facebook, sms
    message_type VARCHAR(50) DEFAULT 'text', -- text, image, video, document, audio
    content TEXT,
    media_caption TEXT,
    media_filename VARCHAR(255),
    status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    leader_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- n8n Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    n8n_workflow_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, inactive, archived
    trigger_type VARCHAR(100), -- webhook, schedule, event
    trigger_config JSONB,
    is_template BOOLEAN DEFAULT false,
    template_category VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    execution_id VARCHAR(255), -- n8n execution ID
    status VARCHAR(50) DEFAULT 'running', -- running, success, failed, stopped
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    triggered_by UUID REFERENCES users(id)
);

-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id), -- NULL for global templates
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- message, workflow, broadcast
    category VARCHAR(100),
    content JSONB, -- Template content/structure
    variables JSONB, -- Available variables
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    language VARCHAR(10) DEFAULT 'en',
    is_global BOOLEAN DEFAULT false, -- System templates
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Broadcast campaigns
CREATE TABLE broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id UUID REFERENCES templates(id),
    audience_filters JSONB, -- Filters for target audience
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, completed, cancelled
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Broadcast recipients
CREATE TABLE broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    UNIQUE(broadcast_id, contact_id)
);

-- Analytics events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES contacts(id),
    conversation_id UUID REFERENCES conversations(id),
    workflow_id UUID REFERENCES workflows(id),
    broadcast_id UUID REFERENCES broadcasts(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(50) UNIQUE NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    features JSONB, -- Feature limits and permissions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, suspended
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    stripe_subscription_id VARCHAR(255),
    razorpay_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real Estate specific tables
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    property_id VARCHAR(100) UNIQUE,
    seller_id UUID REFERENCES contacts(id),
    type VARCHAR(50) NOT NULL, -- apartment, villa, plot, etc.
    status VARCHAR(50) DEFAULT 'available', -- available, sold, blocked
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB, -- address, city, coordinates
    price DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'INR',
    specifications JSONB, -- bedrooms, bathrooms, area, etc.
    amenities TEXT[],
    images TEXT[],
    virtual_tour_url TEXT,
    documents TEXT[],
    tags TEXT[],
    featured BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buyer profiles
CREATE TABLE buyer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    buyer_id UUID REFERENCES contacts(id),
    preferences JSONB, -- property types, budget, location, specifications
    engagement_score INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property matches
CREATE TABLE property_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    match_score DECIMAL(5,2), -- 0-100
    match_reasons JSONB,
    notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site visits
CREATE TABLE site_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    buyer_id UUID REFERENCES contacts(id),
    agent_id UUID REFERENCES users(id),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    visit_type VARCHAR(50) DEFAULT 'in_person', -- in_person, virtual
    notes TEXT,
    feedback JSONB,
    follow_up_required BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments (Advanced Scheduling System)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    agent_id UUID REFERENCES users(id),
    property_id UUID REFERENCES properties(id),
    appointment_type VARCHAR(50) NOT NULL, -- site_visit, consultation_call, documentation_meeting, property_handover
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, completed, cancelled, no_show
    visitor_count INTEGER DEFAULT 1,
    location TEXT,
    notes TEXT,
    special_requirements TEXT,
    meeting_link TEXT, -- For virtual meetings
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_2h_sent BOOLEAN DEFAULT false,
    reminder_30m_sent BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    feedback_rating INTEGER, -- 1-5
    feedback_comments TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_contact ON messages(contact_id);
CREATE INDEX idx_contacts_organization ON contacts(organization_id);
CREATE INDEX idx_contacts_channel ON contacts(channel);
CREATE INDEX idx_contacts_contact_id ON contacts(contact_id);
CREATE INDEX idx_workflows_organization ON workflows(organization_id);
CREATE INDEX idx_broadcasts_organization ON broadcasts(organization_id);
CREATE INDEX idx_analytics_organization ON analytics_events(organization_id);
CREATE INDEX idx_properties_organization ON properties(organization_id);
CREATE INDEX idx_buyer_profiles_organization ON buyer_profiles(organization_id);
CREATE INDEX idx_property_matches_property ON property_matches(property_id);
CREATE INDEX idx_property_matches_buyer ON property_matches(buyer_profile_id);
CREATE INDEX idx_site_visits_property ON site_visits(property_id);
CREATE INDEX idx_site_visits_buyer ON site_visits(buyer_id);
CREATE INDEX idx_appointments_contact ON appointments(contact_id);
CREATE INDEX idx_appointments_agent ON appointments(agent_id);
CREATE INDEX idx_appointments_property ON appointments(property_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- White-label configurations
CREATE TABLE white_label_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    company_name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#6c5ce7',
    secondary_color VARCHAR(7) DEFAULT '#00d4ff',
    accent_color VARCHAR(7) DEFAULT '#00f593',
    font_family VARCHAR(255) DEFAULT 'Inter, sans-serif',
    custom_domain VARCHAR(255),
    custom_css TEXT,
    hide_platform_branding BOOLEAN DEFAULT false,
    custom_email_templates BOOLEAN DEFAULT false,
    custom_login_page BOOLEAN DEFAULT false,
    custom_dashboard_title VARCHAR(255) DEFAULT 'Dashboard',
    support_email VARCHAR(255),
    support_phone VARCHAR(20),
    privacy_policy_url TEXT,
    terms_of_service_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Email templates for white-label
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id), -- NULL for global templates
    template_type VARCHAR(100) NOT NULL, -- welcome, appointment_reminder, etc.
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    variables JSONB, -- Available template variables
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, template_type)
);



-- Indexes for white-label tables
CREATE INDEX idx_white_label_configs_org ON white_label_configs(organization_id);
CREATE INDEX idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);
CREATE INDEX idx_mobile_app_configs_org ON mobile_app_configs(organization_id);

-- Advanced Analytics tables
CREATE TABLE custom_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL, -- Report configuration
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES custom_reports(id),
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly
    schedule_time TIME NOT NULL,
    recipients JSONB NOT NULL, -- Array of email addresses
    format VARCHAR(50) DEFAULT 'pdf', -- pdf, excel, csv
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    insight_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(50) DEFAULT 'medium', -- low, medium, high
    confidence DECIMAL(3,2), -- AI confidence score
    data JSONB, -- Additional insight data
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for advanced analytics
CREATE INDEX idx_custom_reports_org ON custom_reports(organization_id);
CREATE INDEX idx_scheduled_reports_report ON scheduled_reports(report_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX idx_ai_insights_org ON ai_insights(organization_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at);

-- API Marketplace tables
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id VARCHAR(255) UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    api_key TEXT NOT NULL,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events JSONB DEFAULT '[]',
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id VARCHAR(255) NOT NULL REFERENCES webhooks(webhook_id),
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- success, failed
    status_code INTEGER,
    error_message TEXT,
    payload JSONB,
    response_data JSONB,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id VARCHAR(255) NOT NULL REFERENCES api_keys(key_id),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER, -- in milliseconds
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for API marketplace
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX idx_webhooks_webhook_id ON webhooks(webhook_id);
CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_delivered ON webhook_logs(delivered_at);
CREATE INDEX idx_api_logs_key ON api_logs(key_id);
CREATE INDEX idx_api_logs_created ON api_logs(created_at);

-- Mobile App tables
CREATE TABLE mobile_app_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    app_name VARCHAR(255) NOT NULL,
    app_icon_url TEXT,
    splash_screen_color VARCHAR(7) DEFAULT '#6c5ce7',
    primary_color VARCHAR(7) DEFAULT '#6c5ce7',
    secondary_color VARCHAR(7) DEFAULT '#00d4ff',
    accent_color VARCHAR(7) DEFAULT '#00f593',
    custom_splash_text VARCHAR(255) DEFAULT 'Loading...',
    enable_push_notifications BOOLEAN DEFAULT true,
    enable_offline_mode BOOLEAN DEFAULT false,
    enable_biometric_auth BOOLEAN DEFAULT false,
    enable_location_tracking BOOLEAN DEFAULT false,
    custom_features JSONB DEFAULT '[]',
    supported_languages JSONB DEFAULT '["en"]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE TABLE mobile_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_token TEXT NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- ios, android
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_model VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_ids JSONB NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    device_count INTEGER NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mobile_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    device_type VARCHAR(50),
    app_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for mobile app
CREATE INDEX idx_mobile_app_configs_org ON mobile_app_configs(organization_id);
CREATE INDEX idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX idx_mobile_devices_token ON mobile_devices(device_token);
CREATE INDEX idx_mobile_devices_active ON mobile_devices(is_active);
CREATE INDEX idx_push_notifications_sent ON push_notifications(sent_at);
CREATE INDEX idx_mobile_analytics_user ON mobile_analytics(user_id);
CREATE INDEX idx_mobile_analytics_event ON mobile_analytics(event_type);
CREATE INDEX idx_mobile_analytics_created ON mobile_analytics(created_at);

-- Enterprise features tables
CREATE TABLE sso_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sso_type VARCHAR(50) NOT NULL DEFAULT 'saml', -- saml, oauth, ldap
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE TABLE ip_whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    ip_address INET NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, ip_address)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(50) UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    category VARCHAR(50) DEFAULT 'general',
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    satisfaction_rating INTEGER, -- 1-5
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    rules JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Indexes for enterprise features
CREATE INDEX idx_sso_configs_org ON sso_configs(organization_id);
CREATE INDEX idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_data_retention_org ON data_retention_policies(organization_id);
CREATE INDEX idx_monitoring_alerts_org ON monitoring_alerts(organization_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, tier, price_monthly, price_yearly, features) VALUES
('Starter', 'starter', 29, 290, '{
  "whatsapp_numbers": 1,
  "conversations_monthly": 1000,
  "automation_flows": 5,
  "team_members": 2,
  "crm_integration": true,
  "analytics": "basic"
}'),
('Professional', 'professional', 99, 990, '{
  "whatsapp_numbers": 3,
  "conversations_monthly": 10000,
  "automation_flows": 25,
  "team_members": 10,
  "crm_integration": true,
  "analytics": "advanced",
  "custom_fields": true
}'),
('Business', 'business', 299, 2990, '{
  "whatsapp_numbers": 10,
  "conversations_monthly": 50000,
  "automation_flows": -1,
  "team_members": 50,
  "crm_integration": true,
  "analytics": "advanced",
  "api_access": true,
  "white_label": true
}'),
('Enterprise', 'enterprise', NULL, NULL, '{
  "whatsapp_numbers": -1,
  "conversations_monthly": -1,
  "automation_flows": -1,
  "team_members": -1,
  "crm_integration": true,
  "analytics": "advanced",
  "api_access": true,
  "white_label": true,
  "custom_integrations": true,
  "dedicated_support": true
}');