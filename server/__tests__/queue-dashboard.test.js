const request = require('supertest');
const app = require('../app');
const QueueToken = require('../models/QueueToken');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

describe('Module 9: Queue Dashboard & Status Management (Rule R5)', () => {
  const businessId = '60d0fe4f5311236168a109aa';
  const otherBusinessId = '60d0fe4f5311236168a109bb';
  const serviceId = '60d0fe4f5311236168a109cc';
  const tokenId = '60d0fe4f5311236168a109ee';
  const customerId = '60d0fe4f5311236168a109f1';
  const staffUserId = '60d0fe4f5311236168a109f2';
  const adminUserId = '60d0fe4f5311236168a109f3';

  let customerJwt, staffJwt, adminJwt;

  const mockAdminUser = {
    _id: adminUserId,
    name: 'Admin User',
    role: 'admin',
    businessId,
  };

  const mockStaffUser = {
    _id: staffUserId,
    name: 'Staff User',
    role: 'staff',
    businessId,
  };

  const mockCustomerUser = {
    _id: customerId,
    name: 'Customer User',
    role: 'customer',
    businessId: null,
  };

  const makeToken = (overrides = {}) => ({
    _id: tokenId,
    businessId,
    serviceId,
    tokenNumber: 3,
    guestName: 'Alice',
    queueDate: new Date().toISOString().split('T')[0],
    status: 'waiting',
    calledAt: null,
    servedAt: null,
    completedAt: null,
    servedBy: null,
    customerId: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const populatedTokenResult = {
    _id: tokenId,
    tokenNumber: 3,
    guestName: 'Alice',
    status: 'called',
    serviceId: { name: 'Haircut', duration: 30, price: 25 },
    businessId: { name: 'Metro Barber' },
    servedBy: null,
  };

  beforeAll(() => {
    customerJwt = generateToken({ id: customerId, role: 'customer' });
    staffJwt = generateToken({ id: staffUserId, role: 'staff' });
    adminJwt = generateToken({ id: adminUserId, role: 'admin' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockTokenFindById = (tokenOverrides = {}) => {
    const token = makeToken(tokenOverrides);

    const populateChain = {
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(populatedTokenResult),
        }),
      }),
    };

    jest
      .spyOn(QueueToken, 'findById')
      .mockResolvedValueOnce(token)
      .mockReturnValueOnce(populateChain);

    return token;
  };

  const mockTokenNotFound = () => {
    jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(null);
  };

  describe('PATCH /api/v1/queue/tokens/:id/status — Rule R5 Transitions', () => {
    it('R5: waiting → called by staff succeeds (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenFindById({ status: 'waiting' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'called' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/called/i);
    });

    it('R5: waiting → cancelled by staff succeeds (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenFindById({ status: 'waiting' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
    });

    it('R5: called → in-service by staff succeeds (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenFindById({ status: 'called' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'in-service' });

      expect(res.status).toBe(200);
    });

    it('R5: called → no-show by staff succeeds (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenFindById({ status: 'called' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'no-show' });

      expect(res.status).toBe(200);
    });

    it('R5: in-service → completed by staff succeeds (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenFindById({ status: 'in-service' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
    });

    it('R5: admin can call a waiting token (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminUser);
      mockTokenFindById({ status: 'waiting' });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ status: 'called' });

      expect(res.status).toBe(200);
    });

    it('R5: waiting → completed is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'waiting' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
      expect(res.body.message).toMatch(/invalid transition/i);
    });

    it('R5: waiting → in-service is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'waiting' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'in-service' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R5: waiting → no-show is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'waiting' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'no-show' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R5: completed → cancelled is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'completed' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R5: cancelled → waiting (backward) is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'cancelled' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'waiting' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R5: no-show → in-service is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'no-show' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'in-service' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R5: called → waiting (backward) is rejected (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(makeToken({ status: 'called' }));

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'waiting' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/R5/);
    });

    it('R6: customer can cancel their own token (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      mockTokenFindById({ status: 'waiting', customerId });

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${customerJwt}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
    });

    it("R6: customer cannot update someone else's token (403)", async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const otherCustomerId = '60d0fe4f5311236168a109f8';
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(
        makeToken({ status: 'waiting', customerId: otherCustomerId })
      );

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${customerJwt}`)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/R6/);
    });

    it('R6: customer cannot call or start a token — only cancel allowed (403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(QueueToken, 'findById').mockResolvedValueOnce(
        makeToken({ status: 'waiting', customerId })
      );

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${customerJwt}`)
        .send({ status: 'called' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/R6/);
    });

    it('R6: returns 401 when no auth token is provided', async () => {
      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .send({ status: 'called' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when status field is missing from body', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/status is required/i);
    });

    it('returns 400 for an unrecognised status value', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'flying' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid status/i);
    });

    it('returns 404 when token does not exist', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      mockTokenNotFound();

      const res = await request(app)
        .patch(`/api/v1/queue/tokens/${tokenId}/status`)
        .set('Authorization', `Bearer ${staffJwt}`)
        .send({ status: 'called' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/queue token not found/i);
    });
  });
});
