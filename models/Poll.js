const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  candidates: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'ended', 'cancelled'],
    default: 'draft'
  },
  allowNewCandidates: {
    type: Boolean,
    default: true
  },
  maxVotesPerUser: {
    type: Number,
    default: 1,
    min: 1
  },
  isAnonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
pollSchema.index({ status: 1, startDate: 1, endDate: 1 });
pollSchema.index({ assignedUsers: 1 });
pollSchema.index({ createdBy: 1 });

// Virtual for checking if poll is currently active
pollSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate > now;
});

// Virtual for checking if poll has ended
pollSchema.virtual('hasEnded').get(function() {
  const now = new Date();
  return this.status === 'ended' || this.endDate <= now;
});

class Poll {
  // Create a new poll
  static async createPoll(pollData) {
    const poll = new PollModel(pollData);
    await poll.save();
    return poll;
  }

  // Get all polls (admin only)
  static async getAllPolls(options = {}) {
    const { page = 1, limit = 10, status, createdBy } = options;
    const filter = {};
    
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;

    const polls = await PollModel.find(filter)
      .populate('createdBy', 'username email')
      .populate('assignedUsers', 'username email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await PollModel.countDocuments(filter);

    return {
      polls,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Get polls assigned to a specific user
  static async getUserPolls(userId, options = {}) {
    const { status, includeEnded = false } = options;
    const filter = { assignedUsers: userId };
    
    if (status) {
      filter.status = status;
    } else if (!includeEnded) {
      filter.status = { $in: ['active', 'draft'] };
    }

    return await PollModel.find(filter)
      .populate('createdBy', 'username email')
      .sort({ startDate: 1 });
  }

  // Get active polls for a user
  static async getActiveUserPolls(userId) {
    const now = new Date();
    return await PollModel.find({
      assignedUsers: userId,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gt: now }
    }).populate('createdBy', 'username email');
  }

  // Get poll by ID
  static async findById(pollId) {
    return await PollModel.findById(pollId)
      .populate('createdBy', 'username email')
      .populate('assignedUsers', 'username email');
  }

  // Update poll
  static async updatePoll(pollId, updateData) {
    return await PollModel.findByIdAndUpdate(
      pollId, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email')
     .populate('assignedUsers', 'username email');
  }

  // Delete poll
  static async deletePoll(pollId) {
    return await PollModel.findByIdAndDelete(pollId);
  }

  // Assign users to poll
  static async assignUsers(pollId, userIds) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { $addToSet: { assignedUsers: { $each: userIds } } },
      { new: true }
    ).populate('assignedUsers', 'username email');
  }

  // Remove users from poll
  static async removeUsers(pollId, userIds) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { $pullAll: { assignedUsers: userIds } },
      { new: true }
    ).populate('assignedUsers', 'username email');
  }

  // Add candidate to poll
  static async addCandidate(pollId, candidateData) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { $push: { candidates: candidateData } },
      { new: true }
    );
  }

  // Remove candidate from poll
  static async removeCandidate(pollId, candidateId) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { $pull: { candidates: { _id: candidateId } } },
      { new: true }
    );
  }

  // Activate poll
  static async activatePoll(pollId) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { status: 'active' },
      { new: true }
    );
  }

  // End poll
  static async endPoll(pollId) {
    return await PollModel.findByIdAndUpdate(
      pollId,
      { status: 'ended' },
      { new: true }
    );
  }

  // Get poll statistics
  static async getPollStats() {
    const stats = await PollModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await PollModel.countDocuments();
    
    return {
      total,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  }
}

const PollModel = mongoose.model('Poll', pollSchema);

module.exports = Poll;
