const request = require('supertest');
const app = require('../app');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

describe('Module 11: Business Dashboard (Aggregation, Admin-scoped)', () => {
  const businessId = '60d0fe4f5311236168a109aa';
  const otherBusinessId = '60d0fe4f5311236168a109bb';
  const adminUserId = '60d0fe4f5311236168a109f3';
  const staffUserId = '60d0fe4f5311236168a109f2';
  const today = new Date().toISOString().split('T')[0];

  let adminJwt, staffJwt, noBusinessJwt;

  const mockAdmin = {
    _id: adminUserId,
    name: 'Admin User',
    role: 'admin',
    businessId,
  };

  const mockStaff = {
    _id: staffUserId,
    name: 'Staff User',
    role: 'staff',
    businessId,
  };

  const mockAdminNoBusinessId = {
    _id: adminUserId,
    name: 'Homeless Admin',
    role: 'admin',
    businessId: null,
  };

  beforeAll(() => {
    adminJwt = generateToken({ id: adminUserId, role: 'admin' });
    staffJwt = generateToken({ id: staffUserId, role: 'staff' });
    noBusinessJwt = generateToken({ id: 'noid111111111111111111', role: 'admin' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Empty-day aggregation mocks ───────────────────────────────────────────
  const mockEmptyAggregation = () => {
    jest.spyOn(Appointment, 'aggregate').mockResolvedValue([]);
    jest.spyOn(QueueToken, 'aggregate').mockResolvedValue([]);
  };

  // ── Populated aggregation mocks ───────────────────────────────────────────
  const mockFullAggregation = ({
    apptStats = {
      _id: null, total: 10, scheduled: 4, completed: 5, cancelled: 1, noShow: 0,
    },
    queueStats = {
      _id: null, total: 8, waiting: 2, called: 1, inService: 1,
      completed: 3, cancelled: 1, noShow: 0,
    },
    revenue = [{ _id: null, estimatedRevenue: 250 }],
    topServices = [
      { serviceId: 'svc1', name: 'Haircut', count: 5 },
      { serviceId: 'svc2', name: 'Colour', count: 3 },
    ],
  } = {}) => {
    // Appointment.aggregate is called 3 times: summary, revenue, topServices
    jest
      .spyOn(Appointment, 'aggregate')
      .mockResolvedValueOnce([apptStats])   // summary
      .mockResolvedValueOnce(revenue)        // revenue
      .mockResolvedValueOnce(topServices);   // topServices
    jest.spyOn(QueueToken, 'aggregate').mockResolvedValueOnce([queueStats]);
  };

  // ── Auth & Role tests ────────────────────────────────────────────────────
  describe('Authentication & Authorization', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/business/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('returns 403 when staff (non-admin) accesses dashboard', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaff);

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${staffJwt}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 when admin has no businessId linked', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdminNoBusinessId);

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/No business associated/i);
    });
  });

  // ── Empty day returns all zeros ──────────────────────────────────────────
  describe('Empty day (no appointments, no queue tokens)', () => {
    it('returns all-zero summary when no data for the date', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${today}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { summary, topServices } = res.body.data;
      expect(summary.totalAppointments).toBe(0);
      expect(summary.completedAppointments).toBe(0);
      expect(summary.totalQueueTokens).toBe(0);
      expect(summary.activeQueueCount).toBe(0);
      expect(summary.estimatedRevenue).toBe(0);
      expect(topServices).toEqual([]);
    });
  });

  // ── Populated data returns correct numbers ───────────────────────────────
  describe('Populated day — correct aggregation', () => {
    it('returns correct appointment counts (10 total, 5 completed, 4 scheduled)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockFullAggregation();

      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${today}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      const { appointments, summary } = res.body.data;
      expect(appointments.total).toBe(10);
      expect(appointments.completed).toBe(5);
      expect(appointments.scheduled).toBe(4);
      expect(appointments.cancelled).toBe(1);
      expect(summary.totalAppointments).toBe(10);
      expect(summary.completedAppointments).toBe(5);
    });

    it('returns correct queue token counts and activeQueueCount', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockFullAggregation();

      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${today}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      const { queue, summary } = res.body.data;
      expect(queue.total).toBe(8);
      expect(queue.waiting).toBe(2);
      expect(queue.inService).toBe(1);
      // activeQueueCount = waiting + called + inService = 2 + 1 + 1 = 4
      expect(summary.activeQueueCount).toBe(4);
      expect(summary.waitingInQueue).toBe(2);
    });

    it('returns estimated revenue from completed appointments', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockFullAggregation();

      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${today}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.estimatedRevenue).toBe(250);
    });

    it('returns top services sorted by appointment count', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockFullAggregation();

      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${today}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      const { topServices } = res.body.data;
      expect(topServices.length).toBe(2);
      expect(topServices[0].name).toBe('Haircut');
      expect(topServices[0].count).toBe(5);
      expect(topServices[1].name).toBe('Colour');
    });
  });

  // ── Date parameter tests ─────────────────────────────────────────────────
  describe('Date parameter handling', () => {
    it('defaults to today when no date param is provided', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(today);
    });

    it('accepts a specific date parameter', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const specificDate = '2026-11-15';
      const res = await request(app)
        .get(`/api/v1/business/dashboard/summary?date=${specificDate}`)
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(specificDate);
    });

    it('returns 400 for an invalid date format', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary?date=18-11-2026')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid date format/i);
    });
  });

  // ── Response shape ───────────────────────────────────────────────────────
  describe('Response shape', () => {
    it('response contains all required top-level fields', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('date');
      expect(data).toHaveProperty('businessId');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('appointments');
      expect(data).toHaveProperty('queue');
      expect(data).toHaveProperty('topServices');
    });

    it('summary contains all M11 card fields', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      const { summary } = res.body.data;
      expect(summary).toHaveProperty('totalAppointments');
      expect(summary).toHaveProperty('scheduledAppointments');
      expect(summary).toHaveProperty('completedAppointments');
      expect(summary).toHaveProperty('cancelledAppointments');
      expect(summary).toHaveProperty('noShowAppointments');
      expect(summary).toHaveProperty('totalQueueTokens');
      expect(summary).toHaveProperty('activeQueueCount');
      expect(summary).toHaveProperty('waitingInQueue');
      expect(summary).toHaveProperty('inServiceCount');
      expect(summary).toHaveProperty('completedQueueTokens');
      expect(summary).toHaveProperty('estimatedRevenue');
    });
  });

  // ── Edge: revenue = 0 when no completed appointments ────────────────────
  describe('Edge cases', () => {
    it('estimatedRevenue is 0 when no appointments are completed', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      // All appointments scheduled, revenue aggregation returns empty
      jest
        .spyOn(Appointment, 'aggregate')
        .mockResolvedValueOnce([{
          _id: null, total: 3, scheduled: 3, completed: 0, cancelled: 0, noShow: 0,
        }])
        .mockResolvedValueOnce([])    // revenue = empty
        .mockResolvedValueOnce([]);   // topServices = empty
      jest.spyOn(QueueToken, 'aggregate').mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.estimatedRevenue).toBe(0);
      expect(res.body.data.summary.completedAppointments).toBe(0);
    });

    it('activeQueueCount = 0 on empty queue day', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockAdmin);
      mockEmptyAggregation();

      const res = await request(app)
        .get('/api/v1/business/dashboard/summary')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.body.data.summary.activeQueueCount).toBe(0);
    });
  });
});

