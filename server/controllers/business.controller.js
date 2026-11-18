const Business = require('../models/Business');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const {
  validateOperatingHours,
  DEFAULT_OPERATING_HOURS,
} = require('../utils/hoursValidator');
const { assertOwnership } = require('../middleware/ownership');

/**
 * Create a new business (Admin only)
 * POST /api/v1/business
 */
const createBusiness = async (req, res) => {
  const { name, timezone, phone, address, operatingHours } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Please provide business name');
  }

  const hoursToSet = operatingHours || DEFAULT_OPERATING_HOURS;
  validateOperatingHours(hoursToSet);

  const business = await Business.create({
    name: name.trim(),
    timezone: timezone || 'Asia/Kolkata',
    phone: phone || '',
    address: address || {},
    operatingHours: hoursToSet,
    ownerId: req.user._id,
  });

  // Link admin to their created business
  if (!req.user.businessId) {
    await User.findByIdAndUpdate(req.user._id, { businessId: business._id });
    req.user.businessId = business._id;
  }

  sendResponse(res, 201, business, 'Business profile created successfully');
};

/**
 * Get current admin's business profile
 * GET /api/v1/business
 */
const getCurrentBusiness = async (req, res) => {
  let business = null;

  if (req.user.businessId) {
    business = await Business.findById(req.user.businessId);
  }

  if (!business && req.user.role === 'admin') {
    business = await Business.findOne({ ownerId: req.user._id });
  }

  // If customer or staff has no businessId set, fallback to first available business
  if (!business && req.user.role !== 'admin') {
    business = await Business.findOne();
  }

  if (!business) {
    throw new ApiError(404, 'No business profile found');
  }

  sendResponse(res, 200, business, 'Business profile fetched successfully');
};

/**
 * Get default business profile (Public for kiosks and walk-ins)
 * GET /api/v1/business/default
 */
const getDefaultBusiness = async (req, res) => {
  const business = await Business.findOne();

  if (!business) {
    throw new ApiError(404, 'No business profile found');
  }

  sendResponse(res, 200, business, 'Business profile fetched successfully');
};

/**
 * Get business profile by ID (Public for customers)
 * GET /api/v1/business/:id
 */
const getBusinessById = async (req, res) => {
  const business = await Business.findById(req.params.id);

  if (!business) {
    throw new ApiError(404, 'Business not found');
  }

  sendResponse(res, 200, business, 'Business fetched successfully');
};

/**
 * Update business profile and operating hours (Admin only, own business)
 * PUT /api/v1/business/:id
 */
const updateBusiness = async (req, res) => {
  const { id } = req.params;

  // Enforce Rule R6 ownership
  assertOwnership(req, { businessId: id });

  const { name, timezone, phone, address, operatingHours } = req.body;

  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) {
      throw new ApiError(400, 'Business name cannot be empty');
    }
    updates.name = name.trim();
  }

  if (timezone !== undefined) updates.timezone = timezone;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;

  if (operatingHours !== undefined) {
    validateOperatingHours(operatingHours);
    updates.operatingHours = operatingHours;
  }

  const updatedBusiness = await Business.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!updatedBusiness) {
    throw new ApiError(404, 'Business not found');
  }

  sendResponse(
    res,
    200,
    updatedBusiness,
    'Business profile updated successfully'
  );
};

/**
 * Get business dashboard summary (M11)
 * GET /api/v1/business/dashboard?date=YYYY-MM-DD
 * Admin only — scoped to their own business
 */
const getBusinessDashboard = async (req, res, next) => {
  const user = req.user;

  // Must be admin and have a business
  if (!user.businessId) {
    return next(new ApiError(403, 'No business associated with your account'));
  }

  const businessId = user.businessId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return next(new ApiError(400, 'Invalid date format. Use YYYY-MM-DD'));
  }

  // Build date range for Appointment (stored as Date object at midnight UTC)
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // ── Appointment Aggregation ──────────────────────────────────────────────
  const [apptStats] = await Appointment.aggregate([
    {
      $match: {
        businessId: businessId,
        date: { $gte: dayStart, $lte: dayEnd },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        scheduled: {
          $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        noShow: {
          $sum: { $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0] },
        },
      },
    },
  ]);

  const appointments = apptStats || {
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };
  // Remove MongoDB _id from result
  delete appointments._id;

  // ── Queue / Token Aggregation ────────────────────────────────────────────
  const [queueStats] = await QueueToken.aggregate([
    {
      $match: {
        businessId: businessId,
        queueDate: date,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        waiting: {
          $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] },
        },
        called: {
          $sum: { $cond: [{ $eq: ['$status', 'called'] }, 1, 0] },
        },
        inService: {
          $sum: { $cond: [{ $eq: ['$status', 'in-service'] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        noShow: {
          $sum: { $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0] },
        },
      },
    },
  ]);

  const queue = queueStats || {
    total: 0,
    waiting: 0,
    called: 0,
    inService: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };
  delete queue._id;

  // ── Revenue Estimate (from completed appointments) ───────────────────────
  const revenueData = await Appointment.aggregate([
    {
      $match: {
        businessId: businessId,
        date: { $gte: dayStart, $lte: dayEnd },
        status: 'completed',
      },
    },
    {
      $lookup: {
        from: 'services',
        localField: 'serviceId',
        foreignField: '_id',
        as: 'service',
      },
    },
    { $unwind: { path: '$service', preserveNullAndEmpty: false } },
    {
      $group: {
        _id: null,
        estimatedRevenue: { $sum: '$service.price' },
      },
    },
  ]);

  const estimatedRevenue =
    revenueData.length > 0 ? revenueData[0].estimatedRevenue : 0;

  // ── Top Services (by appointment count today) ────────────────────────────
  const topServices = await Appointment.aggregate([
    {
      $match: {
        businessId: businessId,
        date: { $gte: dayStart, $lte: dayEnd },
      },
    },
    {
      $group: {
        _id: '$serviceId',
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'services',
        localField: '_id',
        foreignField: '_id',
        as: 'service',
      },
    },
    { $unwind: { path: '$service', preserveNullAndEmpty: false } },
    {
      $project: {
        _id: 0,
        serviceId: '$_id',
        name: '$service.name',
        count: 1,
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  // ── Totals for summary cards ─────────────────────────────────────────────
  const activeQueueCount = queue.waiting + queue.called + queue.inService;

  return sendResponse(
    res,
    200,
    {
      date,
      businessId,
      summary: {
        totalAppointments: appointments.total,
        scheduledAppointments: appointments.scheduled,
        completedAppointments: appointments.completed,
        cancelledAppointments: appointments.cancelled,
        noShowAppointments: appointments.noShow,
        totalQueueTokens: queue.total,
        activeQueueCount,
        waitingInQueue: queue.waiting,
        inServiceCount: queue.inService,
        completedQueueTokens: queue.completed,
        estimatedRevenue,
      },
      appointments,
      queue,
      topServices,
    },
    'Business dashboard data fetched successfully'
  );
};

module.exports = {
  createBusiness,
  getCurrentBusiness,
  getDefaultBusiness,
  getBusinessById,
  updateBusiness,
  getBusinessDashboard,
};
