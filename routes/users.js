const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getAllUsers,
  getUsersWithVoteStatus,
  getUserById,
  deleteUser,
  getUserStats
} = require('../controllers/userController');

// GET /api/users - Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, getAllUsers);

// GET /api/users/stats - Get user statistics (admin only)
router.get('/stats', authenticateToken, requireAdmin, getUserStats);

// GET /api/users/with-votes - Get users with their voting status (admin only)
router.get('/with-votes', authenticateToken, requireAdmin, getUsersWithVoteStatus);

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, getUserById);

// DELETE /api/users/:id - Delete user by ID (admin only)
router.delete('/:id', authenticateToken, requireAdmin, deleteUser);

module.exports = router;
