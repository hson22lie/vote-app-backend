const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
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
} = require('../controllers/votingSessionController');

const {
  castVoteInSession,
  getSessionResults
} = require('../controllers/voteController');

// Admin routes
router.post('/', authenticateToken, requireAdmin, createVotingSession);
router.get('/admin/all', authenticateToken, requireAdmin, getAllVotingSessions);
router.put('/:id', authenticateToken, requireAdmin, updateVotingSession);
router.delete('/:id', authenticateToken, requireAdmin, deleteVotingSession);
router.post('/:id/assign-users', authenticateToken, requireAdmin, assignUsersToSession);
router.post('/:id/remove-users', authenticateToken, requireAdmin, removeUsersFromSession);
router.post('/:id/candidates', authenticateToken, requireAdmin, addCandidateToSession);
router.delete('/:id/candidates/:candidateId', authenticateToken, requireAdmin, removeCandidateFromSession);

// User routes
router.get('/my-sessions', authenticateToken, getUserVotingSessions);
router.get('/user/assigned', authenticateToken, getUserVotingSessions);
router.get('/:id', authenticateToken, getVotingSessionById);
router.get('/:votingSessionId/results', authenticateToken, getSessionResults);

// Voting routes
router.post('/vote', authenticateToken, castVoteInSession);

module.exports = router;
