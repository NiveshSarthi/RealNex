const { query } = require('../config/database');
const aiService = require('./ai');

class LMSService {
  constructor() {
    this.modules = {
      // Core real estate fundamentals
      real_estate_basics: {
        title: 'Real Estate Fundamentals',
        category: 'core',
        difficulty: 'beginner',
        duration: 120, // minutes
        prerequisites: [],
        skills: ['market_knowledge', 'legal_basics']
      },
      market_analysis: {
        title: 'Market Analysis & Trends',
        category: 'core',
        difficulty: 'intermediate',
        duration: 180,
        prerequisites: ['real_estate_basics'],
        skills: ['market_analysis', 'pricing_strategy']
      },

      // Sales & negotiation
      sales_techniques: {
        title: 'Advanced Sales Techniques',
        category: 'sales',
        difficulty: 'intermediate',
        duration: 240,
        prerequisites: ['real_estate_basics'],
        skills: ['closing_techniques', 'negotiation']
      },
      objection_handling: {
        title: 'Handling Customer Objections',
        category: 'sales',
        difficulty: 'intermediate',
        duration: 150,
        prerequisites: ['sales_techniques'],
        skills: ['communication', 'objection_handling']
      },

      // Communication & marketing
      whatsapp_marketing: {
        title: 'WhatsApp Marketing Mastery',
        category: 'marketing',
        difficulty: 'beginner',
        duration: 90,
        prerequisites: [],
        skills: ['digital_marketing', 'communication']
      },
      social_media_leads: {
        title: 'Social Media Lead Generation',
        category: 'marketing',
        difficulty: 'intermediate',
        duration: 120,
        prerequisites: ['whatsapp_marketing'],
        skills: ['lead_generation', 'social_media']
      },

      // Legal & compliance
      rera_compliance: {
        title: 'RERA Compliance & Legal Framework',
        category: 'legal',
        difficulty: 'intermediate',
        duration: 180,
        prerequisites: ['real_estate_basics'],
        skills: ['legal_compliance', 'documentation']
      },
      property_documents: {
        title: 'Property Documentation & Due Diligence',
        category: 'legal',
        difficulty: 'advanced',
        duration: 240,
        prerequisites: ['rera_compliance'],
        skills: ['documentation', 'due_diligence']
      },

      // Finance & investment
      real_estate_finance: {
        title: 'Real Estate Finance & Loans',
        category: 'finance',
        difficulty: 'intermediate',
        duration: 150,
        prerequisites: ['real_estate_basics'],
        skills: ['financial_planning', 'loan_processing']
      },
      investment_analysis: {
        title: 'Investment Property Analysis',
        category: 'finance',
        difficulty: 'advanced',
        duration: 210,
        prerequisites: ['real_estate_finance', 'market_analysis'],
        skills: ['investment_analysis', 'roi_calculation']
      },

      // Technology & tools
      crm_mastery: {
        title: 'CRM & Lead Management',
        category: 'technology',
        difficulty: 'beginner',
        duration: 120,
        prerequisites: [],
        skills: ['crm_usage', 'lead_management']
      },
      synditech_platform: {
        title: 'SyndiTech Platform Deep Dive',
        category: 'technology',
        difficulty: 'intermediate',
        duration: 180,
        prerequisites: ['crm_mastery'],
        skills: ['platform_expertise', 'automation']
      }
    };
  }

  // Get personalized learning path for agent
  async getPersonalizedLearningPath(agentId) {
    try {
      // Get agent performance data
      const agentData = await this.getAgentPerformanceData(agentId);

      // Get AI analysis of skill gaps
      const skillAnalysis = await aiService.analyzeAgentSkills(agentData);

      // Generate personalized curriculum
      const curriculum = await this.generateCurriculum(agentData, skillAnalysis);

      // Store the learning path
      await this.storeLearningPath(agentId, curriculum);

      return curriculum;
    } catch (error) {
      console.error('Get personalized learning path error:', error);
      return this.getDefaultCurriculum();
    }
  }

  // Get agent performance data for AI analysis
  async getAgentPerformanceData(agentId) {
    try {
      // Get basic agent info
      const agentResult = await query(
        'SELECT * FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agentResult.rows[0];

      // Get performance metrics
      const performanceQuery = `
        SELECT
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE WHEN l.status = 'closed' THEN l.id END) as closed_deals,
          AVG(l.qualification_score) as avg_lead_score,
          COUNT(m.id) as total_messages,
          AVG(EXTRACT(EPOCH FROM (m.created_at - LAG(m.created_at) OVER (ORDER BY m.created_at))) / 60) as avg_response_time,
          COUNT(DISTINCT c.id) as campaigns_run,
          AVG(c.conversion_count::float / NULLIF(c.sent_count, 0)) as avg_campaign_conversion
        FROM agents a
        LEFT JOIN leads l ON l.assigned_agent = a.id
        LEFT JOIN messages m ON m.agent_id = a.id
        LEFT JOIN campaigns c ON c.agent_id = a.id
        WHERE a.id = $1
        AND l.created_at >= NOW() - INTERVAL '90 days'
        AND m.created_at >= NOW() - INTERVAL '90 days'
        AND c.created_at >= NOW() - INTERVAL '90 days'
      `;

      const performanceResult = await query(performanceQuery, [agentId]);
      const performance = performanceResult.rows[0];

      // Get quiz scores and completed modules
      const learningQuery = `
        SELECT
          module_id,
          score,
          completed_at,
          time_spent_minutes
        FROM agent_learning_progress
        WHERE agent_id = $1
        ORDER BY completed_at DESC
      `;

      const learningResult = await query(learningQuery, [agentId]);

      return {
        agent_id: agentId,
        experience_years: agent.experience_years || 0,
        total_deals: agent.total_deals || 0,
        trust_score: agent.trust_score || 0,
        total_leads: parseInt(performance.total_leads) || 0,
        closed_deals: parseInt(performance.closed_deals) || 0,
        conversion_rate: performance.total_leads > 0 ?
          (performance.closed_deals / performance.total_leads) * 100 : 0,
        avg_lead_score: parseFloat(performance.avg_lead_score) || 0,
        total_messages: parseInt(performance.total_messages) || 0,
        avg_response_time: parseFloat(performance.avg_response_time) || 0,
        campaigns_run: parseInt(performance.campaigns_run) || 0,
        avg_campaign_conversion: parseFloat(performance.avg_campaign_conversion) || 0,
        completed_modules: learningResult.rows,
        time_since_joining: Math.floor(
          (Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      };
    } catch (error) {
      console.error('Get agent performance data error:', error);
      throw error;
    }
  }

  // Generate personalized curriculum using AI
  async generateCurriculum(agentData, skillAnalysis) {
    try {
      const prompt = `You are an expert real estate training curriculum designer. Based on the agent's performance data and skill gap analysis, create a personalized 12-week learning plan.

AGENT DATA:
- Experience: ${agentData.experience_years} years
- Total Deals: ${agentData.total_deals}
- Conversion Rate: ${agentData.conversion_rate.toFixed(1)}%
- Average Response Time: ${agentData.avg_response_time.toFixed(0)} minutes
- Completed Modules: ${agentData.completed_modules.length}

SKILL GAPS IDENTIFIED:
${skillAnalysis.skill_gaps?.map(gap => `- ${gap}`).join('\n') || 'None identified'}

AVAILABLE MODULES:
${Object.entries(this.modules).map(([id, module]) =>
  `${id}: ${module.title} (${module.difficulty}, ${module.duration}min, skills: ${module.skills.join(', ')})`
).join('\n')}

REQUIREMENTS:
1. Create a 12-week curriculum with weekly modules
2. Prioritize skill gaps and performance weaknesses
3. Consider experience level and learning pace
4. Include 2-3 modules per week maximum
5. Add practical assignments and assessments
6. Ensure logical progression and prerequisites
7. Include time for practice and application

OUTPUT FORMAT:
{
  "total_weeks": 12,
  "estimated_completion_time": "X hours",
  "focus_areas": ["area1", "area2"],
  "weekly_plan": {
    "week_1": {
      "theme": "Foundation Building",
      "modules": ["module_id1", "module_id2"],
      "estimated_time": "X hours",
      "learning_objectives": ["obj1", "obj2"],
      "practice_assignment": "description"
    },
    "week_2": {...}
  },
  "success_metrics": {
    "target_conversion_improvement": "X%",
    "target_response_time": "X minutes",
    "certification_eligibility": true
  }
}`;

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: 'Create a personalized 12-week curriculum for this agent.'
        }
      ];

      const response = await aiService.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: 2000
      });

      const curriculum = JSON.parse(response.choices[0].message.content);

      // Validate and enhance curriculum
      return this.validateAndEnhanceCurriculum(curriculum, agentData);
    } catch (error) {
      console.error('Generate curriculum error:', error);
      return this.getDefaultCurriculum();
    }
  }

  // Validate and enhance AI-generated curriculum
  validateAndEnhanceCurriculum(curriculum, agentData) {
    // Ensure all modules exist
    const validModules = Object.keys(this.modules);

    for (const week of Object.values(curriculum.weekly_plan || {})) {
      week.modules = week.modules.filter(moduleId => validModules.includes(moduleId));
    }

    // Add module details
    for (const [weekKey, week] of Object.entries(curriculum.weekly_plan || {})) {
      week.module_details = week.modules.map(moduleId => ({
        id: moduleId,
        ...this.modules[moduleId]
      }));
    }

    // Calculate total time
    let totalMinutes = 0;
    for (const week of Object.values(curriculum.weekly_plan || {})) {
      for (const moduleId of week.modules) {
        totalMinutes += this.modules[moduleId]?.duration || 0;
      }
    }

    curriculum.total_estimated_time = `${Math.ceil(totalMinutes / 60)} hours`;
    curriculum.generated_at = new Date().toISOString();
    curriculum.agent_id = agentData.agent_id;

    return curriculum;
  }

  // Get default curriculum for new agents
  getDefaultCurriculum() {
    return {
      total_weeks: 12,
      estimated_completion_time: "24 hours",
      focus_areas: ["real_estate_basics", "sales_techniques", "crm_mastery"],
      weekly_plan: {
        week_1: {
          theme: "Getting Started",
          modules: ["real_estate_basics", "crm_mastery"],
          estimated_time: "4 hours",
          learning_objectives: [
            "Understand real estate fundamentals",
            "Learn CRM basics"
          ],
          practice_assignment: "Set up your first lead in CRM and send a WhatsApp message"
        },
        week_2: {
          theme: "Communication Skills",
          modules: ["whatsapp_marketing", "sales_techniques"],
          estimated_time: "6 hours",
          learning_objectives: [
            "Master WhatsApp marketing",
            "Learn sales techniques"
          ],
          practice_assignment: "Create and send a property catalog to 3 leads"
        }
      },
      success_metrics: {
        target_conversion_improvement: "25%",
        target_response_time: "30 minutes",
        certification_eligibility: true
      }
    };
  }

  // Store learning path in database
  async storeLearningPath(agentId, curriculum) {
    try {
      await query(
        `INSERT INTO agent_learning_paths (agent_id, curriculum_data, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (agent_id) DO UPDATE SET
         curriculum_data = EXCLUDED.curriculum_data,
         updated_at = NOW()`,
        [agentId, JSON.stringify(curriculum)]
      );
    } catch (error) {
      console.error('Store learning path error:', error);
    }
  }

  // Get agent's current learning progress
  async getLearningProgress(agentId) {
    try {
      const result = await query(
        `SELECT curriculum_data, created_at, updated_at
         FROM agent_learning_paths
         WHERE agent_id = $1`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const curriculum = result.rows[0].curriculum_data;

      // Get completed modules
      const progressQuery = `
        SELECT module_id, score, completed_at, time_spent_minutes
        FROM agent_learning_progress
        WHERE agent_id = $1
        ORDER BY completed_at DESC
      `;

      const progressResult = await query(progressQuery, [agentId]);

      return {
        curriculum,
        completed_modules: progressResult.rows,
        completion_percentage: this.calculateCompletionPercentage(curriculum, progressResult.rows)
      };
    } catch (error) {
      console.error('Get learning progress error:', error);
      return null;
    }
  }

  // Calculate completion percentage
  calculateCompletionPercentage(curriculum, completedModules) {
    if (!curriculum?.weekly_plan) return 0;

    const totalModules = Object.values(curriculum.weekly_plan)
      .reduce((sum, week) => sum + (week.modules?.length || 0), 0);

    const completedCount = completedModules.length;

    return totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  }

  // Record module completion
  async recordModuleCompletion(agentId, moduleId, score, timeSpent) {
    try {
      // Validate module exists
      if (!this.modules[moduleId]) {
        throw new Error('Invalid module ID');
      }

      await query(
        `INSERT INTO agent_learning_progress (agent_id, module_id, score, time_spent_minutes, completed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (agent_id, module_id) DO UPDATE SET
         score = GREATEST(EXCLUDED.score, agent_learning_progress.score),
         time_spent_minutes = EXCLUDED.time_spent_minutes,
         completed_at = NOW()`,
        [agentId, moduleId, score, timeSpent]
      );

      // Update agent skills based on module completion
      await this.updateAgentSkills(agentId, moduleId, score);

      return { success: true };
    } catch (error) {
      console.error('Record module completion error:', error);
      throw error;
    }
  }

  // Update agent skills based on learning
  async updateAgentSkills(agentId, moduleId, score) {
    try {
      const module = this.modules[moduleId];
      if (!module) return;

      // Calculate skill improvement based on score
      const skillImprovement = score >= 80 ? 1 : score >= 60 ? 0.5 : 0;

      for (const skill of module.skills) {
        await query(
          `INSERT INTO agent_skills (agent_id, skill_name, proficiency_level, last_updated)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (agent_id, skill_name) DO UPDATE SET
           proficiency_level = LEAST(5.0, agent_skills.proficiency_level + $3),
           last_updated = NOW()`,
          [agentId, skill, skillImprovement]
        );
      }
    } catch (error) {
      console.error('Update agent skills error:', error);
    }
  }

  // Get recommended modules for agent
  async getRecommendedModules(agentId, limit = 5) {
    try {
      const agentData = await this.getAgentPerformanceData(agentId);
      const progress = await this.getLearningProgress(agentId);

      const completedModuleIds = progress?.completed_modules?.map(m => m.module_id) || [];

      // Get AI recommendations
      const recommendations = await this.getAIRecommendations(agentData, completedModuleIds);

      // Filter and rank recommendations
      const availableModules = Object.entries(this.modules)
        .filter(([id, module]) => !completedModuleIds.includes(id))
        .filter(([id, module]) => this.checkPrerequisites(module, completedModuleIds))
        .map(([id, module]) => ({
          id,
          ...module,
          relevance_score: recommendations[id] || 0,
          difficulty_match: this.calculateDifficultyMatch(module.difficulty, agentData.experience_years)
        }))
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, limit);

      return availableModules;
    } catch (error) {
      console.error('Get recommended modules error:', error);
      return [];
    }
  }

  // Get AI-powered recommendations
  async getAIRecommendations(agentData, completedModules) {
    try {
      const prompt = `Based on this agent's performance data, recommend the most relevant learning modules from the available list.

AGENT PERFORMANCE:
- Experience: ${agentData.experience_years} years
- Conversion Rate: ${agentData.conversion_rate.toFixed(1)}%
- Response Time: ${agentData.avg_response_time.toFixed(0)} minutes
- Completed Modules: ${completedModules.join(', ') || 'None'}

AVAILABLE MODULES: ${Object.keys(this.modules).join(', ')}

Return a JSON object with module IDs as keys and relevance scores (0-100) as values. Focus on modules that address performance gaps.`;

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: 'Recommend the most relevant modules for this agent.'
        }
      ];

      const response = await aiService.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.2,
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Get AI recommendations error:', error);
      // Return default recommendations
      return {
        sales_techniques: 85,
        objection_handling: 80,
        market_analysis: 75,
        whatsapp_marketing: 70
      };
    }
  }

  // Check if agent meets prerequisites
  checkPrerequisites(module, completedModules) {
    if (!module.prerequisites || module.prerequisites.length === 0) {
      return true;
    }

    return module.prerequisites.every(prereq => completedModules.includes(prereq));
  }

  // Calculate difficulty match score
  calculateDifficultyMatch(difficulty, experienceYears) {
    const difficultyLevels = { beginner: 1, intermediate: 2, advanced: 3 };
    const experienceLevel = Math.min(3, Math.floor(experienceYears / 2) + 1);

    const diff = Math.abs(difficultyLevels[difficulty] - experienceLevel);
    return Math.max(0, 100 - (diff * 25)); // Higher score for better match
  }

  // Get learning analytics
  async getLearningAnalytics(agentId = null) {
    try {
      let queryText, values;

      if (agentId) {
        queryText = `
          SELECT
            COUNT(DISTINCT alp.agent_id) as agents_count,
            AVG(alp.score) as avg_score,
            COUNT(alp.id) as completions_count,
            AVG(alp.time_spent_minutes) as avg_time_spent,
            COUNT(DISTINCT alp.module_id) as unique_modules_completed
          FROM agent_learning_progress alp
          WHERE alp.agent_id = $1
        `;
        values = [agentId];
      } else {
        queryText = `
          SELECT
            COUNT(DISTINCT alp.agent_id) as agents_count,
            AVG(alp.score) as avg_score,
            COUNT(alp.id) as completions_count,
            AVG(alp.time_spent_minutes) as avg_time_spent,
            COUNT(DISTINCT alp.module_id) as unique_modules_completed,
            COUNT(DISTINCT CASE WHEN alp.score >= 80 THEN alp.id END) as high_performers
          FROM agent_learning_progress alp
        `;
        values = [];
      }

      const result = await query(queryText, values);

      return {
        success: true,
        analytics: result.rows[0],
        period: agentId ? 'agent_lifetime' : 'all_agents'
      };
    } catch (error) {
      console.error('Get learning analytics error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new LMSService();