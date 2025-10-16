const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const User = require('../models/User');

// Create a new poll (Admin only)
const createPoll = async (req, res) => {
  try {
    const {
      title,
      description,
      candidates = [],
      assignedUsers = [],
      startDate,
      endDate,
      allowNewCandidates = true,
      maxVotesPerUser = 1,
      isAnonymous = false
    } = req.body;

    // Validate input
    if (!title || !description || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Title, description, start date, and end date are required'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start < now) {
      return res.status(400).json({
        message: 'Start date cannot be in the past'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        message: 'End date must be after start date'
      });
    }

    // Validate assigned users exist
    if (assignedUsers.length > 0) {
      const users = await User.findAll();
      const userIds = users.map(u => u._id.toString());
      const invalidUsers = assignedUsers.filter(userId => !userIds.includes(userId));
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({
          message: 'Some assigned users do not exist',
          invalidUsers
        });
      }
    }

    const pollData = {
      title,
      description,
      candidates,
      assignedUsers,
      createdBy: req.user._id,
      startDate: start,
      endDate: end,
      allowNewCandidates,
      maxVotesPerUser,
      isAnonymous,
      status: 'draft'
    };

    const poll = await Poll.createPoll(pollData);
    const populatedPoll = await Poll.findById(poll._id);

    res.status(201).json({
      message: 'Poll created successfully',
      poll: populatedPoll
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({
      message: 'Server error creating poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all polls (Admin only)
const getAllPolls = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, createdBy } = req.query;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      createdBy
    };

    const result = await Poll.getAllPolls(options);

    res.json({
      message: 'Polls retrieved successfully',
      ...result
    });
  } catch (error) {
    console.error('Get all polls error:', error);
    res.status(500).json({
      message: 'Server error retrieving polls',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get polls assigned to current user
const getUserPolls = async (req, res) => {
  try {
    const { includeEnded = false, status } = req.query;
    const options = {
      includeEnded: includeEnded === 'true',
      status
    };

    const polls = await Poll.getUserPolls(req.user._id, options);

    // Add voting status for each poll
    const pollsWithVoteStatus = await Promise.all(
      polls.map(async (poll) => {
        const hasVoted = await Vote.hasUserVotedInPoll(req.user._id, poll._id);
        const userVote = hasVoted ? await Vote.getUserVoteInPoll(req.user._id, poll._id) : null;
        
        return {
          ...poll.toObject(),
          hasVoted,
          userVote: userVote ? {
            candidateName: userVote.candidateName,
            timestamp: userVote.timestamp,
            isCustomCandidate: userVote.isCustomCandidate
          } : null
        };
      })
    );

    res.json({
      message: 'User polls retrieved successfully',
      polls: pollsWithVoteStatus,
      total: polls.length
    });
  } catch (error) {
    console.error('Get user polls error:', error);
    res.status(500).json({
      message: 'Server error retrieving user polls',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get active polls for current user
const getActiveUserPolls = async (req, res) => {
  try {
    const polls = await Poll.getActiveUserPolls(req.user._id);

    // Add voting status for each poll
    const pollsWithVoteStatus = await Promise.all(
      polls.map(async (poll) => {
        const hasVoted = await Vote.hasUserVotedInPoll(req.user._id, poll._id);
        const userVote = hasVoted ? await Vote.getUserVoteInPoll(req.user._id, poll._id) : null;
        
        return {
          ...poll.toObject(),
          hasVoted,
          userVote: userVote ? {
            candidateName: userVote.candidateName,
            timestamp: userVote.timestamp,
            isCustomCandidate: userVote.isCustomCandidate
          } : null
        };
      })
    );

    res.json({
      message: 'Active polls retrieved successfully',
      polls: pollsWithVoteStatus,
      total: polls.length
    });
  } catch (error) {
    console.error('Get active user polls error:', error);
    res.status(500).json({
      message: 'Server error retrieving active polls',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get poll by ID
const getPollById = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if user has access to this poll
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();
    const isAssigned = poll.assignedUsers.some(userId => userId._id.toString() === req.user._id.toString());

    if (!isAdmin && !isCreator && !isAssigned) {
      return res.status(403).json({ message: 'Access denied to this poll' });
    }

    // Add voting status if user is assigned
    let pollData = poll.toObject();
    if (isAssigned || isAdmin) {
      const hasVoted = await Vote.hasUserVotedInPoll(req.user._id, poll._id);
      const userVote = hasVoted ? await Vote.getUserVoteInPoll(req.user._id, poll._id) : null;
      
      pollData.hasVoted = hasVoted;
      pollData.userVote = userVote ? {
        candidateName: userVote.candidateName,
        timestamp: userVote.timestamp,
        isCustomCandidate: userVote.isCustomCandidate
      } : null;
    }

    res.json({
      message: 'Poll retrieved successfully',
      poll: pollData
    });
  } catch (error) {
    console.error('Get poll by ID error:', error);
    res.status(500).json({
      message: 'Server error retrieving poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update poll (Admin only or creator)
const updatePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Don't allow updates to active or ended polls (except status changes for admin)
    if (poll.status !== 'draft' && !isAdmin) {
      return res.status(400).json({
        message: 'Cannot update active or ended polls'
      });
    }

    const updatedPoll = await Poll.updatePoll(pollId, req.body);

    res.json({
      message: 'Poll updated successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Update poll error:', error);
    res.status(500).json({
      message: 'Server error updating poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete poll (Admin only or creator)
const deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete associated votes
    await Vote.deletePollVotes(pollId);
    
    // Delete the poll
    await Poll.deletePoll(pollId);

    res.json({
      message: 'Poll and associated votes deleted successfully'
    });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({
      message: 'Server error deleting poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Assign users to poll (Admin only or creator)
const assignUsers = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedPoll = await Poll.assignUsers(pollId, userIds);

    res.json({
      message: 'Users assigned successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Assign users error:', error);
    res.status(500).json({
      message: 'Server error assigning users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Remove users from poll (Admin only or creator)
const removeUsers = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedPoll = await Poll.removeUsers(pollId, userIds);

    res.json({
      message: 'Users removed successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Remove users error:', error);
    res.status(500).json({
      message: 'Server error removing users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Activate poll (Admin only or creator)
const activatePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (poll.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft polls can be activated' });
    }

    const updatedPoll = await Poll.activatePoll(pollId);

    res.json({
      message: 'Poll activated successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Activate poll error:', error);
    res.status(500).json({
      message: 'Server error activating poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// End poll (Admin only or creator)
const endPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (poll.status === 'ended') {
      return res.status(400).json({ message: 'Poll is already ended' });
    }

    const updatedPoll = await Poll.endPoll(pollId);

    res.json({
      message: 'Poll ended successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('End poll error:', error);
    res.status(500).json({
      message: 'Server error ending poll',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get poll results
const getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === req.user._id.toString();
    const isAssigned = poll.assignedUsers.some(userId => userId._id.toString() === req.user._id.toString());

    if (!isAdmin && !isCreator && !isAssigned) {
      return res.status(403).json({ message: 'Access denied to poll results' });
    }

    // Only show results if poll has ended or user is admin/creator
    if (poll.status !== 'ended' && !isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Results not available until poll ends' });
    }

    const results = await Vote.getPollResults(pollId);

    res.json({
      message: 'Poll results retrieved successfully',
      poll: {
        _id: poll._id,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        startDate: poll.startDate,
        endDate: poll.endDate
      },
      results
    });
  } catch (error) {
    console.error('Get poll results error:', error);
    res.status(500).json({
      message: 'Server error retrieving poll results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get poll statistics (Admin only)
const getPollStats = async (req, res) => {
  try {
    const stats = await Poll.getPollStats();

    res.json({
      message: 'Poll statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Get poll stats error:', error);
    res.status(500).json({
      message: 'Server error retrieving poll statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createPoll,
  getAllPolls,
  getUserPolls,
  getActiveUserPolls,
  getPollById,
  updatePoll,
  deletePoll,
  assignUsers,
  removeUsers,
  activatePoll,
  endPoll,
  getPollResults,
  getPollStats
};
