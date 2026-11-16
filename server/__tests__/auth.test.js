const request = require('supertest');
const express = require('express');
const app = require('../app');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const authorize = require('../middleware/authorize');
const { assertOwnership } = require('../middleware/ownership');

describe('Module 1: Authentication & Authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user successfully and returns 201 with JWT', async () => {
      const mockCreatedUser = {
        _id: '60d0fe4f5311236168a109ca',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'customer',
        businessId: null,
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue(mockCreatedUser);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'password123',
          role: 'customer',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.message).toBe('User registered successfully');
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: '60d0fe4f5311236168a109ca',
        email: 'jane@example.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects registration with missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          // missing email and password
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects registration when password is less than 6 characters (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: '123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 6 characters/i);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in existing user with correct credentials (200)', async () => {
      const mockUser = {
        _id: '60d0fe4f5311236168a109ca',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'customer',
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      const selectMock = jest.fn().mockResolvedValue(mockUser);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'jane@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('jane@example.com');
    });

    it('rejects login with incorrect password (401)', async () => {
      const mockUser = {
        _id: '60d0fe4f5311236168a109ca',
        email: 'jane@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      const selectMock = jest.fn().mockResolvedValue(mockUser);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'jane@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('rejects login with non-existent email (401)', async () => {
      const selectMock = jest.fn().mockResolvedValue(null);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login with missing email or password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'jane@example.com' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns user profile with valid Bearer token (200)', async () => {
      const userId = '60d0fe4f5311236168a109ca';
      const token = generateToken({ id: userId, role: 'customer' });

      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'customer',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('jane@example.com');
    });

    it('rejects request without token (401)', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token required/i);
    });

    it('rejects request with invalid or tampered token (401)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Business Rule R6: Access Control & Role Guards', () => {
    let testApp;

    beforeAll(() => {
      testApp = express();
      testApp.use(express.json());

      // Mock auth injector
      testApp.use((req, res, next) => {
        if (req.headers['x-mock-role']) {
          req.user = {
            _id: req.headers['x-mock-id'] || 'user123',
            role: req.headers['x-mock-role'],
            businessId: req.headers['x-mock-business'] || 'biz123',
          };
        }
        next();
      });

      testApp.get('/admin-only', authorize('admin'), (req, res) => {
        res.status(200).json({ success: true, message: 'Admin granted' });
      });

      testApp.get('/staff-or-admin', authorize('staff', 'admin'), (req, res) => {
        res.status(200).json({ success: true, message: 'Staff or Admin granted' });
      });

      const errorHandler = require('../middleware/errorHandler');
      testApp.use(errorHandler);
    });

    it('R6: rejects access when role is not permitted (403)', async () => {
      const res = await request(testApp)
        .get('/admin-only')
        .set('x-mock-role', 'customer');

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/access denied/i);
    });

    it('R6: allows access when role matches authorized list', async () => {
      const res = await request(testApp)
        .get('/admin-only')
        .set('x-mock-role', 'admin');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin granted');
    });

    it('R6: assertOwnership rejects customer accessing another user data', () => {
      const req = {
        user: { _id: 'custA', role: 'customer' },
      };

      expect(() =>
        assertOwnership(req, { customerId: 'custB' })
      ).toThrow(/customers can only access their own data/i);
    });

    it('R6: assertOwnership rejects staff accessing another staff schedule', () => {
      const req = {
        user: { _id: 'staffA', role: 'staff', businessId: 'biz1' },
      };

      expect(() =>
        assertOwnership(req, { staffId: 'staffB', businessId: 'biz1' })
      ).toThrow(/staff can only access their own schedule/i);
    });

    it('R6: assertOwnership rejects admin accessing another business data', () => {
      const req = {
        user: { _id: 'adminA', role: 'admin', businessId: 'biz1' },
      };

      expect(() =>
        assertOwnership(req, { businessId: 'biz2' })
      ).toThrow(/cannot access records from another business/i);
    });

    it('R6: assertOwnership allows customer accessing own data', () => {
      const req = {
        user: { _id: 'custA', role: 'customer' },
      };

      expect(assertOwnership(req, { customerId: 'custA' })).toBe(true);
    });
  });
});
