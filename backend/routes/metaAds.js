const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Mock Data Store
let campaigns = [
    { id: 'cam_1', name: 'Luxury Villas Promo', status: 'ACTIVE', objective: 'LEADS', spend: 4500, clicks: 120, leads: 15, impressions: 12000, ctr: 1.0, cpc: 37.5 },
    { id: 'cam_2', name: 'Budget Homes', status: 'PAUSED', objective: 'TRAFFIC', spend: 1200, clicks: 45, leads: 2, impressions: 5000, ctr: 0.9, cpc: 26.6 },
    { id: 'cam_3', name: 'Retargeting - Site Visitors', status: 'ACTIVE', objective: 'CONVERSIONS', spend: 2100, clicks: 88, leads: 9, impressions: 9000, ctr: 0.97, cpc: 23.8 },
    { id: 'cam_4', name: 'Brand Awareness', status: 'COMPLETED', objective: 'AWARENESS', spend: 10000, clicks: 500, leads: 5, impressions: 150000, ctr: 0.33, cpc: 20.0 }
];

const adAccounts = [
    { id: 'act_101', name: 'Synditech Real Estate', currency: 'INR', status: 'ACTIVE' },
    { id: 'act_102', name: 'Synditech Luxury', currency: 'USD', status: 'ACTIVE' }
];

// @route   GET /api/meta-ads/campaigns
// @desc    Get Meta Ads campaigns
router.get('/campaigns', authenticate, async (req, res) => {
    res.json({
        success: true,
        data: campaigns
    });
});

// @route   POST /api/meta-ads/campaigns
// @desc    Create a new campaign
router.post('/campaigns', authenticate, async (req, res) => {
    const { name, objective, dailyBudget, adAccount } = req.body;

    // Simulate Meta API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const newCampaign = {
        id: `cam_${Date.now()}`,
        name,
        objective,
        status: 'ACTIVE', // Default to active for simulation
        spend: 0,
        clicks: 0,
        leads: 0,
        impressions: 0,
        ctr: 0,
        cpc: 0,
        dailyBudget,
        adAccount,
        createdAt: new Date()
    };

    campaigns.unshift(newCampaign); // Add to beginning

    res.json({
        success: true,
        data: newCampaign,
        message: 'Campaign created successfully via Meta Marketing API'
    });
});

// @route   GET /api/meta-ads/campaign-performance/:id
// @desc    Get detailed performance metrics for a specific campaign
router.get('/campaign-performance/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const campaign = campaigns.find(c => c.id === id);

    if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Simulate generating granular insights
    const insights = {
        ...campaign,
        dailyBreakdown: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            spend: Math.floor(Math.random() * (campaign.spend / 10)) + 500,
            clicks: Math.floor(Math.random() * 20),
            leads: Math.floor(Math.random() * 3)
        })).reverse(),
        demographics: {
            age: [
                { range: '18-24', percentage: 15 },
                { range: '25-34', percentage: 45 },
                { range: '35-44', percentage: 25 },
                { range: '45+', percentage: 15 }
            ],
            gender: [
                { type: 'Male', percentage: 60 },
                { type: 'Female', percentage: 40 }
            ]
        }
    };

    res.json({
        success: true,
        data: insights
    });
});

// @route   GET /api/meta-ads/ad-accounts
// @desc    Get connected Ad Accounts
router.get('/ad-accounts', authenticate, async (req, res) => {
    res.json({
        success: true,
        data: adAccounts
    });
});

module.exports = router;
