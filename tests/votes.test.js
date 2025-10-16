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

describe('Voting API', () => {
  let userToken;
  let adminToken;
  let user2Token;

  beforeEach(async () => {
    // Create test users
    await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });

    await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123'
    });

    // Login users
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    userToken = userLogin.body.token;

    const user2Login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser2', password: 'password123' });
    user2Token = user2Login.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;
  });

  describe('POST /api/votes', () => {
    it('should allow user to cast a vote', async () => {
      const voteData = {
        candidateName: 'John Doe'
      };

      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send(voteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Vote cast successfully');
      expect(response.body.vote).toHaveProperty('candidateName', 'John Doe');
    });

    it('should allow admin to cast a vote', async () => {
      const voteData = {
        candidateName: 'Jane Smith'
      };

      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(voteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Vote cast successfully');
    });

    it('should not allow user to vote twice', async () => {
      // Cast first vote
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      // Try to cast second vote
      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'Jane Smith' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('User has already voted');
    });

    it('should not allow voting without authentication', async () => {
      const response = await request(app)
        .post('/api/votes')
        .send({ candidateName: 'John Doe' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });

    it('should not allow voting without candidate name', async () => {
      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Candidate name is required');
    });

    it('should not allow voting with empty candidate name', async () => {
      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Candidate name is required');
    });

    it('should trim candidate name whitespace', async () => {
      const voteData = {
        candidateName: '  John Doe  '
      };

      const response = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send(voteData);

      expect(response.status).toBe(201);
      expect(response.body.vote).toHaveProperty('candidateName', 'John Doe');
    });
  });

  describe('GET /api/votes/status', () => {
    it('should return vote status for user who has not voted', async () => {
      const response = await request(app)
        .get('/api/votes/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasVoted', false);
      expect(response.body).toHaveProperty('vote', null);
    });

    it('should return vote status for user who has voted', async () => {
      // Cast a vote first
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      const response = await request(app)
        .get('/api/votes/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasVoted', true);
      expect(response.body.vote).toHaveProperty('candidateName', 'John Doe');
    });

    it('should not return vote status without authentication', async () => {
      const response = await request(app)
        .get('/api/votes/status');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/votes/candidates', () => {
    it('should return empty candidates list initially', async () => {
      const response = await request(app)
        .get('/api/votes/candidates')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('candidates', []);
    });

    it('should return candidates list after votes', async () => {
      // Cast some votes
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ candidateName: 'Jane Smith' });

      const response = await request(app)
        .get('/api/votes/candidates')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.candidates).toContain('John Doe');
      expect(response.body.candidates).toContain('Jane Smith');
      expect(response.body.candidates).toHaveLength(2);
    });
  });

  describe('GET /api/votes/results', () => {
    beforeEach(async () => {
      // Cast some votes
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to get vote results', async () => {
      const response = await request(app)
        .get('/api/votes/results')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('totalVotes', 2);
      expect(response.body).toHaveProperty('totalCandidates', 1);
      expect(response.body.results[0]).toHaveProperty('candidateName', 'John Doe');
      expect(response.body.results[0]).toHaveProperty('voteCount', 2);
    });

    it('should not allow regular user to get vote results', async () => {
      const response = await request(app)
        .get('/api/votes/results')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  describe('GET /api/votes/all', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to get all votes', async () => {
      const response = await request(app)
        .get('/api/votes/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('votes');
      expect(response.body).toHaveProperty('totalVotes', 1);
      expect(response.body.votes[0]).toHaveProperty('candidateName', 'John Doe');
    });

    it('should not allow regular user to get all votes', async () => {
      const response = await request(app)
        .get('/api/votes/all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/votes/all', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to delete all votes', async () => {
      const response = await request(app)
        .delete('/api/votes/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'All votes deleted successfully');

      // Verify votes are deleted
      const votesResponse = await request(app)
        .get('/api/votes/all')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(votesResponse.body.totalVotes).toBe(0);
    });

    it('should not allow regular user to delete all votes', async () => {
      const response = await request(app)
        .delete('/api/votes/all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/votes/candidate/:candidateName', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ candidateName: 'John Doe' });

      await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ candidateName: 'John Doe' });
    });

    it('should allow admin to get votes by candidate', async () => {
      const response = await request(app)
        .get('/api/votes/candidate/John Doe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('candidateName', 'John Doe');
      expect(response.body).toHaveProperty('voteCount', 2);
      expect(response.body.votes).toHaveLength(2);
    });

    it('should not allow regular user to get votes by candidate', async () => {
      const response = await request(app)
        .get('/api/votes/candidate/John Doe')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
