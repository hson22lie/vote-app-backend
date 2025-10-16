const mongoose = require('mongoose');

const votingSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
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
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  allowNewCandidates: {
    type: Boolean,
    default: false
  },
  multipleChoice: {
    type: Boolean,
    default: false
  },
  maxChoices: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
votingSessionSchema.index({ status: 1, startDate: 1, endDate: 1 });
votingSessionSchema.index({ assignedUsers: 1 });

class VotingSession {
  static async create(sessionData, createdById) {
    const session = new VotingSessionModel({
      ...sessionData,
      createdBy: createdById
    });
    await session.save();
    return session;
  }

  static async findById(id) {
    return await VotingSessionModel.findById(id)
      .populate('assignedUsers', 'username email')
      .populate('createdBy', 'username email');
  }

  static async findAll() {
    return await VotingSessionModel.find({})
      .populate('assignedUsers', 'username email')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });
  }

  static async findByUserId(userId) {
    return await VotingSessionModel.find({
      assignedUsers: userId,
      status: 'active'
    }).populate('createdBy', 'username email');
  }

  static async updateById(id, updateData) {
    return await VotingSessionModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('assignedUsers', 'username email')
     .populate('createdBy', 'username email');
  }

  static async deleteById(id) {
    return await VotingSessionModel.findByIdAndDelete(id);
  }

  static async assignUsersToSession(sessionId, userIds) {
    return await VotingSessionModel.findByIdAndUpdate(
      sessionId,
      { $addToSet: { assignedUsers: { $each: userIds } } },
      { new: true }
    ).populate('assignedUsers', 'username email');
  }

  static async removeUsersFromSession(sessionId, userIds) {
    return await VotingSessionModel.findByIdAndUpdate(
      sessionId,
      { $pull: { assignedUsers: { $in: userIds } } },
      { new: true }
    ).populate('assignedUsers', 'username email');
  }

  static async addCandidate(sessionId, candidate) {
    return await VotingSessionModel.findByIdAndUpdate(
      sessionId,
      { $push: { candidates: candidate } },
      { new: true }
    );
  }

  static async removeCandidate(sessionId, candidateId) {
    return await VotingSessionModel.findByIdAndUpdate(
      sessionId,
      { $pull: { candidates: { _id: candidateId } } },
      { new: true }
    );
  }

  static async getActiveSessionsForUser(userId) {
    const now = new Date();
    return await VotingSessionModel.find({
      assignedUsers: userId,
      status: 'active',
      $or: [
        { startDate: { $lte: now } },
        { startDate: { $exists: false } }
      ],
      $or: [
        { endDate: { $gte: now } },
        { endDate: { $exists: false } }
      ]
    }).populate('createdBy', 'username email');
  }

  static async isUserAssignedToSession(sessionId, userId) {
    const session = await VotingSessionModel.findById(sessionId);
    if (!session) return false;
    
    // Convert both to strings for comparison
    const userIdString = userId.toString();
    return session.assignedUsers.some(assignedUserId => 
      assignedUserId.toString() === userIdString
    );
  }
}

const VotingSessionModel = mongoose.model('VotingSession', votingSessionSchema);

module.exports = VotingSession;
