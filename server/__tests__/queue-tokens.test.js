const request = require('supertest');
const app = require('../app');
const QueueToken = require('../models/QueueToken');
const DailyCounter = require('../models/DailyCounter');
const Business = require('../models/Business');
const Service = require('../models/Service');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { DEFAULT_OPERATING_HOURS } = require('../utils/hoursValidator');

describe('Module 8: Walk-in Token Generation (Rule R4)', () => {
  const businessId = '60d0fe4f5311236168a109aa';
  const otherBusinessId = '60d0fe4f5311236168a109bb';
  const serviceId = '60d0fe4f5311236168a109cc';
  const customerId = '60d0fe4f5311236168a109dd';
  const tokenId = '60d0fe4f5311236168a109ee';

  let customerJwt;

  const mockOpenHours = DEFAULT_OPERATING_HOURS.map((entry) => ({
    ...entry,
    isClosed: false,
    open: '08:00',
    close: '20:00',
  }));

  const mockBusiness = {
    _id: businessId,
    name: 'Metro Barber & Spa',
    operatingHours: mockOpenHours,
  };

  const mockService = {
    _id: serviceId,
    name: 'Quick Haircut',
    duration: 30,
    price: 25,
    businessId: businessId,
    isActive: true,
  };

  const mockCustomer = {
    _id: customerId,
    name: 'John Authenticated',
    email: 'john@example.com',
    role: 'customer',
  };

  beforeAll(() => {
    customerJwt = generateToken({ id: customerId, role: 'customer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/queue/tokens — Rule R4 Verification', () => {
    it('R4: generates sequential token number starting at 1 for the business today', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      jest.spyOn(DailyCounter, 'findOneAndUpdate').mockResolvedValue({
        businessId,
        date: new Date().toISOString().split('T')[0],
        count: 1,
      });

      const mockCreatedToken = {
        _id: tokenId,
        businessId,
        serviceId,
        tokenNumber: 1,
        guestName: 'Walk-in Guest 1',
        guestPhone: '9876543210',
        queueDate: new Date().toISOString().split('T')[0],
        status: 'waiting',
      };

      jest.spyOn(QueueToken, 'create').mockResolvedValue(mockCreatedToken);
      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            ...mockCreatedToken,
            serviceId: { name: 'Quick Haircut', duration: 30, price: 25 },
            businessId: { name: 'Metro Barber & Spa' },
          }),
        }),
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Walk-in Guest 1',
        guestPhone: '9876543210',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokenNumber).toBe(1);
      expect(res.body.data.status).toBe('waiting');
      expect(DailyCounter.findOneAndUpdate).toHaveBeenCalledWith(
        { businessId, date: new Date().toISOString().split('T')[0] },
        { $inc: { count: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    });

    it('R4: increments sequentially (token #2, #3) on subsequent token requests', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      jest.spyOn(DailyCounter, 'findOneAndUpdate').mockResolvedValue({
        businessId,
        date: new Date().toISOString().split('T')[0],
        count: 2,
      });

      const mockCreatedToken = {
        _id: tokenId,
        businessId,
        serviceId,
        tokenNumber: 2,
        guestName: 'Walk-in Guest 2',
        queueDate: new Date().toISOString().split('T')[0],
        status: 'waiting',
      };

      jest.spyOn(QueueToken, 'create').mockResolvedValue(mockCreatedToken);
      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockCreatedToken),
        }),
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Walk-in Guest 2',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tokenNumber).toBe(2);
    });

    it('R4: isolates token sequences between different businesses on the same day', async () => {
      const mockBusiness2 = {
        _id: otherBusinessId,
        name: 'Second Salon',
        operatingHours: mockOpenHours,
      };
      const mockService2 = {
        _id: serviceId,
        name: 'Shave',
        businessId: otherBusinessId,
        isActive: true,
      };

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness2);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService2);

      // Business 2 has its own counter starting at 1 even if Business 1 is at 50
      jest.spyOn(DailyCounter, 'findOneAndUpdate').mockResolvedValue({
        businessId: otherBusinessId,
        date: new Date().toISOString().split('T')[0],
        count: 1,
      });

      const mockCreatedToken = {
        _id: tokenId,
        businessId: otherBusinessId,
        serviceId,
        tokenNumber: 1,
        guestName: 'Other Biz Guest',
        status: 'waiting',
      };

      jest.spyOn(QueueToken, 'create').mockResolvedValue(mockCreatedToken);
      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockCreatedToken),
        }),
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId: otherBusinessId,
        serviceId,
        guestName: 'Other Biz Guest',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tokenNumber).toBe(1);
      expect(DailyCounter.findOneAndUpdate).toHaveBeenCalledWith(
        { businessId: otherBusinessId, date: new Date().toISOString().split('T')[0] },
        expect.anything(),
        expect.anything()
      );
    });

    it('R4: binds authenticated user to customerId and defaults guestName', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomer);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      jest.spyOn(DailyCounter, 'findOneAndUpdate').mockResolvedValue({
        businessId,
        date: new Date().toISOString().split('T')[0],
        count: 3,
      });

      let capturedCreationArgs;
      jest.spyOn(QueueToken, 'create').mockImplementation((args) => {
        capturedCreationArgs = args;
        return Promise.resolve({ ...args, _id: tokenId });
      });

      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: tokenId,
            customerId,
            guestName: 'John Authenticated',
            tokenNumber: 3,
          }),
        }),
      });

      const res = await request(app)
        .post('/api/v1/queue/tokens')
        .set('Authorization', `Bearer ${customerJwt}`)
        .send({
          businessId,
          serviceId,
        });

      expect(res.status).toBe(201);
      expect(capturedCreationArgs.customerId).toBe(customerId);
      expect(capturedCreationArgs.guestName).toBe('John Authenticated');
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects with 400 when businessId is missing', async () => {
      const res = await request(app).post('/api/v1/queue/tokens').send({
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/business id is required/i);
    });

    it('rejects with 400 when serviceId is missing', async () => {
      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/service id is required/i);
    });

    it('rejects with 404 when business does not exist', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(null);

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/business not found/i);
    });

    it('rejects with 404 when service does not exist', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(null);

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/service not found/i);
    });

    it('rejects with 400 when service does not belong to the business', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue({
        ...mockService,
        businessId: otherBusinessId,
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to this business/i);
    });

    it('rejects with 400 when service is deactivated', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue({
        ...mockService,
        isActive: false,
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/service is currently deactivated/i);
    });

    it('rejects with 400 when guestName is missing or too short for guest user', async () => {
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'A',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 2 characters/i);
    });

    it('rejects with 400 when business is closed today', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const todayDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        new Date().getDay()
      ];

      const closedHours = mockOpenHours.map((entry) => ({
        ...entry,
        isClosed: entry.day === todayDay ? true : entry.isClosed,
      }));

      jest.spyOn(Business, 'findById').mockResolvedValue({
        ...mockBusiness,
        operatingHours: closedHours,
      });

      const res = await request(app).post('/api/v1/queue/tokens').send({
        businessId,
        serviceId,
        guestName: 'Alice',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/business is closed today/i);
    });
  });

  describe('GET /api/v1/queue/tokens/:id', () => {
    it('returns token details when found', async () => {
      const mockTokenDoc = {
        _id: tokenId,
        tokenNumber: 5,
        status: 'waiting',
        guestName: 'Bob',
      };

      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTokenDoc),
        }),
      });

      const res = await request(app).get(`/api/v1/queue/tokens/${tokenId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokenNumber).toBe(5);
    });

    it('returns 404 when token is not found', async () => {
      jest.spyOn(QueueToken, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      const res = await request(app).get(`/api/v1/queue/tokens/${tokenId}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/token not found/i);
    });
  });

  describe('GET /api/v1/queue/today', () => {
    it('returns tokens for today for the specified business', async () => {
      const mockList = [
        { _id: '1', tokenNumber: 1, guestName: 'Alice', status: 'waiting' },
        { _id: '2', tokenNumber: 2, guestName: 'Bob', status: 'waiting' },
      ];

      jest.spyOn(QueueToken, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const res = await request(app).get(`/api/v1/queue/today?businessId=${businessId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].tokenNumber).toBe(1);
    });

    it('requires businessId query parameter', async () => {
      const res = await request(app).get('/api/v1/queue/today');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/businessId query parameter is required/i);
    });
  });
});
