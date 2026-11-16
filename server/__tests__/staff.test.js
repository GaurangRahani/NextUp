const request = require('supertest');
const app = require('../app');
const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const Service = require('../models/Service');
const Business = require('../models/Business');
const { generateToken } = require('../utils/jwt');

describe('Module 4: Staff Management & Service Assignment', () => {
  const adminId = '60d0fe4f5311236168a109aa';
  const staffUserId = '60d0fe4f5311236168a109bb';
  const customerId = '60d0fe4f5311236168a109cc';
  const businessId = '60d0fe4f5311236168a109dd';
  const otherBusinessId = '60d0fe4f5311236168a109ee';
  const staffProfileId = '60d0fe4f5311236168a109ff';
  const serviceId1 = '60d0fe4f5311236168a10911';
  const serviceId2 = '60d0fe4f5311236168a10922';
  const foreignServiceId = '60d0fe4f5311236168a10933';

  let adminToken;
  let staffToken;
  let customerToken;

  beforeAll(() => {
    adminToken = generateToken({ id: adminId, role: 'admin' });
    staffToken = generateToken({ id: staffUserId, role: 'staff' });
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

  const mockStaffUser = {
    _id: staffUserId,
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    role: 'staff',
    businessId: businessId,
  };

  const mockCustomerUser = {
    _id: customerId,
    name: 'Customer User',
    email: 'customer@example.com',
    role: 'customer',
    businessId: null,
  };

  const mockService1 = {
    _id: serviceId1,
    name: 'Haircut',
    duration: 30,
    price: 300,
    businessId: businessId,
    isActive: true,
  };

  const mockService2 = {
    _id: serviceId2,
    name: 'Beard Trim',
    duration: 15,
    price: 150,
    businessId: businessId,
    isActive: true,
  };

  const mockForeignService = {
    _id: foreignServiceId,
    name: 'Other Clinic Service',
    duration: 60,
    price: 1000,
    businessId: otherBusinessId,
    isActive: true,
  };

  const mockStaffProfile = {
    _id: staffProfileId,
    userId: mockStaffUser,
    businessId: businessId,
    serviceIds: [mockService1, mockService2],
    isActive: true,
    save: jest.fn().mockResolvedValue(this),
  };

  describe('POST /api/v1/staff', () => {
    it('allows admin to create a new staff member and assign services (201)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Service, 'find').mockResolvedValue([mockService1, mockService2]);
      jest.spyOn(User, 'create').mockResolvedValue(mockStaffUser);
      jest.spyOn(StaffProfile, 'create').mockResolvedValue({
        _id: staffProfileId,
        userId: staffUserId,
        businessId,
        serviceIds: [serviceId1, serviceId2],
        isActive: true,
      });

      const populateQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      // For chain: findById().populate().populate()
      populateQuery.populate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockStaffProfile),
      });
      jest.spyOn(StaffProfile, 'findById').mockReturnValue(populateQuery);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rahul Sharma',
          email: 'rahul@example.com',
          password: 'password123',
          serviceIds: [serviceId1, serviceId2],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId.name).toBe('Rahul Sharma');
    });

    it('rejects cross-business service assignment (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      // Return foreign service
      jest.spyOn(Service, 'find').mockResolvedValue([mockService1, mockForeignService]);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rahul Sharma',
          email: 'rahul@example.com',
          password: 'password123',
          serviceIds: [serviceId1, foreignServiceId],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/different business/i);
    });

    it('rejects duplicate user email when creating new staff (409)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(Service, 'find').mockResolvedValue([]);
      jest.spyOn(User, 'findOne').mockResolvedValue(mockStaffUser);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rahul Sharma',
          email: 'rahul@example.com',
          password: 'password123',
          serviceIds: [],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects non-admin role from creating staff (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'New Staff',
          email: 'staff@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app).post('/api/v1/staff').send({
        name: 'New Staff',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/staff', () => {
    it('lists staff members for a business (200)', async () => {
      const populateChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([mockStaffProfile]),
      };
      populateChain.populate.mockReturnValue(populateChain);
      jest.spyOn(StaffProfile, 'find').mockReturnValue(populateChain);

      const res = await request(app)
        .get(`/api/v1/staff?businessId=${businessId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('filters staff by serviceId (200)', async () => {
      const findSpy = jest.spyOn(StaffProfile, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([mockStaffProfile]),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/v1/staff?businessId=${businessId}&serviceId=${serviceId1}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: businessId,
          serviceIds: serviceId1,
          isActive: true,
        })
      );
    });

    it('requires businessId if not authenticated (400)', async () => {
      const res = await request(app).get('/api/v1/staff');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/staff/:id', () => {
    it('returns staff profile by id (200)', async () => {
      jest.spyOn(StaffProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockStaffProfile),
        }),
      });

      const res = await request(app).get(`/api/v1/staff/${staffProfileId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(staffProfileId);
    });

    it('returns 404 for unknown staff id', async () => {
      jest.spyOn(StaffProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      const res = await request(app).get(`/api/v1/staff/60d0fe4f5311236168a10900`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/staff/:id', () => {
    it('allows admin to update staff profile and name (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        ...mockStaffUser,
        name: 'Rahul S. Updated',
      });

      const mockDoc = {
        _id: staffProfileId,
        userId: staffUserId,
        businessId: businessId,
        serviceIds: [serviceId1],
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(StaffProfile, 'findById')
        .mockResolvedValueOnce(mockDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              ...mockDoc,
              userId: { ...mockStaffUser, name: 'Rahul S. Updated' },
            }),
          }),
        });

      const res = await request(app)
        .put(`/api/v1/staff/${staffProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rahul S. Updated',
          isActive: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects cross-business service update in staff profile (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);

      const mockDoc = {
        _id: staffProfileId,
        userId: staffUserId,
        businessId: businessId,
        serviceIds: [serviceId1],
        isActive: true,
        save: jest.fn(),
      };
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(mockDoc);
      jest.spyOn(Service, 'find').mockResolvedValue([mockForeignService]);

      const res = await request(app)
        .put(`/api/v1/staff/${staffProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceIds: [foreignServiceId],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/different business/i);
    });

    it('rejects customer from updating staff profile (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .put(`/api/v1/staff/${staffProfileId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/staff/:id/services', () => {
    it('assigns services to staff member successfully (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      jest.spyOn(Service, 'find').mockResolvedValue([mockService1, mockService2]);

      const mockDoc = {
        _id: staffProfileId,
        businessId: businessId,
        serviceIds: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(StaffProfile, 'findById')
        .mockResolvedValueOnce(mockDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              ...mockDoc,
              serviceIds: [mockService1, mockService2],
            }),
          }),
        });

      const res = await request(app)
        .put(`/api/v1/staff/${staffProfileId}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serviceIds: [serviceId1, serviceId2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.serviceIds).toEqual([serviceId1, serviceId2]);
    });

    it('rejects cross-business services in dedicated assignment endpoint (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      const mockDoc = {
        _id: staffProfileId,
        businessId: businessId,
        serviceIds: [],
      };
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(mockDoc);
      jest.spyOn(Service, 'find').mockResolvedValue([mockForeignService]);

      const res = await request(app)
        .put(`/api/v1/staff/${staffProfileId}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serviceIds: [foreignServiceId] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/different business/i);
    });
  });

  describe('DELETE /api/v1/staff/:id (Deactivate)', () => {
    it('allows admin to deactivate a staff member (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      const mockDoc = {
        _id: staffProfileId,
        businessId: businessId,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .delete(`/api/v1/staff/${staffProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeactivated).toBe(true);
      expect(mockDoc.isActive).toBe(false);
    });

    it('rejects non-admin from deactivating staff (403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .delete(`/api/v1/staff/${staffProfileId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
