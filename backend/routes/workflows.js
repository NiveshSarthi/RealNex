const express = require('express');
const n8nService = require('../services/n8n');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/workflows/execute/:workflowId
// @desc    Execute a workflow
// @access  Private
router.post('/execute/:workflowId', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const data = req.body;

    const result = await n8nService.executeWorkflow(workflowId, data);

    if (result.success) {
      // Log execution in database
      await query(
        'INSERT INTO workflow_executions (workflow_id, execution_id, status, input_data, triggered_by) VALUES ($1, $2, $3, $4, $5)',
        [workflowId, result.executionId, 'running', JSON.stringify(data), req.user.id]
      );

      res.json({
        success: true,
        executionId: result.executionId,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to execute workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Execute workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/workflows/test/:workflowId
// @desc    Test execute a workflow
// @access  Private
router.post('/test/:workflowId', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const data = req.body;

    const result = await n8nService.executeTestWebhook(workflowId, data);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to test workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Test workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/workflows/execution/:executionId
// @desc    Get workflow execution status
// @access  Private
router.get('/execution/:executionId', authenticate, async (req, res) => {
  try {
    const { executionId } = req.params;

    const result = await n8nService.getExecutionStatus(executionId);

    if (result.success) {
      // Update database status
      const status = result.data.status;
      const completedAt = result.data.stoppedAt ? new Date(result.data.stoppedAt) : null;

      await query(
        'UPDATE workflow_executions SET status = $1, completed_at = $2, output_data = $3 WHERE execution_id = $4',
        [status, completedAt, JSON.stringify(result.data), executionId]
      );

      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get execution status',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get execution status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/workflows
// @desc    List workflows from DB
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM workflows WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.user.organizationId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      details: error.message
    });
  }
});

// @route   GET /api/workflows/:workflowId
// @desc    Get workflow details
// @access  Private
router.get('/:workflowId', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const result = await n8nService.getWorkflow(workflowId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/workflows
// @desc    Create a new workflow in n8n
// @access  Private
// @route   POST /api/workflows
// @desc    Create a new workflow in n8n
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const workflowData = req.body;
    console.log('Creating workflow for user:', req.user.id, 'Org:', req.user.organizationId);
    console.log('Workflow Data:', JSON.stringify(workflowData));

    const result = await n8nService.createWorkflow(workflowData);
    console.log('n8n Create Result:', JSON.stringify(result));

    if (result.success) {
      // Save to our database
      try {
        await query(
          'INSERT INTO workflows (organization_id, name, description, n8n_workflow_id, status, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [req.user.organizationId, workflowData.name, workflowData.settings?.description || '', result.workflowId, 'draft', req.user.id]
        );
      } catch (dbError) {
        console.error('Database Insertion Error:', dbError);
        throw dbError; // Re-throw to be caught by outer catch
      }

      res.status(201).json({
        success: true,
        workflowId: result.workflowId,
        data: result.data
      });
    } else {
      console.error('n8n Service Failed:', result.error);
      res.status(500).json({
        success: false,
        message: 'Failed to create workflow in n8n',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      details: error.message
    });
  }
});

// @route   PUT /api/workflows/:workflowId
// @desc    Update workflow
// @access  Private
router.put('/:workflowId', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowData = req.body;

    const result = await n8nService.updateWorkflow(workflowId, workflowData);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/workflows/:workflowId
// @desc    Delete workflow
// @access  Private
router.delete('/:workflowId', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const result = await n8nService.deleteWorkflow(workflowId);

    if (result.success) {
      // Remove from our database
      await query('DELETE FROM workflows WHERE n8n_workflow_id = $1', [workflowId]);

      res.json({
        success: true,
        message: 'Workflow deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/workflows/:workflowId/activate
// @desc    Activate workflow
// @access  Private
router.post('/:workflowId/activate', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const result = await n8nService.activateWorkflow(workflowId);

    if (result.success) {
      // Update our database
      await query('UPDATE workflows SET status = $1 WHERE n8n_workflow_id = $2', ['active', workflowId]);

      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to activate workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Activate workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/workflows/:workflowId/deactivate
// @desc    Deactivate workflow
// @access  Private
router.post('/:workflowId/deactivate', authenticate, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const result = await n8nService.deactivateWorkflow(workflowId);

    if (result.success) {
      // Update our database
      await query('UPDATE workflows SET status = $1 WHERE n8n_workflow_id = $2', ['inactive', workflowId]);

      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate workflow',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Deactivate workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/workflows/executions/history
// @desc    Get workflow execution history
// @access  Private
router.get('/executions/history', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT we.*, w.name as workflow_name, u.first_name, u.last_name
      FROM workflow_executions we
      JOIN workflows w ON we.workflow_id = w.id
      LEFT JOIN users u ON we.triggered_by = u.id
      ORDER BY we.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get execution history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;