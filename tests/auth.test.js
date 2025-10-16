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

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).toHaveProperty('role', 'user');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should not register user with existing username', async () => {
      // Create a user first
      await User.create({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      });

      const userData = {
        username: 'existinguser',
        email: 'different@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should not register user with short password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password must be at least 6 characters long');
    });

    it('should not register admin user through register endpoint', async () => {
      const userData = {
        username: 'testadmin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Cannot register admin users through this endpoint');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should login user with correct credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });

    it('should login admin with correct credentials', async () => {
      const loginData = {
        username: 'admin',
        password: 'admin123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'admin');
      expect(response.body.user).toHaveProperty('role', 'admin');
    });

    it('should login with email instead of username', async () => {
      const loginData = {
        username: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
    });

    it('should not login with incorrect password', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should not login with non-existent user', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    let userToken;
    let adminToken;

    beforeEach(async () => {
      // Create and login a regular user
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      userToken = userLogin.body.token;

      // Login as admin
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      adminToken = adminLogin.body.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).toHaveProperty('role', 'user');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should get admin profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('username', 'admin');
      expect(response.body.user).toHaveProperty('role', 'admin');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/auth/verify', () => {
    let userToken;

    beforeEach(async () => {
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      userToken = userLogin.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });

    it('should not verify invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });
});
