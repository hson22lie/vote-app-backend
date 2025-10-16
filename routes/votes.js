const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin, requireUser } = require('../middleware/auth');
const {
  castVote,
  getResults,
  getCandidates,
  getVoteStatus,
  getAllVotes,
  deleteAllVotes,
  getVotesByCandidate,
  getUserVotes
} = require('../controllers/voteController');

// POST /api/votes - Cast a vote (authenticated users only)
router.post('/', authenticateToken, requireUser, castVote);

// GET /api/votes/status - Check if current user has voted (authenticated users)
router.get('/status', authenticateToken, requireUser, getVoteStatus);

// GET /api/votes/user/my-votes - Get current user's votes (authenticated users)
router.get('/user/my-votes', authenticateToken, requireUser, getUserVotes);

// GET /api/votes/candidates - Get all candidates (authenticated users)
router.get('/candidates', authenticateToken, requireUser, getCandidates);

// GET /api/votes/results - Get voting results (admin only)
router.get('/results', authenticateToken, requireAdmin, getResults);

// GET /api/votes/all - Get all votes with details (admin only)
router.get('/all', authenticateToken, requireAdmin, getAllVotes);

// DELETE /api/votes/all - Delete all votes (admin only)
router.delete('/all', authenticateToken, requireAdmin, deleteAllVotes);

// GET /api/votes/candidate/:candidateName - Get votes by candidate (admin only)
router.get('/candidate/:candidateName', authenticateToken, requireAdmin, getVotesByCandidate);

module.exports = router;
