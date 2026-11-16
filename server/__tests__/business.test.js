const request = require('supertest');
const app = require('../app');
const Business = require('../models/Business');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

describe('Module 2: Business Profile & Operating Hours', () => {
  const adminId = '60d0fe4f5311236168a109aa';
  const customerId = '60d0fe4f5311236168a109bb';
  const businessId = '60d0fe4f5311236168a109cc';
  const otherBusinessId = '60d0fe4f5311236168a109dd';

  let adminToken;
  let customerToken;

  const validHours = [
    { day: 'Monday', open: '09:00', close: '18:00', isClosed: false },
    { day: 'Tuesday', open: '09:00', close: '18:00', isClosed: false },
    { day: 'Wednesday', open: '09:00', close: '18:00', isClosed: false },
    { day: 'Thursday', open: '09:00', close: '18:00', isClosed: false },
    { day: 'Friday', open: '09:00', close: '19:00', isClosed: false },
    { day: 'Saturday', open: '10:00', close: '17:00', isClosed: false },
    { day: 'Sunday', open: '00:00', close: '00:00', isClosed: true },
  ];

  beforeAll(() => {
    adminToken = generateToken({ id: adminId, role: 'admin' });
    customerToken = generateToken({ id: customerId, role: 'customer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockAdminUser = {
    _id: adminId,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    businessId: businessId,
  };

  const mockCustomerUser = {
    _id: customerId,
    name: 'Customer User',
    email: 'customer@example.com',
    role: 'customer',
    businessId: null,
  };

  describe('POST /api/v1/business', () => {
    it('allows admin to create a new business profile (201)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(mockAdminUser);

      const mockCreated = {
        _id: businessId,
        name: 'Luxe Salon',
        timezone: 'Asia/Kolkata',
        phone: '+91 9999999999',
        address: { city: 'Mumbai' },
        operatingHours: validHours,
        ownerId: adminId,
      };

      jest.spyOn(Business, 'create').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Luxe Salon',
          phone: '+91 9999999999',
          address: { city: 'Mumbai' },
          operatingHours: validHours,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Luxe Salon');
      expect(res.body.message).toMatch(/created successfully/i);
    });

    it('rejects creation when business name is missing (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operatingHours: validHours,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/business name/i);
    });

    it('rejects creation when open time is equal to or after close time (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const invalidHours = [
        ...validHours.filter((h) => h.day !== 'Monday'),
        { day: 'Monday', open: '18:00', close: '09:00', isClosed: false }, // open > close
      ];

      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Luxe Salon',
          operatingHours: invalidHours,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/open time .* must be before close time/i);
    });

    it('rejects creation when time format is invalid (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const malformedHours = [
        ...validHours.filter((h) => h.day !== 'Monday'),
        { day: 'Monday', open: '25:99', close: '18:00', isClosed: false },
      ];

      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Luxe Salon',
          operatingHours: malformedHours,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid open time/i);
    });

    it('rejects customer from creating business (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .post('/api/v1/business')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Salon',
          operatingHours: validHours,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('rejects unauthenticated request (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/business')
        .send({ name: 'No Auth' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/business/:id', () => {
    it('allows public user to view business profile by ID (200)', async () => {
      const mockBusiness = {
        _id: businessId,
        name: 'Luxe Salon',
        timezone: 'Asia/Kolkata',
        operatingHours: validHours,
      };

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);

      const res = await request(app).get(`/api/v1/business/${businessId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Luxe Salon');
    });

    it('returns 404 when business ID is not found', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/business/${businessId}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/business', () => {
    it('returns admin own business profile (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const mockBusiness = {
        _id: businessId,
        name: 'Luxe Salon',
        timezone: 'Asia/Kolkata',
        operatingHours: validHours,
      };

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);

      const res = await request(app)
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(businessId);
    });

    it('returns 404 if admin has not created a business profile yet', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        ...mockAdminUser,
        businessId: null,
      });
      jest.spyOn(Business, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/business/:id', () => {
    it('allows admin to update own business details and operating hours (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const updated = {
        _id: businessId,
        name: 'Luxe Salon Renamed',
        timezone: 'Asia/Kolkata',
        operatingHours: validHours,
      };

      jest.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue(updated);

      const res = await request(app)
        .put(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Luxe Salon Renamed',
          operatingHours: validHours,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Luxe Salon Renamed');
    });

    it('rejects update if operating hours has open >= close (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const invalidHours = [
        ...validHours.filter((h) => h.day !== 'Friday'),
        { day: 'Friday', open: '19:00', close: '19:00', isClosed: false },
      ];

      const res = await request(app)
        .put(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operatingHours: invalidHours,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must be before close time/i);
    });

    it('R6: rejects customer from updating business (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .put(`/api/v1/business/${businessId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Hacked Name',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('R6: rejects admin from updating another business profile (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const res = await request(app)
        .put(`/api/v1/business/${otherBusinessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Other Business Name',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot access records from another business/i);
    });
  });
});
