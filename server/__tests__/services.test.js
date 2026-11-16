const request = require('supertest');
const app = require('../app');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

describe('Module 3: Service Management', () => {
  const adminId = '60d0fe4f5311236168a109aa';
  const customerId = '60d0fe4f5311236168a109bb';
  const businessId = '60d0fe4f5311236168a109cc';
  const otherBusinessId = '60d0fe4f5311236168a109dd';
  const serviceId = '60d0fe4f5311236168a109ee';

  let adminToken;
  let customerToken;

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

  const mockService = {
    _id: serviceId,
    name: 'Haircut & Styling',
    description: 'Basic cut and wash',
    duration: 45,
    price: 500,
    businessId: businessId,
    isActive: true,
  };

  describe('POST /api/v1/services', () => {
    it('allows admin to create a new service (201)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(Service, 'create').mockResolvedValue(mockService);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Haircut & Styling',
          description: 'Basic cut and wash',
          duration: 45,
          price: 500,
          businessId: businessId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Haircut & Styling');
      expect(res.body.data.duration).toBe(45);
      expect(res.body.data.price).toBe(500);
    });

    it('rejects creation when duration is zero or negative (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Duration',
          duration: 0,
          price: 100,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/duration must be greater than zero/i);
    });

    it('rejects creation when price is negative (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Price',
          duration: 30,
          price: -50,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/price cannot be negative/i);
    });

    it('rejects creation when name is missing (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          duration: 30,
          price: 100,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/provide service name/i);
    });

    it('rejects customer from creating service (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Haircut',
          duration: 30,
          price: 100,
          businessId: businessId,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/services', () => {
    it('returns list of active services for a business (200)', async () => {
      jest.spyOn(Service, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockService]),
      });

      const res = await request(app)
        .get(`/api/v1/services?businessId=${businessId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].name).toBe('Haircut & Styling');
    });

    it('rejects listing when businessId is not provided (400)', async () => {
      const res = await request(app).get('/api/v1/services');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/services/:id', () => {
    it('returns single service by ID (200)', async () => {
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app).get(`/api/v1/services/${serviceId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(serviceId);
    });

    it('returns 404 when service is not found', async () => {
      jest.spyOn(Service, 'findById').mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/services/${serviceId}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/services/:id', () => {
    it('allows admin to update service details (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const serviceDoc = {
        ...mockService,
        save: jest.fn().mockResolvedValue({
          ...mockService,
          name: 'Deluxe Haircut',
          duration: 60,
          price: 650,
        }),
      };
      jest.spyOn(Service, 'findById').mockResolvedValue(serviceDoc);

      const res = await request(app)
        .put(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Deluxe Haircut',
          duration: 60,
          price: 650,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Deluxe Haircut');
    });

    it('rejects admin updating service of another business (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const foreignService = {
        ...mockService,
        businessId: otherBusinessId,
      };
      jest.spyOn(Service, 'findById').mockResolvedValue(foreignService);

      const res = await request(app)
        .put(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Hacked Service',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/services/:id — Rule R3', () => {
    it('R3: a service with future appointments is deactivated, never deleted', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const serviceDoc = {
        ...mockService,
        isActive: true,
        save: jest.fn().mockResolvedValue({
          ...mockService,
          isActive: false,
        }),
      };
      jest.spyOn(Service, 'findById').mockResolvedValue(serviceDoc);
      const deleteSpy = jest.spyOn(Service, 'findByIdAndDelete');

      // Simulate future appointments exist
      jest.spyOn(Appointment, 'exists').mockResolvedValue({ _id: 'appt123' });

      const res = await request(app)
        .delete(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeactivated).toBe(true);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.message).toMatch(/deactivated instead of deleted \(Rule R3\)/i);

      // Verify it was NOT hard-deleted
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(serviceDoc.save).toHaveBeenCalled();
    });

    it('R3: a service without future appointments is deleted', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const serviceDoc = {
        ...mockService,
      };
      jest.spyOn(Service, 'findById').mockResolvedValue(serviceDoc);
      const deleteSpy = jest.spyOn(Service, 'findByIdAndDelete').mockResolvedValue(serviceDoc);

      // Simulate NO future appointments
      jest.spyOn(Appointment, 'exists').mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith(serviceId);
    });

    it('rejects customer from deleting service (403 Forbidden)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .delete(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
