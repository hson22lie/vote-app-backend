const User = require('../models/User');
const Vote = require('../models/Vote');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    const formattedUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }));

    res.json({
      message: 'Users retrieved successfully',
      users: formattedUsers,
      totalUsers: formattedUsers.length
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error retrieving users' });
  }
};

// Get users with voting status (admin only)
const getUsersWithVoteStatus = async (req, res) => {
  try {
    const users = await User.findAllUsers();
    const usersWithVoteStatus = await Promise.all(users.map(async (user) => {
      const hasVoted = await Vote.hasUserVoted(user._id);
      const userVote = hasVoted ? await Vote.getUserVote(user._id) : null;
      
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        hasVoted,
        votedFor: hasVoted ? userVote.candidateName : null,
        voteTimestamp: hasVoted ? userVote.timestamp : null
      };
    }));

    res.json({
      message: 'Users with vote status retrieved successfully',
      users: usersWithVoteStatus,
      totalUsers: usersWithVoteStatus.length,
      votedCount: usersWithVoteStatus.filter(user => user.hasVoted).length
    });
  } catch (error) {
    console.error('Get users with vote status error:', error);
    res.status(500).json({ message: 'Server error retrieving users with vote status' });
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasVoted = await Vote.hasUserVoted(user._id);
    const userVote = hasVoted ? await Vote.getUserVote(user._id) : null;

    res.json({
      message: 'User retrieved successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        hasVoted,
        votedFor: hasVoted ? userVote.candidateName : null,
        voteTimestamp: hasVoted ? userVote.timestamp : null
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error retrieving user' });
  }
};

// Delete user by ID (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    // Prevent deleting other admin users
    const userToDelete = User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToDelete.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    // Delete user's votes first
    Vote.deleteVotesByUserId(userId);

    // Delete the user
    const deletedUser = User.deleteById(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User and associated votes deleted successfully',
      deletedUser: {
        id: deletedUser.id,
        username: deletedUser.username,
        email: deletedUser.email
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// Get user statistics (admin only)
const getUserStats = async (req, res) => {
  try {
    const allUsers = await User.findAll();
    const regularUsers = await User.findAllUsers();
    const adminUsers = allUsers.filter(user => user.role === 'admin');
    
    const allVotes = await Vote.getAllVotes();
    const totalVotes = allVotes.length;
    const votedUserIds = new Set(allVotes.map(vote => vote.userId._id?.toString() || vote.userId.toString()));
    const usersWhoVoted = regularUsers.filter(user => votedUserIds.has(user._id.toString()));

    res.json({
      message: 'User statistics retrieved successfully',
      stats: {
        totalUsers: allUsers.length,
        regularUsers: regularUsers.length,
        adminUsers: adminUsers.length,
        usersWhoVoted: usersWhoVoted.length,
        usersWhoNotVoted: regularUsers.length - usersWhoVoted.length,
        totalVotes
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error retrieving user statistics' });
  }
};

module.exports = {
  getAllUsers,
  getUsersWithVoteStatus,
  getUserById,
  deleteUser,
  getUserStats
};
