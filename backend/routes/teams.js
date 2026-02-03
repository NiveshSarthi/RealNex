const express = require('express');
const Team = require('../models/Team');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/teams
// @desc    Get all teams for user's organization
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const teams = await Team.findByOrganizationId(req.user.organization_id);

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/teams/:id
// @desc    Get team by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user belongs to the same organization
    if (team.organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this team'
      });
    }

    const members = await team.getMembers();

    res.json({
      success: true,
      data: {
        ...team.toJSON(),
        members
      }
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/teams
// @desc    Create new team
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, leaderId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required'
      });
    }

    const team = await Team.create({
      organizationId: req.user.organization_id,
      name,
      description,
      leaderId
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, leaderId } = req.body;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user belongs to the same organization
    if (team.organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this team'
      });
    }

    await team.update({
      name,
      description,
      leaderId
    });

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user belongs to the same organization
    if (team.organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this team'
      });
    }

    await team.delete();

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/teams/:id/members
// @desc    Add member to team
// @access  Private
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user belongs to the same organization
    if (team.organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this team'
      });
    }

    await team.addMember(userId, role);

    res.json({
      success: true,
      message: 'Member added to team successfully'
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove member from team
// @access  Private
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const { id, userId } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user belongs to the same organization
    if (team.organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this team'
      });
    }

    await team.removeMember(userId);

    res.json({
      success: true,
      message: 'Member removed from team successfully'
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;