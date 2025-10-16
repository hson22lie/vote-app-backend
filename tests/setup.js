process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '1h';

// Clear all data before each test
const User = require('../models/User');
const Vote = require('../models/Vote');

beforeEach(() => {
  // Reset users to default admin only
  User.users = [
    {
      id: 1,
      username: 'admin',
      email: 'admin@voting-app.com',
      password: '$2b$10$9mLPZvY2qzQ8oF8hXhYQb.YUzPbL8/7XrZIqXqVVGBtNQ4kNQwOsK', // password: admin123
      role: 'admin',
      createdAt: new Date()
    }
  ];
  User.idCounter = 2;

  // Clear all votes
  Vote.votes = [];
  Vote.candidates = [];
  Vote.idCounter = 1;
});
