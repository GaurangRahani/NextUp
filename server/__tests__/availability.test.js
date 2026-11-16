const request = require('supertest');
const app = require('../app');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Business = require('../models/Business');
const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { DEFAULT_OPERATING_HOURS } = require('../utils/hoursValidator');
const { hasOverlap } = require('../utils/conflictChecker');

describe('Module 6: Availability & Conflict Prevention (Rule R1)', () => {
  const customerId = '60d0fe4f5311236168a109aa';
  const staffUserId1 = '60d0fe4f5311236168a109bb';
  const staffUserId2 = '60d0fe4f5311236168a109bc';
  const businessId = '60d0fe4f5311236168a109cc';
  const serviceId = '60d0fe4f5311236168a109dd';

  let customerToken;

  beforeAll(() => {
    customerToken = generateToken({ id: customerId, role: 'customer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Calculate future date helper
  const getFutureDateString = (daysAhead = 14) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  const getNextSundayString = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    return d.toISOString().split('T')[0];
  };

  const mockCustomerUser = {
    _id: customerId,
    name: 'Customer Deep',
    email: 'customer@example.com',
    role: 'customer',
  };

  const mockBusiness = {
    _id: businessId,
    name: 'Apex Salon & Spa',
    timezone: 'Asia/Kolkata',
    operatingHours: DEFAULT_OPERATING_HOURS,
  };

  const mockService = {
    _id: serviceId,
    name: 'Haircut & Styling',
    duration: 30, // 30 min service
    price: 300,
    businessId: businessId,
    isActive: true,
  };

  const mockStaffProfile1 = {
    _id: '60d0fe4f5311236168a10911',
    userId: staffUserId1,
    businessId: businessId,
    serviceIds: [serviceId],
    isActive: true,
  };

  const mockStaffProfile2 = {
    _id: '60d0fe4f5311236168a10922',
    userId: staffUserId2,
    businessId: businessId,
    serviceIds: [serviceId],
    isActive: true,
  };

  describe('Rule R1: Mathematical Interval Overlap Utility', () => {
    it('R1: recognizes exact same interval as overlap', () => {
      expect(hasOverlap('10:00', '10:30', '10:00', '10:30')).toBe(true);
    });

    it('R1: recognizes partial overlap (starts before, ends inside)', () => {
      expect(hasOverlap('09:45', '10:15', '10:00', '10:30')).toBe(true);
    });

    it('R1: recognizes partial overlap (starts inside, ends after)', () => {
      expect(hasOverlap('10:15', '10:45', '10:00', '10:30')).toBe(true);
    });

    it('R1: recognizes complete enclosure (starts before, ends after)', () => {
      expect(hasOverlap('09:30', '11:00', '10:00', '10:30')).toBe(true);
    });

    it('R1: explicitly allows back-to-back appointments (no overlap)', () => {
      // Slot immediately before
      expect(hasOverlap('09:30', '10:00', '10:00', '10:30')).toBe(false);
      // Slot immediately after
      expect(hasOverlap('10:30', '11:00', '10:00', '10:30')).toBe(false);
    });
  });

  describe('Rule R1: Conflict Prevention on Booking (POST /api/v1/appointments)', () => {
    it('R1: allows back-to-back appointment for the same staff member (201)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      // Existing appointment: 10:00 - 10:30
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          _id: 'existing1',
          staffId: staffUserId1,
          date: new Date(futureDate),
          startTime: '10:00',
          endTime: '10:30',
          status: 'scheduled',
        },
      ]);

      // Booking 10:30 - 11:00 (back-to-back)
      jest.spyOn(Appointment, 'create').mockResolvedValue({
        _id: 'newAppt',
        staffId: staffUserId1,
        date: new Date(futureDate),
        startTime: '10:30',
        endTime: '11:00',
        status: 'scheduled',
      });

      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'newAppt',
          staffId: { name: 'Rahul' },
          serviceId: mockService,
          startTime: '10:30',
          endTime: '11:00',
        }),
      });

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '10:30',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('R1: rejects overlapping appointment for the same staff member (409 Conflict)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      // Existing appointment: 10:00 - 10:30
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          _id: 'existing1',
          staffId: staffUserId1,
          date: new Date(futureDate),
          startTime: '10:00',
          endTime: '10:30',
          status: 'scheduled',
        },
      ]);

      // Attempt booking 10:15 (overlaps 10:00 - 10:30)
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '10:15',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/overlapping appointment/i);
    });

    it('R1: excludes cancelled appointments from conflict checks (allows rebooking)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      // Cancelled appointments are filtered out by query { status: { $ne: 'cancelled' } }
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);

      jest.spyOn(Appointment, 'create').mockResolvedValue({
        _id: 'newAppt',
        staffId: staffUserId1,
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
      });

      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'newAppt',
          startTime: '10:00',
          endTime: '10:30',
        }),
      });

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '10:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('R1: DB safeguard catches concurrent duplicate bookings (code 11000 -> 409 Conflict)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      // Pre-check finds no conflict
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);

      // But simultaneous request won race and DB unique index threw 11000
      const mongoDuplicateError = new Error('E11000 duplicate key error');
      mongoDuplicateError.code = 11000;
      jest.spyOn(Appointment, 'create').mockRejectedValue(mongoDuplicateError);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '10:00',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/overlapping appointment/i);
    });
  });

  describe('GET /api/v1/availability (Real-Time Slot Engine)', () => {
    it('returns slot availability reflecting existing appointments and back-to-back slots (200)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      // Existing appointment at 10:00 - 10:30
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          _id: 'app1',
          staffId: staffUserId1,
          startTime: '10:00',
          endTime: '10:30',
          status: 'scheduled',
        },
      ]);

      const res = await request(app).get(
        `/api/v1/availability?businessId=${businessId}&serviceId=${serviceId}&date=${futureDate}&staffId=${staffUserId1}`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const slots = res.body.data.slots;
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);

      // 10:00 - 10:30 should be unavailable (conflict)
      const slot1000 = slots.find((s) => s.startTime === '10:00');
      expect(slot1000).toBeDefined();
      expect(slot1000.isAvailable).toBe(false);
      expect(slot1000.reason).toBe('Conflict');

      // 10:15 - 10:45 should be unavailable (partial overlap)
      const slot1015 = slots.find((s) => s.startTime === '10:15');
      expect(slot1015).toBeDefined();
      expect(slot1015.isAvailable).toBe(false);

      // 10:30 - 11:00 should be available (back-to-back allowed)
      const slot1030 = slots.find((s) => s.startTime === '10:30');
      expect(slot1030).toBeDefined();
      expect(slot1030.isAvailable).toBe(true);
    });

    it('R1: slot remains available if at least one staff member is free ("any" staff pool)', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'find').mockResolvedValue([mockStaffProfile1, mockStaffProfile2]);

      // Only staff 1 is booked at 10:00, staff 2 is free!
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          _id: 'app1',
          staffId: staffUserId1,
          startTime: '10:00',
          endTime: '10:30',
          status: 'scheduled',
        },
      ]);

      const res = await request(app).get(
        `/api/v1/availability?businessId=${businessId}&serviceId=${serviceId}&date=${futureDate}&staffId=any`
      );

      expect(res.status).toBe(200);
      const slot1000 = res.body.data.slots.find((s) => s.startTime === '10:00');
      expect(slot1000.isAvailable).toBe(true);
      expect(slot1000.availableStaff).toContain(staffUserId2);
    });

    it('returns empty slots when business is closed on that day', async () => {
      const sundayDate = getNextSundayString();

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app).get(
        `/api/v1/availability?businessId=${businessId}&serviceId=${serviceId}&date=${sundayDate}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toEqual([]);
      expect(res.body.message).toMatch(/closed/i);
    });

    it('rejects request with missing query parameters (400)', async () => {
      const res = await request(app).get('/api/v1/availability');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
