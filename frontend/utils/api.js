import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const isAuthRequest = error.config?.url?.includes('/api/auth/me');

    if (error.response?.status === 401) {
      // Only redirect if it's not the initial profile check failing (which checkAuth handles)
      // or if it's a definitive "token invalid" message
      const message = error.response.data?.message || '';
      const isTokenInvalid = message.toLowerCase().includes('token') ||
        message.toLowerCase().includes('expired') ||
        message.toLowerCase().includes('session');

      if (isTokenInvalid && typeof window !== 'undefined' && window.location.pathname !== '/') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  getProfile: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/update-profile', data),
};

// Dashboard API
export const dashboardAPI = {
  getOverview: () => api.get('/api/analytics/overview'),
};

// Leads API
export const leadsAPI = {
  getLeads: (params) => api.get('/api/leads', { params }),
  getLead: (id) => api.get(`/api/leads/${id}`),
  createLead: (data) => api.post('/api/leads', data),
  updateLead: (id, data) => api.put(`/api/leads/${id}`, data),
  deleteLead: (id) => api.delete(`/api/leads/${id}`),
  getLeadStats: () => api.get('/api/leads/stats/overview'),
  importLeads: (data) => api.post('/api/leads/import', data),
};

// Campaigns API
// Campaigns API (mapped to Broadcasts backend)
export const campaignsAPI = {
  getCampaigns: (params) => api.get('/api/broadcasts', { params }),
  getCampaign: (id) => api.get(`/api/broadcasts/${id}`),
  createCampaign: (data) => api.post('/api/broadcasts', data),
  updateCampaign: (id, data) => api.put(`/api/broadcasts/${id}`, data),
  deleteCampaign: (id) => api.delete(`/api/broadcasts/${id}`),
  sendCampaign: (id) => api.post(`/api/broadcasts/${id}/send`),
  getAudience: (id, params) => api.get(`/api/broadcasts/${id}/recipients`, { params }), // Endpoint name diff
  getAudienceSize: (id) => api.post(`/api/broadcasts/${id}/audience-size`), // Method/path diff check
  getPerformance: (id) => api.get(`/api/broadcasts/${id}/performance`), // Might not exist
  getABTestResults: (id) => api.get(`/api/broadcasts/${id}/ab-test-results`), // Might not exist
  getStats: () => api.get('/api/broadcasts/stats/overview'),
  preview: (data) => api.post('/api/broadcasts/preview', data), // Might not exist
};

// Templates API
export const templatesAPI = {
  getTemplates: (params) => api.get('/api/templates', { params }),
  getTemplate: (id) => api.get(`/api/templates/${id}`),
  createTemplate: (data) => api.post('/api/templates', data),
  updateTemplate: (id, data) => api.put(`/api/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/api/templates/${id}`),
  previewTemplate: (id, data) => api.post(`/api/templates/${id}/preview`, data),
  getCategories: () => api.get('/api/templates/categories'),
};

// Drip Sequences API
export const dripSequencesAPI = {
  getSequences: (params) => api.get('/api/drip-sequences', { params }),
  getSequence: (id) => api.get(`/api/drip-sequences/${id}`),
  createSequence: (data) => api.post('/api/drip-sequences', data),
  updateSequence: (id, data) => api.put(`/api/drip-sequences/${id}`, data),
  deleteSequence: (id) => api.delete(`/api/drip-sequences/${id}`),
  activateSequence: (id) => api.post(`/api/drip-sequences/${id}/activate`),
  deactivateSequence: (id) => api.post(`/api/drip-sequences/${id}/deactivate`),
  addStep: (id, data) => api.post(`/api/drip-sequences/${id}/steps`, data),
  updateStep: (id, stepIndex, data) => api.put(`/api/drip-sequences/${id}/steps/${stepIndex}`, data),
  removeStep: (id, stepIndex) => api.delete(`/api/drip-sequences/${id}/steps/${stepIndex}`),
  previewSequence: (id, data) => api.post(`/api/drip-sequences/${id}/preview`, data),
  triggerSequence: (data) => api.post('/api/drip-sequences/trigger', data),
  getTriggerEvents: () => api.get('/api/drip-sequences/trigger-events/list'),
  getStats: () => api.get('/api/drip-sequences/stats/overview'),
};

// Network API
export const networkAPI = {
  getNetwork: (params) => api.get('/api/network', { params }),
  getRequests: (params) => api.get('/api/network/requests', { params }),
  connect: (agentId, data) => api.post(`/api/network/connect/${agentId}`, data),
  acceptRequest: (connectionId) => api.post(`/api/network/accept/${connectionId}`),
  rejectRequest: (connectionId) => api.post(`/api/network/reject/${connectionId}`),
  removeConnection: (agentId) => api.delete(`/api/network/${agentId}`),
  blockAgent: (agentId) => api.post(`/api/network/block/${agentId}`),
  searchAgents: (params) => api.get('/api/network/search', { params }),
  getRecommendations: (params) => api.get('/api/network/recommendations', { params }),
  getStats: () => api.get('/api/network/stats'),
  getProfile: (agentId) => api.get(`/api/network/${agentId}/profile`),
  getMutualConnections: (agentId) => api.get(`/api/network/${agentId}/mutual`),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => api.get('/api/analytics/dashboard'),
  getOverview: () => api.get('/api/analytics/overview'),
  getConversationAnalytics: (params) => api.get('/api/analytics/conversations', { params }),
  getMessageAnalytics: (params) => api.get('/api/analytics/messages', { params }),
  getContactAnalytics: () => api.get('/api/analytics/contacts'),
  getCampaignAnalytics: (params) => api.get('/api/analytics/campaigns', { params }),
  getLeadAnalytics: (params) => api.get('/api/analytics/leads', { params }),
  getRevenueAnalytics: (params) => api.get('/api/analytics/revenue', { params }),
  getGeographicAnalytics: () => api.get('/api/analytics/geographic'),
  getABTestAnalytics: (params) => api.get('/api/analytics/ab-tests', { params }),
  getNetworkAnalytics: () => api.get('/api/analytics/network'),
  getPerformanceComparison: () => api.get('/api/analytics/performance-comparison'),
  getActivityFeed: (params) => api.get('/api/analytics/activity', { params }),
  getCustomAnalytics: (data) => api.post('/api/analytics/custom', data),
  exportAnalytics: (params) => api.get('/api/analytics/export', { params }),
};

// Payments API
// Payments API (mapped to Subscriptions backend)
export const paymentsAPI = {
  getPlans: () => api.get('/api/subscriptions/plans'),
  getCurrentSubscription: () => api.get('/api/subscriptions/my'),
  createSubscription: (data) => api.post('/api/subscriptions', data),
  getHistory: (params) => api.get('/api/subscriptions/my/history', { params }), // Assuming history endpoint exists or needs creation
  getStats: () => api.get('/api/subscriptions/my/stats'), // Assuming stats endpoint exists
  verifyPayment: (gateway, data) => api.post(`/api/subscriptions/verify/${gateway}`, data),
  getInvoice: (paymentId) => api.get(`/api/subscriptions/invoices/${paymentId}`),
  getMethods: () => api.get('/api/subscriptions/methods'),
};

// WhatsApp API
export const whatsappAPI = {
  sendMessage: (data) => api.post('/api/whatsapp/send', data),
  getMessages: (params) => api.get('/api/whatsapp/messages', { params }),
  getStats: () => api.get('/api/whatsapp/stats'),
};

// Catalog API
export const catalogAPI = {
  getItems: (params) => api.get('/api/catalog', { params }),
  getItem: (id) => api.get(`/api/catalog/${id}`),
  createItem: (data) => api.post('/api/catalog', data),
  updateItem: (id, data) => api.put(`/api/catalog/${id}`, data),
  deleteItem: (id) => api.delete(`/api/catalog/${id}`),
  findMatches: (requirements) => api.post('/api/catalog/match', { requirements }),
  shareMatches: (phone, requirements) => api.post('/api/catalog/share', { phone, requirements }),
  bulkImport: (items) => api.post('/api/catalog/bulk-import', { items }),
  syncToWhatsApp: (id) => api.post(`/api/catalog/${id}/sync`),
  getStats: () => api.get('/api/catalog/stats/overview'),
};

// Quick Replies API
export const quickRepliesAPI = {
  getReplies: (params) => api.get('/api/quick-replies', { params }),
  getReply: (id) => api.get(`/api/quick-replies/${id}`),
  createReply: (data) => api.post('/api/quick-replies', data),
  updateReply: (id, data) => api.put(`/api/quick-replies/${id}`, data),
  deleteReply: (id) => api.delete(`/api/quick-replies/${id}`),
  setupDefaults: () => api.post('/api/quick-replies/setup-defaults'),
  processShortcut: (message) => api.post('/api/quick-replies/process', { message }),
  bulkCreate: (replies) => api.post('/api/quick-replies/bulk-create', { replies }),
  getCategories: () => api.get('/api/quick-replies/categories'),
  getStats: () => api.get('/api/quick-replies/stats/overview'),
  getTemplates: () => api.get('/api/quick-replies/templates'),
};

// Workflows API
export const workflowsAPI = {
  getWorkflows: () => api.get('/api/workflows'),
  createWorkflow: (data) => api.post('/api/workflows', data),
  activateWorkflow: (id) => api.post(`/api/workflows/${id}/activate`),
  deactivateWorkflow: (id) => api.post(`/api/workflows/${id}/deactivate`),
  triggerLeadQualification: (data) => api.post('/api/workflows/trigger/lead-qualification', data),
  triggerDripCampaign: (data) => api.post('/api/workflows/trigger/drip-campaign', data),
  triggerCommissionCalculation: (data) => api.post('/api/workflows/trigger/commission-calculation', data),
  triggerMetaAdsIntegration: (data) => api.post('/api/workflows/trigger/meta-ads-integration', data),
  getHistory: (params) => api.get('/api/workflows/history', { params }),
  testConnection: (workflowType) => api.post(`/api/workflows/test/${workflowType}`),
  getStats: () => api.get('/api/workflows/stats'),
};

// Meta Ads API
export const metaAdsAPI = {
  getCampaigns: () => api.get('/api/meta-ads/campaigns'),
  createCampaign: (data) => api.post('/api/meta-ads/campaigns', data),
  sendMessage: (data) => api.post('/api/meta-ads/send-message', data),
  getCampaignPerformance: (campaignId, dateRange) => api.get(`/api/meta-ads/campaign-performance/${campaignId}`, { params: { dateRange } }),
  getAdAccounts: () => api.get('/api/meta-ads/ad-accounts'),
  testConnection: () => api.post('/api/meta-ads/test-connection'),
  getLeads: (params) => api.get('/api/meta-ads/leads', { params }),
  getAnalytics: (params) => api.get('/api/meta-ads/analytics', { params }),
};

// Real Estate API
export const realEstateAPI = {
  getProperties: (params) => api.get('/api/real-estate/properties', { params }),
  getProperty: (id) => api.get(`/api/real-estate/properties/${id}`),
  createProperty: (data) => api.post('/api/real-estate/properties', data),
  updateProperty: (id, data) => api.put(`/api/real-estate/properties/${id}`, data),
  deleteProperty: (id) => api.delete(`/api/real-estate/properties/${id}`),
  getMatches: (id) => api.get(`/api/real-estate/properties/${id}/matches`),
  getInquiries: (id, params) => api.get(`/api/real-estate/properties/${id}/inquiries`, { params }),

  // Buyer Profiles
  getBuyerProfiles: (params) => api.get('/api/real-estate/buyer-profiles', { params }),
  getBuyerProfile: (id) => api.get(`/api/real-estate/buyer-profiles/${id}`),
  createBuyerProfile: (data) => api.post('/api/real-estate/buyer-profiles', data),
  updateBuyerProfile: (id, data) => api.put(`/api/real-estate/buyer-profiles/${id}`, data),
  getRecommendations: (id, params) => api.get(`/api/real-estate/buyer-profiles/${id}/recommendations`, { params }),

  // Matching
  autoMatch: (propertyId) => api.post('/api/real-estate/matching/auto-match', { propertyId }),
  searchProperties: (data) => api.post('/api/real-estate/matching/search', data),
  bulkMatch: () => api.post('/api/real-estate/matching/bulk-match'),

  // Site Visits
  getSiteVisits: (params) => api.get('/api/real-estate/site-visits', { params }),
  getSiteVisit: (id) => api.get(`/api/real-estate/site-visits/${id}`),
  scheduleSiteVisit: (data) => api.post('/api/real-estate/site-visits', data),
  updateSiteVisit: (id, data) => api.put(`/api/real-estate/site-visits/${id}`, data),
  completeSiteVisit: (id, data) => api.post(`/api/real-estate/site-visits/${id}/complete`, data),

  // Stats
  getStats: () => api.get('/api/real-estate/stats/overview'),
};

// LMS API
export const lmsAPI = {
  getLearningPath: () => api.get('/api/lms/learning-path'),
  getProgress: () => api.get('/api/lms/progress'),
  completeModule: (data) => api.post('/api/lms/complete-module', data),
  getRecommendations: (params) => api.get('/api/lms/recommendations', { params }),
  getModules: (params) => api.get('/api/lms/modules', { params }),
  getModule: (moduleId) => api.get(`/api/lms/modules/${moduleId}`),
  getAnalytics: () => api.get('/api/lms/analytics'),
  startAssessment: (data) => api.post('/api/lms/assessment/start', data),
  submitAssessment: (data) => api.post('/api/lms/assessment/submit', data),
  getAchievements: () => api.get('/api/lms/achievements'),
};

// AI API
export const aiAPI = {
  qualifyLead: (data) => api.post('/api/ai/qualify', data),
  generateDripContent: (data) => api.post('/api/ai/drip-content', data),
  analyzeSkills: (data) => api.post('/api/ai/analyze-skills', data),
  optimizePrices: (data) => api.post('/api/ai/optimize-prices', data),
  matchProperties: (data) => api.post('/api/ai/match-properties', data),
  analyzeSentiment: (data) => api.post('/api/ai/analyze-sentiment', data),
  predictDealClosure: (data) => api.post('/api/ai/predict-closure', data),
  personalizeContent: (data) => api.post('/api/ai/personalize-content', data),
  getAnalysisHistory: (params) => api.get('/api/ai/analysis-history', { params }),
};

// Monitoring API
export const monitoringAPI = {
  getHealth: () => api.get('/api/monitoring/health'),
  getMetrics: () => api.get('/api/monitoring/metrics'),
  getLogs: (data) => api.post('/api/monitoring/logs', data),
};

// White-label API
export const whiteLabelAPI = {
  getConfig: () => api.get('/api/white-label/config'),
  updateConfig: (data) => api.put('/api/white-label/config', data),
  getPreview: () => api.get('/api/white-label/preview'),
  checkAccess: () => api.get('/api/white-label/access'),
  getEmailTemplate: (type) => api.get(`/api/white-label/email-templates/${type}`),
  updateEmailTemplate: (type, data) => api.put(`/api/white-label/email-templates/${type}`, data),
  getMobileAppConfig: () => api.get('/api/white-label/mobile-app'),
  updateMobileAppConfig: (data) => api.put('/api/white-label/mobile-app', data),
  getTemplateVariables: () => api.get('/api/white-label/template-variables'),
};

// Advanced Analytics API
export const advancedAnalyticsAPI = {
  predictConversion: (data) => api.post('/api/advanced-analytics/predict-conversion', data),
  createCustomReport: (data) => api.post('/api/advanced-analytics/reports/custom', data),
  getCustomReports: (params) => api.get('/api/advanced-analytics/reports/custom', { params }),
  getCustomReport: (id) => api.get(`/api/advanced-analytics/reports/custom/${id}`),
  updateCustomReport: (id, data) => api.put(`/api/advanced-analytics/reports/custom/${id}`, data),
  deleteCustomReport: (id) => api.delete(`/api/advanced-analytics/reports/custom/${id}`),
  scheduleReport: (data) => api.post('/api/advanced-analytics/reports/schedule', data),
  getScheduledReports: () => api.get('/api/advanced-analytics/reports/scheduled'),
  generateInsights: (params) => api.get('/api/advanced-analytics/insights', { params }),
  getUnreadInsightsCount: () => api.get('/api/advanced-analytics/insights/unread-count'),
  markInsightAsRead: (id) => api.put(`/api/advanced-analytics/insights/${id}/read`),
  getReportTemplates: () => api.get('/api/advanced-analytics/report-templates'),
  exportReport: (reportId, format) => api.get(`/api/advanced-analytics/export/${reportId}`, {
    params: { format },
    responseType: 'blob'
  }),
};

// API Marketplace API
export const apiMarketplaceAPI = {
  // API Keys
  generateAPIKey: (data) => api.post('/api/marketplace/keys', data),
  getAPIKeys: () => api.get('/api/marketplace/keys'),
  revokeAPIKey: (keyId) => api.delete(`/api/marketplace/keys/${keyId}`),

  // Webhooks
  registerWebhook: (data) => api.post('/api/marketplace/webhooks', data),
  getWebhooks: () => api.get('/api/marketplace/webhooks'),
  updateWebhook: (webhookId, data) => api.put(`/api/marketplace/webhooks/${webhookId}`, data),
  deleteWebhook: (webhookId) => api.delete(`/api/marketplace/webhooks/${webhookId}`),
  getWebhookLogs: (webhookId, params) => api.get(`/api/marketplace/webhooks/${webhookId}/logs`, { params }),

  // SDKs and Documentation
  getSDKs: () => api.get('/api/marketplace/sdks'),
  getAPIDocs: () => api.get('/api/marketplace/docs'),
  getAPIEndpoints: () => api.get('/api/marketplace/docs/endpoints'),

  // Usage and Analytics
  getAPIUsage: (params) => api.get('/api/marketplace/usage', { params }),
  testAPIKey: () => api.post('/api/marketplace/test'),
};

// Mobile App API
export const mobileAppAPI = {
  // Configuration
  getConfig: () => api.get('/api/mobile/config'),
  updateConfig: (data) => api.put('/api/mobile/config', data),
  generateConfig: () => api.get('/api/mobile/config/generate'),

  // Dashboard
  getDashboard: () => api.get('/api/mobile/dashboard'),

  // Device Management
  registerDevice: (data) => api.post('/api/mobile/device/register', data),

  // Push Notifications
  sendPushNotification: (data) => api.post('/api/mobile/push/send', data),

  // Offline Support
  getOfflineData: () => api.get('/api/mobile/offline-data'),
  syncOfflineChanges: (data) => api.post('/api/mobile/sync', data),

  // Analytics
  trackUsage: (data) => api.post('/api/mobile/analytics/track', data),
  getAnalytics: (params) => api.get('/api/mobile/analytics', { params }),

  // App Store
  getAppStoreInfo: () => api.get('/api/mobile/app-store'),

  // Mobile-specific features
  getQuickActions: () => api.get('/api/mobile/quick-actions'),
  getRecentConversations: (params) => api.get('/api/mobile/conversations/recent', { params }),
  searchContacts: (params) => api.get('/api/mobile/contacts/search', { params }),
  sendMessage: (data) => api.post('/api/mobile/messages/send', data),
};