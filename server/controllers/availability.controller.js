const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Business = require('../models/Business');
const StaffProfile = require('../models/StaffProfile');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
} = require('../utils/hoursValidator');
const { hasOverlap } = require('../utils/conflictChecker');

/**
 * Get real-time slot availability (Rule R1)
 * GET /api/v1/availability
 */
const getAvailability = async (req, res) => {
  const { businessId, serviceId, date, staffId, stepMinutes } = req.query;

  if (!businessId || !serviceId || !date) {
    throw new ApiError(
      400,
      'businessId, serviceId, and date query parameters are required'
    );
  }

  // 1. Fetch Business & Service
  const business = await Business.findById(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  if (!service.isActive) {
    throw new ApiError(400, 'Selected service is currently inactive');
  }

  // 2. Check Operating Hours for Date
  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const dayOfWeek = getDayOfWeek(targetDate, business.timezone || 'Asia/Kolkata');
  const operatingHours = (business.operatingHours || []).find((h) => h.day === dayOfWeek);

  if (!operatingHours || operatingHours.isClosed) {
    return sendResponse(
      res,
      200,
      {
        date,
        dayOfWeek,
        operatingHours: operatingHours || { isClosed: true },
        service: { _id: service._id, name: service.name, duration: service.duration },
        staffId: staffId || 'any',
        slots: [],
      },
      `Business is closed on ${dayOfWeek}`
    );
  }

  // 3. Determine Staff Pool
  let staffPool = [];

  if (staffId && staffId !== 'any') {
    const profile = await StaffProfile.findOne({
      $or: [{ userId: staffId }, { _id: staffId }],
      businessId: business._id,
      serviceIds: service._id,
      isActive: true,
    });

    if (!profile) {
      return sendResponse(
        res,
        200,
        {
          date,
          dayOfWeek,
          operatingHours,
          service: { _id: service._id, name: service.name, duration: service.duration },
          staffId,
          slots: [],
        },
        'Selected staff member is not available or not assigned to this service'
      );
    }
    staffPool = [profile.userId];
  } else {
    const profiles = await StaffProfile.find({
      businessId: business._id,
      serviceIds: service._id,
      isActive: true,
    });
    staffPool = profiles.map((p) => p.userId);
  }

  if (staffPool.length === 0) {
    return sendResponse(
      res,
      200,
      {
        date,
        dayOfWeek,
        operatingHours,
        service: { _id: service._id, name: service.name, duration: service.duration },
        staffId: staffId || 'any',
        slots: [],
      },
      'No staff members are assigned to this service'
    );
  }

  // 4. Fetch Existing Active Appointments for Staff Pool on this Date
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointments = await Appointment.find({
    staffId: { $in: staffPool },
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: 'cancelled' },
  });

  // 5. Generate Discrete Slots
  const openMin = timeToMinutes(operatingHours.open);
  const closeMin = timeToMinutes(operatingHours.close);
  const duration = service.duration;
  const step = Number(stepMinutes) || 15; // 15-min fixed step (Decision D2)

  // Current time check if date is today
  const now = new Date();
  const isToday =
    targetDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slots = [];

  for (let m = openMin; m + duration <= closeMin; m += step) {
    const slotStart = minutesToTime(m);
    const slotEnd = minutesToTime(m + duration);

    // Rule R2: Exclude past slots if today
    if (isToday && m <= currentMinutes) {
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable: false,
        reason: 'Past',
      });
      continue;
    }

    // Rule R1: Overlap check across staff pool
    const availableStaff = staffPool.filter((sUserId) => {
      const staffAppointments = existingAppointments.filter(
        (a) => a.staffId.toString() === sUserId.toString()
      );
      const conflict = staffAppointments.find((a) =>
        hasOverlap(slotStart, slotEnd, a.startTime, a.endTime)
      );
      return !conflict;
    });

    const isAvailable = availableStaff.length > 0;

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      isAvailable,
      availableStaff,
      reason: isAvailable ? null : 'Conflict',
    });
  }

  sendResponse(
    res,
    200,
    {
      date,
      dayOfWeek,
      operatingHours,
      service: { _id: service._id, name: service.name, duration: service.duration },
      staffId: staffId || 'any',
      slots,
    },
    'Availability calculated successfully'
  );
};

module.exports = {
  getAvailability,
};
