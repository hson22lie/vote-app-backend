const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { login, register, getProfile, verifyToken } = require('../controllers/authController');

// POST /api/auth/login - User login
router.post('/login', login);

// POST /api/auth/register - User registration
router.post('/register', register);

// GET /api/auth/profile - Get current user profile (protected)
router.get('/profile', authenticateToken, getProfile);

// GET /api/auth/verify - Verify token validity (protected)
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;
