const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Vote = require('../models/Vote');

// Test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '1h';

// Clear all data before each test
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

describe('User Management API', () => {
  let adminToken;
  let userToken;
  let testUserId;

  beforeEach(async () => {
    // Create a test user
    const testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });
    testUserId = testUser.id;

    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Login as regular user
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    userToken = userLogin.body.token;
  });

  describe('GET /api/users', () => {
    it('should allow admin to get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalUsers', 2); // admin + testuser
      expect(response.body.users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ username: 'admin' }),
          expect.objectContaining({ username: 'testuser' })
        ])
      );
    });

    it('should not allow regular user to get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('should not allow unauthenticated access', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/stats', () => {
    beforeEach(async () => {
      // Cast a vote to test vote statistics
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to get user statistics', async () => {
      const response = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalUsers', 2);
      expect(response.body.stats).toHaveProperty('regularUsers', 1);
      expect(response.body.stats).toHaveProperty('adminUsers', 1);
      expect(response.body.stats).toHaveProperty('usersWhoVoted', 1);
      expect(response.body.stats).toHaveProperty('usersWhoNotVoted', 0);
      expect(response.body.stats).toHaveProperty('totalVotes', 1);
    });

    it('should not allow regular user to get user statistics', async () => {
      const response = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users/with-votes', () => {
    beforeEach(async () => {
      // Cast a vote for the test user
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to get users with vote status', async () => {
      const response = await request(app)
        .get('/api/users/with-votes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('votedCount', 1);
      expect(response.body.users[0]).toHaveProperty('hasVoted', true);
      expect(response.body.users[0]).toHaveProperty('votedFor', 'John Doe');
    });

    it('should not allow regular user to get users with vote status', async () => {
      const response = await request(app)
        .get('/api/users/with-votes')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should allow admin to get user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).toHaveProperty('hasVoted', false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should not allow regular user to get user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should allow admin to delete regular user', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User and associated votes deleted successfully');
      expect(response.body.deletedUser).toHaveProperty('username', 'testuser');

      // Verify user is deleted
      const getUserResponse = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(getUserResponse.status).toBe(404);
    });

    it('should not allow admin to delete themselves', async () => {
      const response = await request(app)
        .delete('/api/users/1') // admin user ID is 1
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Cannot delete your own account');
    });

    it('should not allow admin to delete other admin users', async () => {
      // Create another admin user
      const anotherAdmin = await User.create({
        username: 'admin2',
        email: 'admin2@example.com',
        password: 'password123',
        role: 'admin'
      });

      const response = await request(app)
        .delete(`/api/users/${anotherAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Cannot delete admin users');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/users/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should not allow regular user to delete users', async () => {
      // Create another test user
      const anotherUser = await User.create({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .delete(`/api/users/${anotherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should delete user votes when deleting user', async () => {
      // Cast a vote as the test user
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      // Verify vote exists
      const votesBeforeResponse = await request(app)
        .get('/api/votes/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(votesBeforeResponse.body.totalVotes).toBe(1);

      // Delete the user
      await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify vote is deleted
      const votesAfterResponse = await request(app)
        .get('/api/votes/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(votesAfterResponse.body.totalVotes).toBe(0);
    });
  });
});
