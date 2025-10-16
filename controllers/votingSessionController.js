const VotingSession = require('../models/VotingSession');
const Vote = require('../models/Vote');
const User = require('../models/User');

// Create a new voting session (admin only)
const createVotingSession = async (req, res) => {
  try {
    const { title, description, candidates = [], assignedUsers = [], allowNewCandidates = false, multipleChoice = false, maxChoices = 1, startDate, endDate } = req.body;
    const createdBy = req.user._id;

    // Validate input
    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Validate assigned users exist
    if (assignedUsers.length > 0) {
      const existingUsers = await User.findAll();
      const existingUserIds = existingUsers.map(user => user._id.toString());
      const invalidUsers = assignedUsers.filter(userId => !existingUserIds.includes(userId));
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          message: 'Some assigned users do not exist',
          invalidUsers 
        });
      }
    }

    const sessionData = {
      title: title.trim(),
      description: description?.trim(),
      candidates: candidates.map(c => ({
        name: c.name?.trim(),
        description: c.description?.trim() || ''
      })),
      assignedUsers,
      allowNewCandidates,
      multipleChoice,
      maxChoices: multipleChoice ? Math.max(1, maxChoices) : 1,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const votingSession = await VotingSession.create(sessionData, createdBy);

    res.status(201).json({
      message: 'Voting session created successfully',
      votingSession
    });
  } catch (error) {
    console.error('Create voting session error:', error);
    res.status(500).json({ message: 'Server error creating voting session' });
  }
};

// Get all voting sessions (admin only)
const getAllVotingSessions = async (req, res) => {
  try {
    const votingSessions = await VotingSession.findAll();

    // Add vote counts for each session
    const sessionsWithStats = await Promise.all(votingSessions.map(async (session) => {
      const voteCount = await Vote.getSessionResults(session._id);
      return {
        ...session.toObject(),
        totalVotes: voteCount.totalVotes,
        totalCandidates: voteCount.totalCandidates
      };
    }));

    res.json({
      message: 'Voting sessions retrieved successfully',
      votingSessions: sessionsWithStats,
      totalSessions: sessionsWithStats.length
    });
  } catch (error) {
    console.error('Get all voting sessions error:', error);
    res.status(500).json({ message: 'Server error retrieving voting sessions' });
  }
};

// Get voting session by ID
const getVotingSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const votingSession = await VotingSession.findById(id);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    // Get vote results for this session
    const results = await Vote.getSessionResults(id);
    const votes = await Vote.getSessionVotes(id);

    res.json({
      message: 'Voting session retrieved successfully',
      votingSession,
      results,
      votes: votes.map(vote => ({
        id: vote._id,
        candidateName: vote.candidateName,
        user: vote.userId,
        timestamp: vote.timestamp,
        isCustomCandidate: vote.isCustomCandidate
      }))
    });
  } catch (error) {
    console.error('Get voting session error:', error);
    res.status(500).json({ message: 'Server error retrieving voting session' });
  }
};

// Get voting sessions assigned to current user
const getUserVotingSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const votingSessions = await VotingSession.getActiveSessionsForUser(userId);

    // Add voting status for each session
    const sessionsWithVoteStatus = await Promise.all(votingSessions.map(async (session) => {
      const hasVoted = await Vote.hasUserVotedInSession(userId, session._id);
      const userVote = hasVoted ? await Vote.getUserVoteInSession(userId, session._id) : null;

      return {
        ...session.toObject(),
        hasVoted,
        userVote: userVote ? {
          candidateName: userVote.candidateName,
          timestamp: userVote.timestamp,
          isCustomCandidate: userVote.isCustomCandidate
        } : null
      };
    }));

    res.json({
      message: 'User voting sessions retrieved successfully',
      votingSessions: sessionsWithVoteStatus,
      totalSessions: sessionsWithVoteStatus.length
    });
  } catch (error) {
    console.error('Get user voting sessions error:', error);
    res.status(500).json({ message: 'Server error retrieving user voting sessions' });
  }
};

// Update voting session (admin only)
const updateVotingSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const votingSession = await VotingSession.updateById(id, updateData);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    res.json({
      message: 'Voting session updated successfully',
      votingSession
    });
  } catch (error) {
    console.error('Update voting session error:', error);
    res.status(500).json({ message: 'Server error updating voting session' });
  }
};

// Delete voting session (admin only)
const deleteVotingSession = async (req, res) => {
  try {
    const { id } = req.params;

    const votingSession = await VotingSession.deleteById(id);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    // Also delete all votes for this session
    await Vote.deleteVotesBySessionId(id);

    res.json({
      message: 'Voting session and associated votes deleted successfully',
      deletedSession: votingSession
    });
  } catch (error) {
    console.error('Delete voting session error:', error);
    res.status(500).json({ message: 'Server error deleting voting session' });
  }
};

// Assign users to voting session (admin only)
const assignUsersToSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    // Validate users exist
    const users = await Promise.all(userIds.map(userId => User.findById(userId)));
    const validUsers = users.filter(user => user !== null);
    
    if (validUsers.length !== userIds.length) {
      return res.status(400).json({ message: 'Some user IDs are invalid' });
    }

    const votingSession = await VotingSession.assignUsersToSession(id, userIds);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    res.json({
      message: 'Users assigned to voting session successfully',
      votingSession
    });
  } catch (error) {
    console.error('Assign users to session error:', error);
    res.status(500).json({ message: 'Server error assigning users to session' });
  }
};

// Remove users from voting session (admin only)
const removeUsersFromSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const votingSession = await VotingSession.removeUsersFromSession(id, userIds);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    res.json({
      message: 'Users removed from voting session successfully',
      votingSession
    });
  } catch (error) {
    console.error('Remove users from session error:', error);
    res.status(500).json({ message: 'Server error removing users from session' });
  }
};

// Add candidate to voting session (admin only)
const addCandidateToSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description = '' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Candidate name is required' });
    }

    const candidate = {
      name: name.trim(),
      description: description.trim()
    };

    const votingSession = await VotingSession.addCandidate(id, candidate);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    res.json({
      message: 'Candidate added to voting session successfully',
      votingSession,
      addedCandidate: candidate
    });
  } catch (error) {
    console.error('Add candidate to session error:', error);
    res.status(500).json({ message: 'Server error adding candidate to session' });
  }
};

// Remove candidate from voting session (admin only)
const removeCandidateFromSession = async (req, res) => {
  try {
    const { id, candidateId } = req.params;

    const votingSession = await VotingSession.removeCandidate(id, candidateId);

    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    res.json({
      message: 'Candidate removed from voting session successfully',
      votingSession
    });
  } catch (error) {
    console.error('Remove candidate from session error:', error);
    res.status(500).json({ message: 'Server error removing candidate from session' });
  }
};

module.exports = {
  createVotingSession,
  getAllVotingSessions,
  getVotingSessionById,
  getUserVotingSessions,
  updateVotingSession,
  deleteVotingSession,
  assignUsersToSession,
  removeUsersFromSession,
  addCandidateToSession,
  removeCandidateFromSession
};
