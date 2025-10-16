const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin, requireUser } = require('../middleware/auth');
const {
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
} = require('../controllers/pollController');

const {
  castVoteInPoll,
  getPollVoteStatus,
  getPollVotes
} = require('../controllers/voteController');

// Poll Management Routes (Admin only)
// POST /api/polls - Create a new poll
router.post('/', authenticateToken, requireAdmin, createPoll);

// GET /api/polls - Get all polls (Admin only)
router.get('/', authenticateToken, requireAdmin, getAllPolls);

// GET /api/polls/stats - Get poll statistics (Admin only)
router.get('/stats', authenticateToken, requireAdmin, getPollStats);

// User Poll Routes
// GET /api/polls/my - Get polls assigned to current user
router.get('/my', authenticateToken, requireUser, getUserPolls);

// GET /api/polls/my/active - Get active polls for current user
router.get('/my/active', authenticateToken, requireUser, getActiveUserPolls);

// Poll Detail Routes
// GET /api/polls/:pollId - Get poll by ID
router.get('/:pollId', authenticateToken, requireUser, getPollById);

// PUT /api/polls/:pollId - Update poll (Admin or creator)
router.put('/:pollId', authenticateToken, requireUser, updatePoll);

// DELETE /api/polls/:pollId - Delete poll (Admin or creator)
router.delete('/:pollId', authenticateToken, requireUser, deletePoll);

// Poll User Management Routes
// POST /api/polls/:pollId/assign - Assign users to poll (Admin or creator)
router.post('/:pollId/assign', authenticateToken, requireUser, assignUsers);

// POST /api/polls/:pollId/remove - Remove users from poll (Admin or creator)
router.post('/:pollId/remove', authenticateToken, requireUser, removeUsers);

// Poll Status Management Routes
// POST /api/polls/:pollId/activate - Activate poll (Admin or creator)
router.post('/:pollId/activate', authenticateToken, requireUser, activatePoll);

// POST /api/polls/:pollId/end - End poll (Admin or creator)
router.post('/:pollId/end', authenticateToken, requireUser, endPoll);

// Voting Routes
// POST /api/polls/:pollId/vote - Cast vote in poll
router.post('/:pollId/vote', authenticateToken, requireUser, castVoteInPoll);

// GET /api/polls/:pollId/vote-status - Get user's vote status in poll
router.get('/:pollId/vote-status', authenticateToken, requireUser, getPollVoteStatus);

// GET /api/polls/:pollId/votes - Get all votes in poll (Admin or creator)
router.get('/:pollId/votes', authenticateToken, requireUser, getPollVotes);

// Results Routes
// GET /api/polls/:pollId/results - Get poll results
router.get('/:pollId/results', authenticateToken, requireUser, getPollResults);

module.exports = router;
