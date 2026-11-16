const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Business = require('../models/Business');
const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { assertOwnership } = require('../middleware/ownership');
const {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
} = require('../utils/hoursValidator');
const { findConflictingAppointment } = require('../utils/conflictChecker');

/**
 * Helper to resolve business ID for current request
 */
const resolveBusinessId = async (req, providedId) => {
  if (providedId) return providedId;
  if (req.user?.businessId) return req.user.businessId;

  if (req.user?.role === 'admin') {
    const biz = await Business.findOne({ ownerId: req.user._id });
    if (biz) return biz._id;
  }

  return null;
};

/**
 * Book an Appointment (Rule R2)
 * POST /api/v1/appointments
 */
const bookAppointment = async (req, res) => {
  const {
    businessId,
    serviceId,
    staffId,
    date,
    startTime,
    notes,
    customerId,
  } = req.body;

  // 1. Missing fields check
  if (!serviceId) {
    throw new ApiError(400, 'Please select a service');
  }
  if (!date) {
    throw new ApiError(400, 'Please select an appointment date');
  }
  if (!startTime) {
    throw new ApiError(400, 'Please select a start time');
  }

  // 2. Resolve Business
  const targetBusinessId = await resolveBusinessId(req, businessId);
  if (!targetBusinessId) {
    throw new ApiError(400, 'Business ID is required');
  }

  const business = await Business.findById(targetBusinessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }

  // 3. Find and validate Service
  const service = await Service.findById(serviceId);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  if (!service.isActive) {
    throw new ApiError(400, 'Selected service is currently inactive');
  }
  if (service.businessId.toString() !== business._id.toString()) {
    throw new ApiError(400, 'Service does not belong to this business');
  }

  // 4. Time calculations
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) {
    throw new ApiError(400, 'Invalid startTime format. Expected HH:mm (e.g. 10:30)');
  }

  const endMinutes = startMinutes + service.duration;
  const endTime = minutesToTime(endMinutes);

  // 5. Rule R2: Check appointment is not in the past
  const appointmentDate = new Date(date);
  if (isNaN(appointmentDate.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  // Set appointment date hours from startTime
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(startHour, startMinute, 0, 0);

  // Buffer of 1 minute to prevent edge-case race conditions on current minute
  const now = new Date();
  if (appointmentDateTime.getTime() < now.getTime() - 60000) {
    throw new ApiError(400, 'Rule R2: Appointment cannot be scheduled in the past');
  }

  // 6. Rule R2: Check operating hours for day of week
  const dayOfWeek = getDayOfWeek(appointmentDate, business.timezone || 'Asia/Kolkata');
  const operatingDay = (business.operatingHours || []).find((h) => h.day === dayOfWeek);

  if (!operatingDay || operatingDay.isClosed) {
    throw new ApiError(
      400,
      `Rule R2: Business is closed on ${dayOfWeek}`
    );
  }

  const openMinutes = timeToMinutes(operatingDay.open);
  const closeMinutes = timeToMinutes(operatingDay.close);

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new ApiError(
      400,
      `Rule R2: Appointment must fit inside business operating hours (${operatingDay.open} - ${operatingDay.close}) for ${dayOfWeek}`
    );
  }

  // 7. Staff Selection & Rule R2 Assignment Check
  let assignedStaffUserId = null;

  if (!staffId || staffId === 'any') {
    // "Any available" staff (Decision D5: least-loaded active staff member assigned to this service)
    const candidates = await StaffProfile.find({
      businessId: business._id,
      serviceIds: service._id,
      isActive: true,
    });

    if (candidates.length === 0) {
      throw new ApiError(
        400,
        'Rule R2: No active staff members are assigned to this service'
      );
    }

    // Filter out candidates with overlapping appointments (Rule R1)
    const availableCandidates = [];
    for (const c of candidates) {
      const conflict = await findConflictingAppointment({
        AppointmentModel: Appointment,
        staffId: c.userId,
        date: appointmentDate,
        startTime,
        endTime,
      });
      if (!conflict) {
        availableCandidates.push(c);
      }
    }

    if (availableCandidates.length === 0) {
      throw new ApiError(
        409,
        'Rule R1: No qualified staff members are available at this time slot'
      );
    }

    // Find least-loaded staff member among available candidates for this day (Decision D5)
    const candidateUserIds = availableCandidates.map((c) => c.userId);

    // Count existing scheduled appointments on this date
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const counts = await Appointment.aggregate([
      {
        $match: {
          staffId: { $in: candidateUserIds },
          date: { $gte: startOfDay, $lte: endOfDay },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$staffId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map();
    counts.forEach((item) => countMap.set(item._id.toString(), item.count));

    // Sort available candidates by lowest booking count
    availableCandidates.sort((a, b) => {
      const countA = countMap.get(a.userId.toString()) || 0;
      const countB = countMap.get(b.userId.toString()) || 0;
      return countA - countB;
    });

    assignedStaffUserId = availableCandidates[0].userId;
  } else {
    // Specific staff member chosen: verify staff profile & Rule R2 assignment check
    const staffProfile = await StaffProfile.findOne({
      $or: [{ userId: staffId }, { _id: staffId }],
      businessId: business._id,
      isActive: true,
    });

    if (!staffProfile) {
      throw new ApiError(
        400,
        'Selected staff member is not active or does not belong to this business'
      );
    }

    const isAssigned = staffProfile.serviceIds.some(
      (sId) => sId.toString() === service._id.toString()
    );

    if (!isAssigned) {
      throw new ApiError(
        400,
        'Rule R2: Staff member is not assigned to this service'
      );
    }

    // Rule R1: Check for overlapping appointments for this staff member
    const conflict = await findConflictingAppointment({
      AppointmentModel: Appointment,
      staffId: staffProfile.userId,
      date: appointmentDate,
      startTime,
      endTime,
    });

    if (conflict) {
      throw new ApiError(
        409,
        'Rule R1: An overlapping appointment already exists for this staff member'
      );
    }

    assignedStaffUserId = staffProfile.userId;
  }

  // 8. Determine Customer
  let targetCustomerId = req.user._id;
  if (customerId && (req.user.role === 'admin' || req.user.role === 'staff')) {
    targetCustomerId = customerId;
  }

  // 9. Create Appointment with DB safeguard for concurrency (Decision D3)
  let appointment;
  try {
    appointment = await Appointment.create({
      customerId: targetCustomerId,
      staffId: assignedStaffUserId,
      serviceId: service._id,
      businessId: business._id,
      date: appointmentDate,
      startTime,
      endTime,
      status: 'scheduled',
      notes: notes || '',
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(
        409,
        'Rule R1: An overlapping appointment already exists for this staff member'
      );
    }
    throw err;
  }

  const populated = await Appointment.findById(appointment._id).populate([
    { path: 'customerId', select: 'name email phone' },
    { path: 'staffId', select: 'name email' },
    { path: 'serviceId', select: 'name duration price' },
    { path: 'businessId', select: 'name timezone address' },
  ]);

  sendResponse(res, 201, populated, 'Appointment booked successfully');
};

/**
 * List Appointments with Role-based access control (Rule R6)
 * GET /api/v1/appointments
 */
const getAppointments = async (req, res) => {
  const { date, status, staffId, customerId, businessId, timeframe } = req.query;

  const filter = {};

  // Rule R6: Scoped by role
  if (req.user.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.user.role === 'staff') {
    filter.staffId = req.user._id;
  } else if (req.user.role === 'admin') {
    const targetBusinessId = await resolveBusinessId(req, businessId);
    if (targetBusinessId) {
      filter.businessId = targetBusinessId;
    }
  }

  // Timeframe filter: upcoming vs past
  if (timeframe === 'upcoming') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filter.date = { $gte: today };
    if (!status) {
      filter.status = 'scheduled';
    }
  } else if (timeframe === 'past') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!status) {
      filter.$or = [
        { date: { $lt: today } },
        { status: { $in: ['completed', 'cancelled', 'no-show'] } },
      ];
    }
  }

  // Additional query filters
  if (status) {
    filter.status = status;
  }

  if (staffId && req.user.role !== 'customer') {
    filter.staffId = staffId;
  }

  if (customerId && req.user.role !== 'customer') {
    filter.customerId = customerId;
  }

  if (date) {
    const targetDate = new Date(date);
    if (!isNaN(targetDate.getTime())) {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }
  }

  const appointments = await Appointment.find(filter)
    .populate([
      { path: 'customerId', select: 'name email' },
      { path: 'staffId', select: 'name email' },
      { path: 'serviceId', select: 'name duration price' },
      { path: 'businessId', select: 'name timezone' },
    ])
    .sort({ date: timeframe === 'past' ? -1 : 1, startTime: 1 });

  sendResponse(res, 200, appointments, 'Appointments fetched successfully');
};

/**
 * Get Appointment by ID (Rule R6)
 * GET /api/v1/appointments/:id
 */
const getAppointmentById = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate([
    { path: 'customerId', select: 'name email phone' },
    { path: 'staffId', select: 'name email' },
    { path: 'serviceId', select: 'name duration price description' },
    { path: 'businessId', select: 'name timezone address phone' },
  ]);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  // Rule R6: Ownership check
  assertOwnership(req, {
    customerId: appointment.customerId?._id || appointment.customerId,
    staffId: appointment.staffId?._id || appointment.staffId,
    businessId: appointment.businessId?._id || appointment.businessId,
  });

  sendResponse(res, 200, appointment, 'Appointment fetched successfully');
};

/**
 * Cancel an appointment (Rule R6)
 * PATCH /api/v1/appointments/:id/cancel
 */
const cancelAppointment = async (req, res) => {
  const { reason } = req.body;
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  // Rule R6 ownership check
  assertOwnership(req, {
    customerId: appointment.customerId,
    staffId: appointment.staffId,
    businessId: appointment.businessId,
  });

  if (appointment.status === 'cancelled') {
    throw new ApiError(400, 'Appointment is already cancelled');
  }

  if (appointment.status === 'completed') {
    throw new ApiError(400, 'Cannot cancel an appointment that has already been completed');
  }

  appointment.status = 'cancelled';
  if (reason && reason.trim()) {
    appointment.cancellationReason = reason.trim();
  }

  await appointment.save();

  const populated = await Appointment.findById(appointment._id).populate([
    { path: 'customerId', select: 'name email phone' },
    { path: 'staffId', select: 'name email' },
    { path: 'serviceId', select: 'name duration price' },
    { path: 'businessId', select: 'name timezone address' },
  ]);

  sendResponse(res, 200, populated, 'Appointment cancelled successfully');
};

/**
 * Reschedule an appointment (Re-running Rule R1 and Rule R2)
 * PATCH /api/v1/appointments/:id/reschedule
 */
const rescheduleAppointment = async (req, res) => {
  const { date, startTime } = req.body;

  if (!date || !startTime) {
    throw new ApiError(400, 'Please provide new date and startTime');
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  // Rule R6 ownership check
  assertOwnership(req, {
    customerId: appointment.customerId,
    staffId: appointment.staffId,
    businessId: appointment.businessId,
  });

  if (appointment.status === 'cancelled') {
    throw new ApiError(
      400,
      'Cannot reschedule a cancelled appointment. Please book a new appointment.'
    );
  }

  if (appointment.status === 'completed') {
    throw new ApiError(
      400,
      'Cannot reschedule an appointment that has already been completed'
    );
  }

  // Fetch business and service to validate operating hours and duration
  const business = await Business.findById(appointment.businessId);
  const service = await Service.findById(appointment.serviceId);

  if (!business || !service) {
    throw new ApiError(404, 'Associated business or service not found');
  }

  // Rule R2: Check new date is not in the past
  const newDate = new Date(date);
  if (isNaN(newDate.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const newDateTime = new Date(newDate);
  newDateTime.setHours(startHour, startMinute, 0, 0);

  const now = new Date();
  if (newDateTime.getTime() < now.getTime() - 60000) {
    throw new ApiError(400, 'Rule R2: Rescheduled date and time cannot be in the past');
  }

  // Rule R2: Check operating hours for day of week
  const dayOfWeek = getDayOfWeek(newDate, business.timezone || 'Asia/Kolkata');
  const operatingDay = (business.operatingHours || []).find((h) => h.day === dayOfWeek);

  if (!operatingDay || operatingDay.isClosed) {
    throw new ApiError(400, `Rule R2: Business is closed on ${dayOfWeek}`);
  }

  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) {
    throw new ApiError(400, 'Invalid startTime format');
  }

  const endMinutes = startMinutes + service.duration;
  const openMinutes = timeToMinutes(operatingDay.open);
  const closeMinutes = timeToMinutes(operatingDay.close);

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new ApiError(
      400,
      `Rule R2: Rescheduled appointment must fit inside operating hours (${operatingDay.open} - ${operatingDay.close}) for ${dayOfWeek}`
    );
  }

  const endTime = minutesToTime(endMinutes);

  // Rule R1: Check conflict for staff member (excluding this appointment's own id!)
  const conflict = await findConflictingAppointment({
    AppointmentModel: Appointment,
    staffId: appointment.staffId,
    date: newDate,
    startTime,
    endTime,
    excludeAppointmentId: appointment._id,
  });

  if (conflict) {
    throw new ApiError(
      409,
      'Rule R1: Target slot is already taken by another booking for this staff member'
    );
  }

  appointment.date = newDate;
  appointment.startTime = startTime;
  appointment.endTime = endTime;
  appointment.status = 'scheduled';
  await appointment.save();

  const populated = await Appointment.findById(appointment._id).populate([
    { path: 'customerId', select: 'name email phone' },
    { path: 'staffId', select: 'name email' },
    { path: 'serviceId', select: 'name duration price' },
    { path: 'businessId', select: 'name timezone address' },
  ]);

  sendResponse(res, 200, populated, 'Appointment rescheduled successfully');
};

/**
 * Update appointment status (Admin/Staff only)
 * PATCH /api/v1/appointments/:id/status
 */
const updateAppointmentStatus = async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['completed', 'no-show', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Allowed values: ${validStatuses.join(', ')}`
    );
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  assertOwnership(req, {
    staffId: appointment.staffId,
    businessId: appointment.businessId,
  });

  if (appointment.status === 'completed' || appointment.status === 'cancelled') {
    throw new ApiError(
      400,
      `Cannot change status of an appointment that is already ${appointment.status}`
    );
  }

  appointment.status = status;
  await appointment.save();

  const populated = await Appointment.findById(appointment._id).populate([
    { path: 'customerId', select: 'name email phone' },
    { path: 'staffId', select: 'name email' },
    { path: 'serviceId', select: 'name duration price' },
    { path: 'businessId', select: 'name timezone address' },
  ]);

  sendResponse(
    res,
    200,
    populated,
    `Appointment status updated to ${status}`
  );
};

module.exports = {
  bookAppointment,
  getAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
};
