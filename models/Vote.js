const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  votingSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VotingSession',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // For predefined candidates
  },
  candidateName: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isCustomCandidate: {
    type: Boolean,
    default: false // True if user added a new candidate
  }
}, {
  timestamps: true
});

// Create compound index to ensure one vote per user per voting session
voteSchema.index({ userId: 1, votingSessionId: 1 }, { unique: true });
// Index for efficient voting session-based queries
voteSchema.index({ votingSessionId: 1, candidateName: 1 });
voteSchema.index({ votingSessionId: 1, timestamp: 1 });

class Vote {
  // Legacy method for backward compatibility (single global poll system)
  static async createVote(userId, candidateName) {
    // Check if user has already voted in the global poll (legacy behavior)
    // Only check votes without votingSessionId for backward compatibility
    const existingVote = await VoteModel.findOne({ 
      userId, 
      votingSessionId: { $exists: false } 
    });
    if (existingVote && existingVote.candidateName) {
      throw new Error('User has already voted');
    }

    const vote = new VoteModel({
      userId,
      candidateName: candidateName.trim()
    });

    await vote.save();
    return vote;
  }

  // New voting session-specific voting method
  static async castVoteInSession(userId, votingSessionId, candidateData) {
    const { candidateId, candidateName, isCustomCandidate = false } = candidateData;
    
    // Check if user has already voted in this voting session
    const existingVote = await VoteModel.findOne({ userId, votingSessionId });
    if (existingVote) {
      throw new Error('User has already voted in this voting session');
    }

    const vote = new VoteModel({
      userId,
      votingSessionId,
      candidateId,
      candidateName: candidateName.trim(),
      isCustomCandidate
    });

    await vote.save();
    return await VoteModel.findById(vote._id)
      .populate('userId', 'username email')
      .populate('votingSessionId', 'title');
  }

  static async getAllVotes() {
    return await VoteModel.find().populate('userId', 'username email');
  }

  static async getVoteResults() {
    // Use MongoDB aggregation for efficient vote counting
    const results = await VoteModel.aggregate([
      {
        $group: {
          _id: '$candidateName',
          voteCount: { $sum: 1 }
        }
      },
      {
        $sort: { voteCount: -1 }
      },
      {
        $project: {
          candidateName: '$_id',
          voteCount: 1,
          _id: 0
        }
      }
    ]);

    const totalVotes = await VoteModel.countDocuments();
    const candidates = await VoteModel.distinct('candidateName');

    return {
      results,
      totalVotes,
      totalCandidates: candidates.length,
      candidates: candidates.sort()
    };
  }

  static async getAllCandidates() {
    const candidates = await VoteModel.distinct('candidateName');
    return candidates.sort();
  }

  static async hasUserVoted(userId) {
    const vote = await VoteModel.findOne({ userId });
    return !!vote;
  }

  static async getUserVote(userId) {
    return await VoteModel.findOne({ userId }).populate('userId', 'username email');
  }

  static async getVotesByCandidate(candidateName) {
    return await VoteModel.find({ candidateName }).populate('userId', 'username email');
  }

  static async deleteAllVotes() {
    await VoteModel.deleteMany({});
    return true;
  }

  static async deleteVotesByUserId(userId) {
    const result = await VoteModel.deleteMany({ userId });
    return result.deletedCount > 0;
  }

  // Voting session-specific methods
  static async getSessionResults(votingSessionId) {
    // Use MongoDB aggregation for efficient vote counting by voting session
    const results = await VoteModel.aggregate([
      { $match: { votingSessionId: new mongoose.Types.ObjectId(votingSessionId) } },
      {
        $group: {
          _id: '$candidateName',
          voteCount: { $sum: 1 },
          customCandidateCount: {
            $sum: { $cond: ['$isCustomCandidate', 1, 0] }
          }
        }
      },
      {
        $sort: { voteCount: -1 }
      },
      {
        $project: {
          candidateName: '$_id',
          voteCount: 1,
          customCandidateCount: 1,
          _id: 0
        }
      }
    ]);

    const totalVotes = await VoteModel.countDocuments({ votingSessionId });
    const candidates = await VoteModel.distinct('candidateName', { votingSessionId });

    return {
      results,
      totalVotes,
      totalCandidates: candidates.length,
      candidates: candidates.sort()
    };
  }

  static async getUserVoteInSession(userId, votingSessionId) {
    return await VoteModel.findOne({ userId, votingSessionId })
      .populate('userId', 'username email')
      .populate('votingSessionId', 'title');
  }

  static async hasUserVotedInSession(userId, votingSessionId) {
    const vote = await VoteModel.findOne({ userId, votingSessionId });
    return !!vote;
  }

  static async getSessionVotes(votingSessionId) {
    return await VoteModel.find({ votingSessionId })
      .populate('userId', 'username email')
      .populate('votingSessionId', 'title')
      .sort({ timestamp: -1 });
  }

  static async getVotesInPollByCandidate(pollId, candidateName) {
    return await VoteModel.find({ pollId, candidateName })
      .populate('userId', 'username email')
      .sort({ timestamp: -1 });
  }

  static async getUserPolls(userId) {
    return await VoteModel.find({ userId })
      .populate('pollId', 'title description status startDate endDate')
      .sort({ timestamp: -1 });
  }

  static async deleteSessionVotes(votingSessionId) {
    const result = await VoteModel.deleteMany({ votingSessionId });
    return result.deletedCount > 0;
  }

  static async deleteVotesBySessionId(votingSessionId) {
    const result = await VoteModel.deleteMany({ votingSessionId });
    return result.deletedCount > 0;
  }

  // Get all votes for a specific user
  static async getUserVotes(userId) {
    try {
      const votes = await VoteModel.find({ userId })
        .populate('votingSessionId', 'title status')
        .sort({ timestamp: -1 });
      
      return votes.map(vote => ({
        _id: vote._id,
        votingSession: vote.votingSessionId._id,
        votingSessionTitle: vote.votingSessionId.title,
        candidateName: vote.candidateName,
        isCustomCandidate: vote.isCustomCandidate,
        timestamp: vote.timestamp
      }));
    } catch (error) {
      console.error('Error getting user votes:', error);
      throw error;
    }
  }
}

const VoteModel = mongoose.model('Vote', voteSchema);

module.exports = Vote;
