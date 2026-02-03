const express = require('express');
const router = express.Router();
const lmsService = require('../services/lms');
const { authenticateToken } = require('../middleware/agentAuth');

// Get personalized learning path
router.get('/learning-path', authenticateToken, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const learningPath = await lmsService.getPersonalizedLearningPath(agentId);

    res.json({
      success: true,
      learningPath
    });
  } catch (error) {
    console.error('Get learning path error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learning path',
      error: error.message
    });
  }
});

// Get current learning progress
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const progress = await lmsService.getLearningProgress(agentId);

    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Get learning progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learning progress',
      error: error.message
    });
  }
});

// Record module completion
router.post('/complete-module', authenticateToken, async (req, res) => {
  try {
    const { moduleId, score, timeSpent } = req.body;
    const agentId = req.agent.id;

    if (!moduleId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Module ID and score are required'
      });
    }

    const result = await lmsService.recordModuleCompletion(agentId, moduleId, score, timeSpent || 0);

    res.json({
      success: true,
      message: 'Module completion recorded',
      result
    });
  } catch (error) {
    console.error('Record module completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record module completion',
      error: error.message
    });
  }
});

// Get recommended modules
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { limit = 5 } = req.query;

    const recommendations = await lmsService.getRecommendedModules(agentId, parseInt(limit));

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
});

// Get available modules
router.get('/modules', authenticateToken, async (req, res) => {
  try {
    const { category, difficulty } = req.query;

    let modules = Object.entries(lmsService.modules).map(([id, module]) => ({
      id,
      ...module
    }));

    // Filter by category
    if (category) {
      modules = modules.filter(m => m.category === category);
    }

    // Filter by difficulty
    if (difficulty) {
      modules = modules.filter(m => m.difficulty === difficulty);
    }

    res.json({
      success: true,
      modules
    });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get modules',
      error: error.message
    });
  }
});

// Get module details
router.get('/modules/:moduleId', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const module = lmsService.modules[moduleId];

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Get agent's progress on this module
    const agentId = req.agent.id;
    const progressQuery = await require('../config/database').query(
      'SELECT score, completed_at, time_spent_minutes FROM agent_learning_progress WHERE agent_id = $1 AND module_id = $2',
      [agentId, moduleId]
    );

    const progress = progressQuery.rows[0] || null;

    res.json({
      success: true,
      module: {
        id: moduleId,
        ...module,
        progress
      }
    });
  } catch (error) {
    console.error('Get module details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get module details',
      error: error.message
    });
  }
});

// Get learning analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const analytics = await lmsService.getLearningAnalytics(agentId);

    res.json(analytics);
  } catch (error) {
    console.error('Get learning analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learning analytics',
      error: error.message
    });
  }
});

// Admin: Get system-wide learning analytics
router.get('/analytics/system', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you might want to add role checking)
    const analytics = await lmsService.getLearningAnalytics();

    res.json(analytics);
  } catch (error) {
    console.error('Get system analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system analytics',
      error: error.message
    });
  }
});

// Start learning assessment
router.post('/assessment/start', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.body;
    const agentId = req.agent.id;

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: 'Module ID is required'
      });
    }

    // Create assessment session
    const assessmentId = await createAssessmentSession(agentId, moduleId);

    res.json({
      success: true,
      assessmentId,
      message: 'Assessment started'
    });
  } catch (error) {
    console.error('Start assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start assessment',
      error: error.message
    });
  }
});

// Submit assessment answers
router.post('/assessment/submit', authenticateToken, async (req, res) => {
  try {
    const { assessmentId, answers, timeSpent } = req.body;
    const agentId = req.agent.id;

    if (!assessmentId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'Assessment ID and answers are required'
      });
    }

    const result = await evaluateAssessment(assessmentId, answers, timeSpent);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment',
      error: error.message
    });
  }
});

// Get learning streaks and badges
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const agentId = req.agent.id;

    const achievements = await getAgentAchievements(agentId);

    res.json({
      success: true,
      achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievements',
      error: error.message
    });
  }
});

// Helper functions
async function createAssessmentSession(agentId, moduleId) {
  const { query } = require('../config/database');

  const result = await query(
    `INSERT INTO learning_assessments (agent_id, module_id, started_at)
     VALUES ($1, $2, NOW())
     RETURNING id`,
    [agentId, moduleId]
  );

  return result.rows[0].id;
}

async function evaluateAssessment(assessmentId, answers, timeSpent) {
  const { query } = require('../config/database');

  // Simple scoring logic (you can make this more sophisticated)
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter(a => a.correct).length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  // Update assessment
  await query(
    `UPDATE learning_assessments
     SET answers = $1, score = $2, time_spent_minutes = $3, completed_at = NOW()
     WHERE id = $4`,
    [JSON.stringify(answers), score, timeSpent, assessmentId]
  );

  // Record module completion
  const assessment = await query(
    'SELECT agent_id, module_id FROM learning_assessments WHERE id = $1',
    [assessmentId]
  );

  if (assessment.rows.length > 0) {
    await lmsService.recordModuleCompletion(
      assessment.rows[0].agent_id,
      assessment.rows[0].module_id,
      score,
      timeSpent
    );
  }

  return {
    score,
    totalQuestions,
    correctAnswers,
    passed: score >= 70,
    feedback: score >= 90 ? 'Excellent work!' :
             score >= 70 ? 'Good job! You passed.' :
             'Keep practicing. You can retake this assessment.'
  };
}

async function getAgentAchievements(agentId) {
  const { query } = require('../config/database');

  // Get learning streak
  const streakQuery = await query(`
    SELECT
      COUNT(*) as current_streak,
      MAX(completed_at) as last_completion
    FROM (
      SELECT completed_at,
             ROW_NUMBER() OVER (ORDER BY completed_at) as rn,
             DATE(completed_at) as completion_date
      FROM agent_learning_progress
      WHERE agent_id = $1
      AND completed_at >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY completed_at
    ) t
    WHERE rn = DATE_PART('day', CURRENT_DATE - completion_date::date) + 1
  `, [agentId]);

  const streak = streakQuery.rows[0]?.current_streak || 0;

  // Get total completions
  const totalQuery = await query(
    'SELECT COUNT(*) as total_completed FROM agent_learning_progress WHERE agent_id = $1',
    [agentId]
  );

  const totalCompleted = parseInt(totalQuery.rows[0]?.total_completed) || 0;

  // Calculate badges
  const badges = [];
  if (totalCompleted >= 1) badges.push({ name: 'First Steps', icon: '🎯' });
  if (totalCompleted >= 5) badges.push({ name: 'Learning Enthusiast', icon: '📚' });
  if (totalCompleted >= 10) badges.push({ name: 'Knowledge Seeker', icon: '🧠' });
  if (streak >= 7) badges.push({ name: 'Consistency King', icon: '🔥' });
  if (streak >= 30) badges.push({ name: 'Dedication Master', icon: '👑' });

  return {
    currentStreak: streak,
    totalCompleted,
    badges,
    nextMilestone: getNextMilestone(totalCompleted)
  };
}

function getNextMilestone(currentTotal) {
  const milestones = [1, 5, 10, 25, 50, 100];
  const nextMilestone = milestones.find(m => m > currentTotal);

  if (nextMilestone) {
    return {
      target: nextMilestone,
      remaining: nextMilestone - currentTotal,
      description: `Complete ${nextMilestone} modules to unlock "${getMilestoneBadge(nextMilestone)}"`
    };
  }

  return null;
}

function getMilestoneBadge(milestone) {
  const badges = {
    1: 'First Steps',
    5: 'Learning Enthusiast',
    10: 'Knowledge Seeker',
    25: 'Real Estate Expert',
    50: 'Master Agent',
    100: 'Learning Legend'
  };

  return badges[milestone] || 'Achievement Unlocked';
}

module.exports = router;