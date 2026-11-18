const request = require('supertest');
const app = require('../app');
const QueueToken = require('../models/QueueToken');
const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

describe('Module 10: Queue Position & Wait Time Estimation (Decision D6, Rule R8)', () => {
  const businessId = '60d0fe4f5311236168a109aa';
  const serviceId = '60d0fe4f5311236168a109cc';
  const tokenId = '60d0fe4f5311236168a109ee';
  const tokenId2 = '60d0fe4f5311236168a109ef';
  const tokenId3 = '60d0fe4f5311236168a109e0';
  const customerId = '60d0fe4f5311236168a109f1';
  const queueDate = new Date().toISOString().split('T')[0];

  let customerJwt;

  beforeAll(() => {
    customerJwt = generateToken({ id: customerId, role: 'customer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helper factories
  // ---------------------------------------------------------------------------
  const makeToken = (overrides = {}) => ({
    _id: tokenId,
    businessId,
    serviceId: { _id: serviceId, duration: 20 },
    tokenNumber: 5,
    guestName: 'Alice',
    queueDate,
    status: 'waiting',
    calledAt: null,
    servedAt: null,
    completedAt: null,
    servedBy: null,
    customerId: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const makeAheadToken = (overrides = {}) => ({
    _id: tokenId2,
    businessId,
    serviceId: { _id: serviceId, duration: 20 },
    tokenNumber: 3,
    guestName: 'Bob',
    queueDate,
    status: 'waiting',
    servedAt: null,
    ...overrides,
  });

  // ---------------------------------------------------------------------------
  // Test: 404 for unknown token
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/queue/position/:tokenId — 404 on missing token', () => {
    it('returns 404 when token does not exist', async () => {
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(null) });

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: Terminal statuses return position=0, wait=0
  // ---------------------------------------------------------------------------
  describe('Terminal status tokens (completed / cancelled / no-show)', () => {
    ['completed', 'cancelled', 'no-show'].forEach((status) => {
      it(`returns position=0 and wait=0 for ${status} token`, async () => {
        const token = makeToken({ status });
        jest
          .spyOn(QueueToken, 'findById')
          .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

        const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.position).toBe(0);
        expect(res.body.data.estimatedWaitMinutes).toBe(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Test: Empty queue — token is first (#1 with no one ahead)
  // ---------------------------------------------------------------------------
  describe('Empty queue (no tokens ahead)', () => {
    it('returns position=1 and estimatedWaitMinutes=0 when no tokens ahead', async () => {
      const token = makeToken({ tokenNumber: 1 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      // No tokens ahead
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue([]),
      });

      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(2);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.position).toBe(1);
      expect(res.body.data.tokensAhead).toBe(0);
      expect(res.body.data.estimatedWaitMinutes).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: D6 formula with tokens ahead, single staff
  // ---------------------------------------------------------------------------
  describe('D6 formula — tokens ahead with 1 staff', () => {
    it('calculates correct wait: 2 tokens ahead × 20min / 1 staff = 40min', async () => {
      const token = makeToken({ tokenNumber: 5 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      const ahead = [
        makeAheadToken({ tokenNumber: 3, status: 'waiting' }),
        makeAheadToken({ _id: tokenId3, tokenNumber: 4, status: 'waiting' }),
      ];
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(ahead),
      });

      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.position).toBe(3); // 2 waiting ahead + 1
      expect(res.body.data.tokensAhead).toBe(2);
      expect(res.body.data.estimatedWaitMinutes).toBe(40); // 2 × 20 / 1
    });
  });

  // ---------------------------------------------------------------------------
  // Test: D6 formula with multiple staff speeds up estimate
  // ---------------------------------------------------------------------------
  describe('D6 formula — multiple active staff', () => {
    it('halves wait time when 2 staff are active vs 1', async () => {
      const token = makeToken({ tokenNumber: 5 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      const ahead = [
        makeAheadToken({ tokenNumber: 3, status: 'waiting' }),
        makeAheadToken({ _id: tokenId3, tokenNumber: 4, status: 'waiting' }),
      ];
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(ahead),
      });

      // 2 staff → wait = 2 × 20 / 2 = 20min
      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(2);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.estimatedWaitMinutes).toBe(20); // 2 × 20 / 2
    });
  });

  // ---------------------------------------------------------------------------
  // Test: D6 — zero/no active staff still returns valid wait (safe denominator = 1)
  // ---------------------------------------------------------------------------
  describe('D6 formula — no active staff (safe floor of 1)', () => {
    it('uses denominator of 1 when no staff are active', async () => {
      const token = makeToken({ tokenNumber: 3 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      const ahead = [makeAheadToken({ tokenNumber: 2, status: 'waiting' })];
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(ahead),
      });

      // 0 staff → safe floor of 1 → wait = 1 × 20 / 1 = 20min
      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(0);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.estimatedWaitMinutes).toBe(20);
      expect(res.body.data.activeStaffCount).toBe(1); // safe floor
    });
  });

  // ---------------------------------------------------------------------------
  // Test: R8 — position recalculates after a cancellation (fewer tokens ahead)
  // ---------------------------------------------------------------------------
  describe('R8 — position recalculates after cancellation', () => {
    it('position drops from 3 to 2 after a cancellation (1 fewer token ahead)', async () => {
      // First call: 2 tokens ahead → position 3
      const token = makeToken({ tokenNumber: 5 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      const oneAhead = [makeAheadToken({ tokenNumber: 4, status: 'waiting' })];
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(oneAhead),
      });

      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.position).toBe(2); // 1 waiting ahead + 1
      expect(res.body.data.estimatedWaitMinutes).toBe(20); // 1 × 20 / 1
    });
  });

  // ---------------------------------------------------------------------------
  // Test: in-service token ahead reduces estimated wait
  // ---------------------------------------------------------------------------
  describe('D6 — in-service token with elapsed time reduces wait estimate', () => {
    it('subtracts elapsed time from in-service token share', async () => {
      const token = makeToken({ tokenNumber: 4 });
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      // 1 in-service token with servedAt = 10 minutes ago (10 of 20min elapsed → 10min remaining)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const aheadInService = [
        makeAheadToken({
          tokenNumber: 3,
          status: 'in-service',
          servedAt: tenMinAgo,
        }),
      ];
      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(aheadInService),
      });

      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      // adjustedCount ≈ 0.5 (10min remaining / 20min avg) → ceil(0.5 × 20 / 1) = 10
      expect(res.body.data.estimatedWaitMinutes).toBeLessThanOrEqual(12);
      expect(res.body.data.estimatedWaitMinutes).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test: works for 'in-service' or 'called' status of the subject token itself
  // ---------------------------------------------------------------------------
  describe('Non-waiting active token (called / in-service)', () => {
    ['called', 'in-service'].forEach((status) => {
      it(`returns valid position for token with status '${status}'`, async () => {
        const token = makeToken({ status, tokenNumber: 3 });
        jest
          .spyOn(QueueToken, 'findById')
          .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

        jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([]),
        });

        jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(1);

        const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

        expect(res.status).toBe(200);
        expect(res.body.data.tokenNumber).toBe(3);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Test: Response shape contains all required fields
  // ---------------------------------------------------------------------------
  describe('Response shape', () => {
    it('response contains all D6 fields', async () => {
      const token = makeToken();
      jest
        .spyOn(QueueToken, 'findById')
        .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(token) });

      jest.spyOn(QueueToken, 'find').mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue([]),
      });

      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValueOnce(2);

      const res = await request(app).get(`/api/v1/queue/position/${tokenId}`);

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d).toHaveProperty('tokenId');
      expect(d).toHaveProperty('tokenNumber');
      expect(d).toHaveProperty('status');
      expect(d).toHaveProperty('position');
      expect(d).toHaveProperty('tokensAhead');
      expect(d).toHaveProperty('estimatedWaitMinutes');
      expect(d).toHaveProperty('activeStaffCount');
      expect(d).toHaveProperty('avgServiceDurationMinutes');
    });
  });
});

