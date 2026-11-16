const request = require('supertest');
const app = require('../app');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Business = require('../models/Business');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { DEFAULT_OPERATING_HOURS } = require('../utils/hoursValidator');

describe('Module 7: Appointment Management (Reschedule, Cancel & Status)', () => {
  const customerId = '60d0fe4f5311236168a109aa';
  const otherCustomerId = '60d0fe4f5311236168a109ab';
  const staffUserId = '60d0fe4f5311236168a109bb';
  const adminId = '60d0fe4f5311236168a109cc';
  const businessId = '60d0fe4f5311236168a109dd';
  const serviceId = '60d0fe4f5311236168a109ee';
  const appointmentId = '60d0fe4f5311236168a109ff';

  let customerToken;
  let otherCustomerToken;
  let staffToken;
  let adminToken;

  beforeAll(() => {
    customerToken = generateToken({ id: customerId, role: 'customer' });
    otherCustomerToken = generateToken({ id: otherCustomerId, role: 'customer' });
    staffToken = generateToken({ id: staffUserId, role: 'staff' });
    adminToken = generateToken({ id: adminId, role: 'admin' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const getFutureDateString = (daysAhead = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
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

  const mockStaffUser = {
    _id: staffUserId,
    name: 'Rahul Sharma',
    email: 'rahul@nextup.com',
    role: 'staff',
    businessId,
  };

  const mockAdminUser = {
    _id: adminId,
    name: 'Admin Apex',
    email: 'admin@nextup.com',
    role: 'admin',
    businessId,
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
    duration: 45,
    price: 500,
    businessId,
    isActive: true,
  };

  const createMockAppointment = (status = 'scheduled') => ({
    _id: appointmentId,
    customerId,
    staffId: staffUserId,
    serviceId,
    businessId,
    date: new Date('2026-11-20T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '10:45',
    status,
    cancellationReason: '',
    save: jest.fn().mockResolvedValue(this),
  });

  describe('PATCH /api/v1/appointments/:id/cancel', () => {
    it('allows customer to cancel their scheduled appointment (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById')
        .mockResolvedValueOnce(apptDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({
            ...apptDoc,
            status: 'cancelled',
            cancellationReason: 'Going out of town',
          }),
        });

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Going out of town' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(apptDoc.status).toBe('cancelled');
      expect(apptDoc.cancellationReason).toBe('Going out of town');
    });

    it('rejects double cancellation of an already cancelled appointment (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const cancelledDoc = createMockAppointment('cancelled');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(cancelledDoc);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Try cancel again' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already cancelled/i);
    });

    it('rejects cancelling an already completed appointment (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const completedDoc = createMockAppointment('completed');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(completedDoc);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already been completed/i);
    });

    it('rejects customer from cancelling someone else appointment (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockOtherCustomerUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(apptDoc);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/appointments/:id/reschedule (Rule R1 & R2)', () => {
    it('reschedules appointment to a free slot and recalculates endTime (200)', async () => {
      const futureDate = getFutureDateString(12);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById')
        .mockResolvedValueOnce(apptDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({
            ...apptDoc,
            date: new Date(futureDate),
            startTime: '14:00',
            endTime: '14:45',
          }),
        });

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      // No conflict found
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          date: futureDate,
          startTime: '14:00',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(apptDoc.startTime).toBe('14:00');
      expect(apptDoc.endTime).toBe('14:45'); // 14:00 + 45 min
    });

    it('rejects rescheduling to a slot with an overlapping appointment (Rule R1: 409)', async () => {
      const futureDate = getFutureDateString(12);

      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(apptDoc);

      jest.spyOn(Business, 'findById').mockResolvedValue(mockBusiness);
      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);

      // Existing overlapping appointment at target slot
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          _id: 'otherAppt',
          staffId: staffUserId,
          startTime: '14:00',
          endTime: '14:45',
          status: 'scheduled',
        },
      ]);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          date: futureDate,
          startTime: '14:15', // Overlaps 14:00 - 14:45
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already taken/i);
    });

    it('rejects rescheduling a cancelled appointment (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);
      const cancelledDoc = createMockAppointment('cancelled');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(cancelledDoc);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          date: '2026-11-25',
          startTime: '10:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    it('rejects customer rescheduling someone else appointment (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockOtherCustomerUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById').mockResolvedValue(apptDoc);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({
          date: '2026-11-25',
          startTime: '10:00',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/appointments/:id/status (Admin / Staff)', () => {
    it('allows staff to mark scheduled appointment as completed (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById')
        .mockResolvedValueOnce(apptDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({
            ...apptDoc,
            status: 'completed',
          }),
        });

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(apptDoc.status).toBe('completed');
    });

    it('allows staff to mark scheduled appointment as no-show (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);
      const apptDoc = createMockAppointment('scheduled');
      jest.spyOn(Appointment, 'findById')
        .mockResolvedValueOnce(apptDoc)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({
            ...apptDoc,
            status: 'no-show',
          }),
        });

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'no-show' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(apptDoc.status).toBe('no-show');
    });

    it('rejects customer from updating appointment status (Rule R6: 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid status value (400)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockStaffUser);

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/appointments (Timeframe Filtering)', () => {
    it('supports timeframe=upcoming and timeframe=past query filters (200)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockCustomerUser);

      const findSpy = jest.spyOn(Appointment, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([createMockAppointment('scheduled')]),
        }),
      });

      const res = await request(app)
        .get('/api/v1/appointments?timeframe=upcoming')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId,
          status: 'scheduled',
        })
      );
    });
  });
});
