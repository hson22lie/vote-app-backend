const Vote = require('../models/Vote');
const VotingSession = require('../models/VotingSession');

// Cast vote in a voting session
const castVoteInSession = async (req, res) => {
  // Declare variables outside try block for error handling
  let userId, votingSessionId, candidateName;
  
  try {
    const requestData = req.body;
    votingSessionId = requestData.votingSessionId;
    candidateName = requestData.candidateName;
    const { candidateId, isCustomCandidate = false } = requestData;
    userId = req.user._id;

    // Validate input
    if (!votingSessionId) {
      return res.status(400).json({ message: 'Voting session ID is required' });
    }

    if (!candidateName || candidateName.trim() === '') {
      return res.status(400).json({ message: 'Candidate name is required' });
    }

    // Check if voting session exists and user is assigned
    const votingSession = await VotingSession.findById(votingSessionId);
    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    // Check if user is assigned to this voting session
    const isAssigned = await VotingSession.isUserAssignedToSession(votingSessionId, userId);
    if (!isAssigned) {
      return res.status(403).json({ message: 'You are not assigned to this voting session' });
    }

    // Check if voting session is active
    if (votingSession.status !== 'active') {
      return res.status(400).json({ message: 'Voting session is not active' });
    }

    // Check if voting session is within time bounds
    const now = new Date();
    if (votingSession.startDate && now < votingSession.startDate) {
      return res.status(400).json({ message: 'Voting session has not started yet' });
    }
    if (votingSession.endDate && now > votingSession.endDate) {
      return res.status(400).json({ message: 'Voting session has ended' });
    }

    // Check if custom candidates are allowed
    if (isCustomCandidate && !votingSession.allowNewCandidates) {
      return res.status(400).json({ message: 'Adding new candidates is not allowed for this voting session' });
    }

    // Validate candidate exists in the session if not custom
    if (!isCustomCandidate && candidateId) {
      const candidateExists = votingSession.candidates.some(c => c._id.toString() === candidateId);
      if (!candidateExists) {
        return res.status(400).json({ message: 'Candidate not found in this voting session' });
      }
    }

    const candidateData = {
      candidateId,
      candidateName: candidateName.trim(),
      isCustomCandidate
    };

    // Cast the vote
    const vote = await Vote.castVoteInSession(userId, votingSessionId, candidateData);

    res.status(201).json({
      message: 'Vote cast successfully',
      vote: {
        id: vote._id,
        candidateName: vote.candidateName,
        votingSessionId: vote.votingSessionId,
        timestamp: vote.timestamp,
        isCustomCandidate: vote.isCustomCandidate
      }
    });
  } catch (error) {
    console.error('Vote casting error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId,
      votingSessionId,
      candidateName
    });
    if (error.message === 'User has already voted in this voting session') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ 
      message: 'Server error during vote casting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new vote (legacy method for backward compatibility)
const castVote = async (req, res) => {
  try {
    const { candidateName } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!candidateName || candidateName.trim() === '') {
      return res.status(400).json({ message: 'Candidate name is required' });
    }

    const trimmedCandidateName = candidateName.trim();

    // Create the vote
    const vote = await Vote.createVote(userId, trimmedCandidateName);

    res.status(201).json({
      message: 'Vote cast successfully',
      vote: {
        id: vote._id,
        candidateName: vote.candidateName,
        timestamp: vote.timestamp
      }
    });
  } catch (error) {
    console.error('Vote casting error:', error);
    if (error.message === 'User has already voted') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error during vote casting' });
  }
};

// Get voting session results
const getSessionResults = async (req, res) => {
  try {
    const { votingSessionId } = req.params;
    
    // Check if voting session exists
    const votingSession = await VotingSession.findById(votingSessionId);
    if (!votingSession) {
      return res.status(404).json({ message: 'Voting session not found' });
    }

    // For non-admin users, check if they're assigned to the session
    if (req.user.role !== 'admin') {
      const isAssigned = await VotingSession.isUserAssignedToSession(votingSessionId, req.user._id);
      if (!isAssigned) {
        return res.status(403).json({ message: 'You are not assigned to this voting session' });
      }
    }

    const results = await Vote.getSessionResults(votingSessionId);
    
    res.json({
      message: 'Voting session results retrieved successfully',
      votingSession: {
        id: votingSession._id,
        title: votingSession.title,
        description: votingSession.description,
        status: votingSession.status
      },
      ...results
    });
  } catch (error) {
    console.error('Get session results error:', error);
    res.status(500).json({ message: 'Server error retrieving session results' });
  }
};

// Get voting results (admin only - legacy method)
const getResults = async (req, res) => {
  try {
    const results = await Vote.getVoteResults();
    res.json({
      message: 'Vote results retrieved successfully',
      ...results
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ message: 'Server error retrieving results' });
  }
};

// Get all candidates
const getCandidates = async (req, res) => {
  try {
    const candidates = await Vote.getAllCandidates();
    res.json({
      message: 'Candidates retrieved successfully',
      candidates
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ message: 'Server error retrieving candidates' });
  }
};

// Check if current user has voted
const getVoteStatus = (req, res) => {
  try {
    const userId = req.user.id;
    const hasVoted = Vote.hasUserVoted(userId);
    const userVote = Vote.getUserVote(userId);

    res.json({
      hasVoted,
      vote: userVote ? {
        candidateName: userVote.candidateName,
        timestamp: userVote.timestamp
      } : null
    });
  } catch (error) {
    console.error('Get vote status error:', error);
    res.status(500).json({ message: 'Server error retrieving vote status' });
  }
};

// Get all votes with user information (admin only)
const getAllVotes = (req, res) => {
  try {
    const votes = Vote.getAllVotes();
    res.json({
      message: 'All votes retrieved successfully',
      votes: votes.map(vote => ({
        id: vote.id,
        userId: vote.userId,
        candidateName: vote.candidateName,
        timestamp: vote.timestamp
      })),
      totalVotes: votes.length
    });
  } catch (error) {
    console.error('Get all votes error:', error);
    res.status(500).json({ message: 'Server error retrieving votes' });
  }
};

// Delete all votes (admin only)
const deleteAllVotes = (req, res) => {
  try {
    Vote.deleteAllVotes();
    res.json({
      message: 'All votes deleted successfully'
    });
  } catch (error) {
    console.error('Delete all votes error:', error);
    res.status(500).json({ message: 'Server error deleting votes' });
  }
};

// Get votes by candidate (admin only)
const getVotesByCandidate = (req, res) => {
  try {
    const { candidateName } = req.params;
    const votes = Vote.getVotesByCandidate(candidateName);
    
    res.json({
      message: `Votes for ${candidateName} retrieved successfully`,
      candidateName,
      votes: votes.map(vote => ({
        id: vote.id,
        userId: vote.userId,
        timestamp: vote.timestamp
      })),
      voteCount: votes.length
    });
  } catch (error) {
    console.error('Get votes by candidate error:', error);
    res.status(500).json({ message: 'Server error retrieving votes by candidate' });
  }
};

// Cast vote in a specific poll
const castVoteInPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { candidateId, candidateName, isCustomCandidate = false } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!candidateName || candidateName.trim() === '') {
      return res.status(400).json({ message: 'Candidate name is required' });
    }

    // Check if poll exists and user has access
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if user is assigned to this poll
    const isAdmin = req.user.role === 'admin';
    const isAssigned = poll.assignedUsers.some(id => id.toString() === userId.toString());
    
    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ message: 'You are not assigned to this poll' });
    }

    // Check if poll is active
    const now = new Date();
    if (poll.status !== 'active' || poll.startDate > now || poll.endDate <= now) {
      return res.status(400).json({ message: 'Poll is not currently active' });
    }

    // Validate candidate if not custom
    if (!isCustomCandidate && candidateId) {
      const candidate = poll.candidates.id(candidateId);
      if (!candidate) {
        return res.status(400).json({ message: 'Invalid candidate selected' });
      }
    }

    // Check if custom candidates are allowed
    if (isCustomCandidate && !poll.allowNewCandidates) {
      return res.status(400).json({ message: 'Custom candidates are not allowed in this poll' });
    }

    const candidateData = {
      candidateId: candidateId || null,
      candidateName: candidateName.trim(),
      isCustomCandidate
    };

    const vote = await Vote.castVoteInPoll(userId, pollId, candidateData);

    res.status(201).json({
      message: 'Vote cast successfully',
      vote: {
        _id: vote._id,
        candidateName: vote.candidateName,
        timestamp: vote.timestamp,
        isCustomCandidate: vote.isCustomCandidate,
        poll: {
          _id: vote.pollId._id,
          title: vote.pollId.title
        }
      }
    });
  } catch (error) {
    console.error('Cast vote in poll error:', error);
    if (error.message === 'User has already voted in this poll') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error casting vote' });
  }
};

// Get user's vote status in a specific poll
const getPollVoteStatus = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user._id;

    // Check if poll exists and user has access
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned = poll.assignedUsers.some(id => id.toString() === userId.toString());
    
    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ message: 'Access denied to this poll' });
    }

    const hasVoted = await Vote.hasUserVotedInPoll(userId, pollId);
    const userVote = hasVoted ? await Vote.getUserVoteInPoll(userId, pollId) : null;

    res.json({
      pollId,
      hasVoted,
      vote: userVote ? {
        candidateName: userVote.candidateName,
        timestamp: userVote.timestamp,
        isCustomCandidate: userVote.isCustomCandidate
      } : null
    });
  } catch (error) {
    console.error('Get poll vote status error:', error);
    res.status(500).json({ message: 'Server error retrieving vote status' });
  }
};

// Get all votes for a specific poll (admin/creator only)
const getPollVotes = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user._id;

    // Check if poll exists
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check permissions (admin or creator)
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.createdBy._id.toString() === userId.toString();
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const votes = await Vote.getPollVotes(pollId);

    res.json({
      message: 'Poll votes retrieved successfully',
      poll: {
        _id: poll._id,
        title: poll.title
      },
      votes: votes.map(vote => ({
        _id: vote._id,
        candidateName: vote.candidateName,
        timestamp: vote.timestamp,
        isCustomCandidate: vote.isCustomCandidate,
        user: poll.isAnonymous ? null : {
          _id: vote.userId._id,
          username: vote.userId.username
        }
      })),
      totalVotes: votes.length
    });
  } catch (error) {
    console.error('Get poll votes error:', error);
    res.status(500).json({ message: 'Server error retrieving poll votes' });
  }
};

// Get user's votes across all sessions
const getUserVotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const votes = await Vote.getUserVotes(userId);

    res.json({
      message: 'User votes retrieved successfully',
      votes: votes || [],
      totalVotes: votes ? votes.length : 0
    });
  } catch (error) {
    console.error('Get user votes error:', error);
    res.status(500).json({ message: 'Server error retrieving user votes' });
  }
};

module.exports = {
  castVote,
  getResults,
  getCandidates,
  getVoteStatus,
  getAllVotes,
  deleteAllVotes,
  getVotesByCandidate,
  // New voting session methods
  castVoteInSession,
  getSessionResults,
  getUserVotes,
  // Legacy poll-specific methods
  castVoteInPoll,
  getPollVoteStatus,
  getPollVotes
};
