const request = require('supertest');
const app = require('../app');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Business = require('../models/Business');
const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { DEFAULT_OPERATING_HOURS } = require('../utils/hoursValidator');

describe('Module 5: Appointment Booking (Rule R2)', () => {
  const customerId = '60d0fe4f5311236168a109aa';
  const otherCustomerId = '60d0fe4f5311236168a109ab';
  const staffUserId1 = '60d0fe4f5311236168a109bb';
  const staffUserId2 = '60d0fe4f5311236168a109bc';
  const businessId = '60d0fe4f5311236168a109cc';
  const serviceId = '60d0fe4f5311236168a109dd';
  const appointmentId = '60d0fe4f5311236168a109ee';

  let customerToken;
  let otherCustomerToken;

  beforeAll(() => {
    customerToken = generateToken({ id: customerId, role: 'customer' });
    otherCustomerToken = generateToken({ id: otherCustomerId, role: 'customer' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Calculate future date helper
  const getFutureDateString = (daysAhead = 5) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    // Find next weekday (e.g. Tuesday = not closed Sunday)
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  // Find next Sunday (closed day)
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

  const mockOtherCustomerUser = {
    _id: otherCustomerId,
    name: 'Other Customer',
    email: 'other@example.com',
    role: 'customer',
  };

  const mockBusiness = {
    _id: businessId,
    name: 'Apex Salon & Spa',
    timezone: 'Asia/Kolkata',
    operatingHours: DEFAULT_OPERATING_HOURS, // Monday-Friday 09:00-18:00, Saturday 10:00-17:00, Sunday closed
  };

  const mockService = {
    _id: serviceId,
    name: 'Haircut & Styling',
    duration: 45,
    price: 500,
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

  const mockAppointmentDoc = {
    _id: appointmentId,
    customerId: mockCustomerUser,
    staffId: { _id: staffUserId1, name: 'Rahul Sharma', email: 'rahul@example.com' },
    serviceId: mockService,
    businessId: mockBusiness,
    date: new Date('2026-11-20T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '10:45',
    status: 'scheduled',
    notes: 'Please cut short',
  };

  describe('POST /api/v1/appointments — Rule R2', () => {
    it('R2: allows booking a valid appointment within operating hours with assigned staff', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockStaffProfile1);

      jest.spyOn(Appointment, 'create').mockResolvedValue({
        _id: appointmentId,
        customerId,
        staffId: staffUserId1,
        serviceId,
        businessId,
        date: new Date(futureDate),
        startTime: '10:00',
        endTime: '10:45', // 10:00 + 45 min
        status: 'scheduled',
      });

      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointmentDoc),
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
          notes: 'Please cut short',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startTime).toBe('10:00');
      expect(res.body.data.endTime).toBe('10:45');
    });

    it('R2: auto-assigns least-loaded staff member when staffId is "any"', async () => {
      const futureDate = getFutureDateString(10);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      jest.spyOn(StaffProfile, 'find').mockResolvedValue([mockStaffProfile1, mockStaffProfile2]);

      // Staff 1 has 2 bookings, Staff 2 has 0 bookings
      jest.spyOn(Appointment, 'aggregate').mockResolvedValue([
        { _id: staffUserId1, count: 2 },
      ]);

      const createSpy = jest.spyOn(Appointment, 'create').mockResolvedValue({
        _id: appointmentId,
        customerId,
        staffId: staffUserId2, // Should pick staff 2!
        serviceId,
        businessId,
        date: new Date(futureDate),
        startTime: '11:00',
        endTime: '11:45',
        status: 'scheduled',
      });

      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockAppointmentDoc,
          staffId: { _id: staffUserId2, name: 'Priya' },
        }),
      });

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: 'any',
          date: futureDate,
          startTime: '11:00',
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ staffId: staffUserId2 })
      );
    });

    it('R2: rejects booking when appointment is in the past (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: '2020-01-01',
          startTime: '10:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/past/i);
    });

    it('R2: rejects booking when business is closed on that day (400)', async () => {
      const sundayDate = getNextSundayString();

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: sundayDate,
          startTime: '11:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/closed/i);
    });

    it('R2: rejects booking when start time is before business open hours (400)', async () => {
      const futureDate = getFutureDateString(7);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '07:30', // Business opens at 09:00
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/operating hours/i);
    });

    it('R2: rejects booking when end time exceeds business close hours (400)', async () => {
      const futureDate = getFutureDateString(7);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService); // duration is 45 min

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '17:30', // Closes at 18:00, 17:30 + 45m = 18:15 (exceeds close)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/operating hours/i);
    });

    it('R2: rejects booking when staff member is not assigned to the selected service (400)', async () => {
      const futureDate = getFutureDateString(7);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      // Staff profile has empty serviceIds
      const unassignedStaffProfile = {
        ...mockStaffProfile1,
        serviceIds: [],
      };
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(unassignedStaffProfile);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId,
          staffId: staffUserId1,
          date: futureDate,
          startTime: '11:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not assigned to this service/i);
    });

    it('rejects booking when required fields are missing (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects booking when service does not exist (404)', async () => {
      const futureDate = getFutureDateString(7);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessId,
          serviceId: '60d0fe4f5311236168a10999',
          date: futureDate,
          startTime: '10:00',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/appointments', () => {
    it('lists appointments scoped to the customer (Rule R6: 200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const findSpy = jest.spyOn(Appointment, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockAppointmentDoc]),
        }),
      });

      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ customerId })
      );
    });
  });

  describe('GET /api/v1/appointments/:id', () => {
    it('returns appointment details when authorized (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointmentDoc),
      });

      const res = await request(app)
        .get(`/api/v1/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(appointmentId);
    });

    it('rejects customer viewing another customer appointment (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockOtherCustomerUser);
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointmentDoc),
      });

      const res = await request(app)
        .get(`/api/v1/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
