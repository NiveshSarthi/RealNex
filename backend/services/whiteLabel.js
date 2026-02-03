const { query } = require('../config/database');

class WhiteLabelService {
  // Get white-label configuration for organization
  async getWhiteLabelConfig(organizationId) {
    try {
      const result = await query(
        'SELECT * FROM white_label_configs WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) {
        // Return default configuration
        return this.getDefaultConfig();
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting white-label config:', error);
      return this.getDefaultConfig();
    }
  }

  // Update white-label configuration
  async updateWhiteLabelConfig(organizationId, config) {
    try {
      const fields = [];
      const values = [organizationId];
      let paramCount = 2;

      // Build dynamic update query
      Object.keys(config).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(config[key]);
        paramCount++;
      });

      values.push(organizationId);

      const result = await query(`
        INSERT INTO white_label_configs (organization_id, ${Object.keys(config).join(', ')})
        VALUES ($1, ${Object.keys(config).map((_, i) => `$${i + 2}`).join(', ')})
        ON CONFLICT (organization_id)
        DO UPDATE SET ${fields.join(', ')}, updated_at = NOW()
        RETURNING *
      `, values);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating white-label config:', error);
      throw error;
    }
  }

  // Get default white-label configuration
  getDefaultConfig() {
    return {
      organization_id: null,
      company_name: 'WhatsApp Automation Platform',
      logo_url: '/default-logo.png',
      favicon_url: '/favicon.ico',
      primary_color: '#6c5ce7',
      secondary_color: '#00d4ff',
      accent_color: '#00f593',
      font_family: 'Inter, sans-serif',
      custom_domain: null,
      custom_css: '',
      hide_platform_branding: false,
      custom_email_templates: false,
      custom_login_page: false,
      custom_dashboard_title: 'Dashboard',
      support_email: 'support@platform.com',
      support_phone: '+91-XXXXXXXXXX',
      privacy_policy_url: '/privacy-policy',
      terms_of_service_url: '/terms-of-service',
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Generate custom CSS for white-label
  generateCustomCSS(config) {
    return `
      :root {
        --wl-primary-color: ${config.primary_color};
        --wl-secondary-color: ${config.secondary_color};
        --wl-accent-color: ${config.accent_color};
        --wl-font-family: ${config.font_family};
      }

      .wl-branding {
        font-family: var(--wl-font-family);
      }

      .wl-primary-bg {
        background-color: var(--wl-primary-color);
      }

      .wl-primary-text {
        color: var(--wl-primary-color);
      }

      .wl-secondary-bg {
        background-color: var(--wl-secondary-color);
      }

      .wl-accent-bg {
        background-color: var(--wl-accent-color);
      }

      ${config.custom_css || ''}
    `;
  }

  // Get custom email template
  async getCustomEmailTemplate(organizationId, templateType) {
    try {
      const result = await query(`
        SELECT * FROM email_templates
        WHERE organization_id = $1 AND template_type = $2
      `, [organizationId, templateType]);

      if (result.rows.length === 0) {
        return this.getDefaultEmailTemplate(templateType);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting email template:', error);
      return this.getDefaultEmailTemplate(templateType);
    }
  }

  // Get default email template
  getDefaultEmailTemplate(templateType) {
    const templates = {
      welcome: {
        subject: 'Welcome to {{company_name}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to {{company_name}}!</h1>
            <p>Thank you for joining our platform. We're excited to help you automate your business communications.</p>
            <div style="background: {{primary_color}}; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Get Started</h3>
              <p>Login to your dashboard and start setting up your first automation.</p>
              <a href="{{login_url}}" style="background: {{secondary_color}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login Now</a>
            </div>
          </div>
        `
      },
      appointment_reminder: {
        subject: 'Appointment Reminder - {{company_name}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Appointment Reminder</h2>
            <p>Hi {{customer_name}},</p>
            <p>This is a reminder for your upcoming appointment:</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>{{appointment_type}}</h3>
              <p><strong>Date:</strong> {{appointment_date}}</p>
              <p><strong>Time:</strong> {{appointment_time}}</p>
              <p><strong>Location:</strong> {{appointment_location}}</p>
            </div>
            <p>See you soon!</p>
            <p>Best regards,<br>{{company_name}} Team</p>
          </div>
        `
      }
    };

    return templates[templateType] || templates.welcome;
  }

  // Update email template
  async updateEmailTemplate(organizationId, templateType, subject, html) {
    try {
      const result = await query(`
        INSERT INTO email_templates (organization_id, template_type, subject, html_content)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (organization_id, template_type)
        DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, updated_at = NOW()
        RETURNING *
      `, [organizationId, templateType, subject, html]);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating email template:', error);
      throw error;
    }
  }

  // Get custom mobile app configuration
  async getMobileAppConfig(organizationId) {
    try {
      const result = await query(
        'SELECT * FROM mobile_app_configs WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return this.getDefaultMobileAppConfig();
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting mobile app config:', error);
      return this.getDefaultMobileAppConfig();
    }
  }

  // Get default mobile app configuration
  getDefaultMobileAppConfig() {
    return {
      organization_id: null,
      app_name: 'Business Chat',
      app_icon_url: '/default-app-icon.png',
      splash_screen_color: '#6c5ce7',
      primary_color: '#6c5ce7',
      secondary_color: '#00d4ff',
      custom_splash_text: 'Loading...',
      enable_push_notifications: true,
      enable_offline_mode: false,
      custom_features: [],
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Update mobile app configuration
  async updateMobileAppConfig(organizationId, config) {
    try {
      const fields = [];
      const values = [organizationId];
      let paramCount = 2;

      Object.keys(config).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(config[key]);
        paramCount++;
      });

      values.push(organizationId);

      const result = await query(`
        INSERT INTO mobile_app_configs (organization_id, ${Object.keys(config).join(', ')})
        VALUES ($1, ${Object.keys(config).map((_, i) => `$${i + 2}`).join(', ')})
        ON CONFLICT (organization_id)
        DO UPDATE SET ${fields.join(', ')}, updated_at = NOW()
        RETURNING *
      `, values);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating mobile app config:', error);
      throw error;
    }
  }

  // Check if organization has white-label access
  async hasWhiteLabelAccess(organizationId) {
    try {
      const result = await query(`
        SELECT s.tier FROM subscriptions s
        WHERE s.organization_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1
      `, [organizationId]);

      if (result.rows.length === 0) return false;

      const tier = result.rows[0].tier;
      return ['business', 'enterprise'].includes(tier);
    } catch (error) {
      console.error('Error checking white-label access:', error);
      return false;
    }
  }

  // Generate white-label preview
  generatePreview(config) {
    return {
      logo: config.logo_url,
      colors: {
        primary: config.primary_color,
        secondary: config.secondary_color,
        accent: config.accent_color
      },
      branding: {
        companyName: config.company_name,
        hidePlatformBranding: config.hide_platform_branding
      },
      customCSS: this.generateCustomCSS(config)
    };
  }
}

module.exports = new WhiteLabelService();