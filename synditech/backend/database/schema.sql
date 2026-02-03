-- SyndiTech Intelligence System Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table (real estate agents using SyndiTech)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    business_name VARCHAR(255),
    location VARCHAR(255),
    experience_years INTEGER,
    specializations TEXT[], -- Array of property types they specialize in
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    subscription_status VARCHAR(50) DEFAULT 'trial',
    subscription_start DATE,
    subscription_end DATE,
    is_active BOOLEAN DEFAULT true,
    aadhaar_verified BOOLEAN DEFAULT false,
    trust_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 5.00
    total_deals INTEGER DEFAULT 0,
    total_commission DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table (potential buyers/sellers)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    location VARCHAR(255),
    budget_min DECIMAL(15,2),
    budget_max DECIMAL(15,2),
    property_type VARCHAR(100),
    requirements TEXT,
    source VARCHAR(100) DEFAULT 'whatsapp', -- whatsapp, referral, website, etc.
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, interested, qualified, closed, lost
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    assigned_agent UUID REFERENCES agents(id),
    lead_score INTEGER DEFAULT 0, -- 0-100
    last_contact TIMESTAMP WITH TIME ZONE,
    next_followup TIMESTAMP WITH TIME ZONE,
    tags TEXT[],
    custom_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties table (inventory management)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    property_id VARCHAR(100) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    property_type VARCHAR(100) NOT NULL, -- apartment, villa, plot, commercial
    transaction_type VARCHAR(50) DEFAULT 'sale', -- sale, rent, lease
    price DECIMAL(15,2),
    price_per_sqft DECIMAL(10,2),
    area_sqft DECIMAL(10,2),
    bedrooms INTEGER,
    bathrooms INTEGER,
    floor INTEGER,
    total_floors INTEGER,
    furnishing VARCHAR(50), -- furnished, semi-furnished, unfurnished
    parking BOOLEAN DEFAULT false,
    amenities TEXT[], -- Array of amenities
    location_address TEXT,
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_pincode VARCHAR(10),
    location_coordinates POINT, -- PostgreSQL point type for lat/lng
    builder_name VARCHAR(255),
    project_name VARCHAR(255),
    possession_date DATE,
    age_years INTEGER,
    status VARCHAR(50) DEFAULT 'available', -- available, sold, blocked, under_contract
    featured BOOLEAN DEFAULT false,
    images TEXT[], -- Array of image URLs
    virtual_tour_url TEXT,
    documents TEXT[], -- Array of document URLs
    tags TEXT[],
    views_count INTEGER DEFAULT 0,
    inquiries_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (WhatsApp conversation history)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    whatsapp_message_id VARCHAR(255),
    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    message_type VARCHAR(50) DEFAULT 'text', -- text, image, video, audio, document
    content TEXT,
    media_url TEXT,
    media_filename VARCHAR(255),
    media_caption TEXT,
    status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table (WhatsApp marketing campaigns)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) DEFAULT 'bulk', -- bulk, drip, automated
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, completed, paused
    target_audience JSONB, -- Filters for target leads
    message_template TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    -- A/B Testing fields
    is_ab_test BOOLEAN DEFAULT false,
    test_percentage INTEGER DEFAULT 50, -- Percentage of audience for test variants
    variants JSONB, -- Array of test variants with name and message_template
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign messages (individual messages sent in campaigns)
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    lead_id UUID NOT NULL REFERENCES leads(id),
    whatsapp_message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed, responded
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    response_content TEXT,
    -- A/B Testing fields
    variant VARCHAR(50), -- 'control', 'variant_1', 'variant_2', etc.
    variant_name VARCHAR(255), -- Name of the variant for display
    conversion BOOLEAN DEFAULT false, -- Whether this message led to a conversion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent collaborations (network feature)
CREATE TABLE collaborations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    primary_agent UUID NOT NULL REFERENCES agents(id), -- Agent who owns the lead
    collaborating_agent UUID NOT NULL REFERENCES agents(id), -- Agent helping
    collaboration_type VARCHAR(50) DEFAULT 'referral', -- referral, co-broking, joint_venture
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, active, completed, cancelled
    commission_split DECIMAL(5,2), -- Percentage for collaborating agent
    deal_value DECIMAL(15,2),
    deal_status VARCHAR(50), -- won, lost, pending
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lead_id, primary_agent, collaborating_agent)
);

-- Agent network (professional connections)
CREATE TABLE agent_network (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    connected_agent_id UUID NOT NULL REFERENCES agents(id),
    connection_type VARCHAR(50) DEFAULT 'professional', -- professional, personal, mentor
    status VARCHAR(50) DEFAULT 'pending', -- pending, connected, blocked
    trust_level INTEGER DEFAULT 1, -- 1-5 trust rating
    shared_leads_count INTEGER DEFAULT 0,
    successful_deals_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, connected_agent_id),
    CHECK (agent_id != connected_agent_id)
);

-- Templates table (message templates)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id), -- NULL for system templates
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general', -- greeting, follow_up, closing, property_info
    content TEXT NOT NULL,
    variables JSONB, -- Available variables like {{name}}, {{property_name}}
    language VARCHAR(10) DEFAULT 'en',
    is_system BOOLEAN DEFAULT false, -- System-provided templates
    is_approved BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Catalog Items (property listings)
CREATE TABLE catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    retailer_id VARCHAR(255) UNIQUE NOT NULL, -- WhatsApp catalog product ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'INR',
    image_url TEXT,
    property_url TEXT,
    category VARCHAR(100), -- apartment, villa, plot, commercial
    location VARCHAR(255),
    bhk INTEGER, -- bedrooms
    area_sqft DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'available', -- available, sold, blocked
    availability VARCHAR(20) DEFAULT 'in stock',
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quick Replies (chatbot suggestions)
CREATE TABLE quick_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES agents(id), -- References agents for now
    title VARCHAR(255) NOT NULL, -- Display title like "🏠 Search Properties"
    action VARCHAR(100) NOT NULL, -- Action identifier like "property_search"
    category VARCHAR(50) DEFAULT 'general', -- navigation, tools, support, information
    "order" INTEGER DEFAULT 0, -- Display order
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, action)
);

-- Drip sequences (automated follow-up sequences)
CREATE TABLE drip_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100), -- lead_created, message_received, property_inquiry
    is_active BOOLEAN DEFAULT false,
    steps JSONB, -- Array of sequence steps with delays and messages
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead activities (tracking all interactions)
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    agent_id UUID REFERENCES agents(id),
    activity_type VARCHAR(100) NOT NULL, -- message_sent, call_made, meeting_scheduled, property_shown
    description TEXT,
    metadata JSONB, -- Additional data like property_id, campaign_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table (subscription and commission payments)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    payment_type VARCHAR(50) NOT NULL, -- subscription, commission, referral
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    gateway VARCHAR(50), -- razorpay, payu, etc.
    gateway_transaction_id VARCHAR(255),
    description TEXT,
    related_id UUID, -- Could reference collaboration, campaign, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events (for reporting and insights)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    lead_id UUID REFERENCES leads(id),
    campaign_id UUID REFERENCES campaigns(id),
    property_id UUID REFERENCES properties(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System logs (for monitoring and debugging)
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL, -- error, warn, info
    message TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_agent ON leads(assigned_agent);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_properties_agent ON properties(agent_id);
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_location ON properties(location_city);
CREATE INDEX idx_messages_lead ON messages(lead_id);
CREATE INDEX idx_campaigns_agent ON campaigns(agent_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_agents_whatsapp ON agents(whatsapp_number);
CREATE INDEX idx_agents_subscription ON agents(subscription_tier, subscription_status);
CREATE INDEX idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX idx_activities_agent ON lead_activities(agent_id);

-- AI Analyses table (store AI analysis results)
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_type VARCHAR(100) NOT NULL, -- lead_qualification, drip_content, skill_analysis, etc.
    input_data JSONB, -- Original input data
    result_data JSONB, -- AI analysis results
    entity_id UUID NOT NULL, -- ID of the entity being analyzed (lead, agent, etc.)
    entity_type VARCHAR(50) NOT NULL, -- lead, agent, property, etc.
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions table (track n8n workflow runs)
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type VARCHAR(100) NOT NULL, -- lead_qualification, drip_campaign, commission_calculation, meta_ads_integration
    input_data JSONB, -- Data sent to workflow
    output_data JSONB, -- Data returned from workflow
    status VARCHAR(50) DEFAULT 'completed', -- completed, failed, running
    execution_time_ms INTEGER, -- How long the workflow took
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commissions table (calculated commission breakdowns)
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID, -- Reference to deal (if exists)
    agent_id UUID NOT NULL REFERENCES agents(id),
    amount DECIMAL(15,2) NOT NULL,
    breakdown JSONB, -- Detailed commission breakdown
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid, disputed
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Drip messages table (automated follow-up messages)
CREATE TABLE drip_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    message TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id),
    campaign_id UUID REFERENCES campaigns(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed
    response_received BOOLEAN DEFAULT false,
    response_content TEXT,
    responded_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced leads table with AI qualification fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'warm';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_range VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_locations TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_types TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timeline VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Agent learning paths table (AI-generated personalized curricula)
CREATE TABLE agent_learning_paths (
    agent_id UUID NOT NULL REFERENCES agents(id),
    curriculum_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (agent_id)
);

-- Agent learning progress table (module completions)
CREATE TABLE agent_learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    module_id VARCHAR(100) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    time_spent_minutes INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent skills table (skill proficiency tracking)
CREATE TABLE agent_skills (
    agent_id UUID NOT NULL REFERENCES agents(id),
    skill_name VARCHAR(100) NOT NULL,
    proficiency_level DECIMAL(3,2) DEFAULT 0.00 CHECK (proficiency_level >= 0 AND proficiency_level <= 5),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (agent_id, skill_name)
);

-- Learning assessments table (quiz/test sessions)
CREATE TABLE learning_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    module_id VARCHAR(100) NOT NULL,
    answers JSONB,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    time_spent_minutes INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for AI and workflow tables
CREATE INDEX idx_ai_analyses_entity ON ai_analyses(entity_id, entity_type);
CREATE INDEX idx_ai_analyses_type ON ai_analyses(analysis_type);
CREATE INDEX idx_workflow_executions_type ON workflow_executions(workflow_type);
CREATE INDEX idx_commissions_agent ON commissions(agent_id);
CREATE INDEX idx_drip_messages_lead ON drip_messages(lead_id);
CREATE INDEX idx_leads_qualification ON leads(qualification_score, urgency);

-- Indexes for LMS tables
CREATE INDEX idx_agent_learning_progress_agent ON agent_learning_progress(agent_id);
CREATE INDEX idx_agent_learning_progress_module ON agent_learning_progress(module_id);
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX idx_learning_assessments_agent ON learning_assessments(agent_id);

-- Insert default system templates
INSERT INTO templates (name, category, content, variables, language, is_system) VALUES
('Welcome Message', 'greeting', 'Hi {{name}}! 👋\n\nThank you for reaching out. I''m {{agent_name}} from {{agency_name}}. I help people find their perfect property in {{city}}.\n\nWhat type of property are you looking for?\n🏠 Apartment\n🏘️ Villa\n🏢 Commercial\n🏞️ Plot', '{"name": "Lead name", "agent_name": "Agent name", "agency_name": "Agency name", "city": "City name"}', 'en', true),
('Property Inquiry Response', 'property_info', 'Great choice! 📍\n\n{{property_name}}\n📍 Location: {{location}}\n💰 Price: ₹{{price}}\n🏠 {{bedrooms}} BHK | {{area}} sq.ft\n\nWould you like to:\n✅ Schedule a site visit\n📋 Get detailed brochure\n💬 Ask questions', '{"property_name": "Property title", "location": "Property location", "price": "Property price", "bedrooms": "Number of bedrooms", "area": "Area in sq.ft"}', 'en', true),
('Follow-up Message', 'follow_up', 'Hi {{name}}! 👋\n\nI wanted to follow up on your interest in properties in {{location}}. We have some exciting new listings that match your requirements.\n\nAre you still looking for a {{property_type}} in your budget range?\n\nBest regards,\n{{agent_name}}', '{"name": "Lead name", "location": "Location", "property_type": "Property type", "agent_name": "Agent name"}', 'en', true);