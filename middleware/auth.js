const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the user to get complete user info
    const fullUser = await User.findById(decoded.id);
    if (!fullUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = fullUser;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Middleware to verify user role (both admin and user can access)
const requireUser = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'user')) {
    return res.status(403).json({ message: 'User access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireUser
};
