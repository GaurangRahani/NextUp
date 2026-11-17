const QueueToken = require('../models/QueueToken');
const DailyCounter = require('../models/DailyCounter');
const Business = require('../models/Business');
const Service = require('../models/Service');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { getDayOfWeek } = require('../utils/hoursValidator');

// Rule R5 — Allowed status transitions
const ALLOWED_TRANSITIONS = {
  waiting: ['called', 'cancelled'],
  called: ['in-service', 'no-show'],
  'in-service': ['completed'],
  completed: [],
  cancelled: [],
  'no-show': [],
};

/**
 * Generate walk-in token (Rule R4)
 * POST /api/v1/queue/tokens
 */
const generateToken = async (req, res, next) => {
  const { businessId, serviceId, guestName, guestPhone } = req.body;

  if (!businessId) {
    return next(new ApiError(400, 'Business ID is required'));
  }

  if (!serviceId) {
    return next(new ApiError(400, 'Service ID is required'));
  }

  // 1. Validate Business
  const business = await Business.findById(businessId);
  if (!business) {
    return next(new ApiError(404, 'Business not found'));
  }

  // Check if business is closed today
  const todayDateStr = new Date().toISOString().split('T')[0];
  const dayOfWeek = getDayOfWeek(todayDateStr, business.timezone || 'Asia/Kolkata');
  const operatingDay = (business.operatingHours || []).find((h) => h.day === dayOfWeek);
  if (operatingDay && operatingDay.isClosed) {
    return next(new ApiError(400, `Business is closed today (${dayOfWeek})`));
  }

  // 2. Validate Service
  const service = await Service.findById(serviceId);
  if (!service) {
    return next(new ApiError(404, 'Service not found'));
  }

  if (service.businessId.toString() !== businessId.toString()) {
    return next(new ApiError(400, 'Service does not belong to this business'));
  }

  if (!service.isActive) {
    return next(
      new ApiError(400, 'Service is currently deactivated and not accepting tokens')
    );
  }

  // 3. Resolve customer/guest details
  const finalGuestName = req.user ? (guestName || req.user.name) : guestName;
  if (!finalGuestName || finalGuestName.trim().length < 2) {
    return next(new ApiError(400, 'Guest or customer name is required (at least 2 characters)'));
  }

  const customerId = req.user ? req.user._id : null;
  const queueDate = new Date().toISOString().split('T')[0];

  // 4. Rule R4 & Decision D4: Atomic daily token counter increment
  const counter = await DailyCounter.findOneAndUpdate(
    { businessId, date: queueDate },
    { $inc: { count: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const tokenNumber = counter.count;

  // 5. Create Queue Token
  const token = await QueueToken.create({
    businessId,
    serviceId,
    customerId,
    guestName: finalGuestName.trim(),
    guestPhone: guestPhone ? guestPhone.trim() : '',
    tokenNumber,
    queueDate,
    status: 'waiting',
  });

  const populatedToken = await QueueToken.findById(token._id)
    .populate('serviceId', 'name duration price')
    .populate('businessId', 'name');

  return sendResponse(res, 201, populatedToken, 'Token generated successfully');
};

/**
 * Get single token by ID
 * GET /api/v1/queue/tokens/:id
 */
const getTokenById = async (req, res, next) => {
  const token = await QueueToken.findById(req.params.id)
    .populate('serviceId', 'name duration price')
    .populate('businessId', 'name');

  if (!token) {
    return next(new ApiError(404, 'Token not found'));
  }

  return sendResponse(res, 200, token, 'Token retrieved successfully');
};

/**
 * Get today's queue tokens for a business
 * GET /api/v1/queue/today?businessId=...&status=...
 */
const getTodayQueue = async (req, res, next) => {
  const { businessId, status } = req.query;

  if (!businessId) {
    return next(new ApiError(400, 'businessId query parameter is required'));
  }

  const queueDate = new Date().toISOString().split('T')[0];
  const query = { businessId, queueDate };

  if (status) {
    query.status = status;
  }

  const tokens = await QueueToken.find(query)
    .populate('serviceId', 'name duration price')
    .sort({ tokenNumber: 1 });

  return sendResponse(res, 200, tokens, "Today's queue tokens retrieved successfully");
};


/**
 * Update queue token status (Rule R5)
 * PATCH /api/v1/queue/tokens/:id/status
 */
const updateTokenStatus = async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new ApiError(400, 'New status is required'));
  }

  const validStatuses = ['waiting', 'called', 'in-service', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return next(
      new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
    );
  }

  const token = await QueueToken.findById(req.params.id);
  if (!token) {
    return next(new ApiError(404, 'Queue token not found'));
  }

  // Rule R6 — Access control
  const user = req.user;
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';
  const isCustomer = user.role === 'customer';

  // Customers can only cancel their own token (waiting → cancelled)
  if (isCustomer) {
    const isOwnToken =
      token.customerId && token.customerId.toString() === user._id.toString();
    if (!isOwnToken) {
      return next(
        new ApiError(403, 'R6: Customers can only update their own queue token')
      );
    }
    if (status !== 'cancelled') {
      return next(
        new ApiError(403, 'R6: Customers may only cancel their own token')
      );
    }
  }

  // Staff and admins must belong to the token's business
  if (isStaff || isAdmin) {
    if (
      user.businessId &&
      token.businessId.toString() !== user.businessId.toString()
    ) {
      return next(
        new ApiError(403, 'R6: Access denied — token belongs to a different business')
      );
    }
  }

  // Rule R5 — Enforce allowed transitions
  const currentStatus = token.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(status)) {
    return next(
      new ApiError(
        400,
        `R5: Invalid transition. Status '${currentStatus}' can only move to: [${allowed.join(', ') || 'none'}]`
      )
    );
  }

  // Track timestamps for lifecycle fields
  const now = new Date();
  if (status === 'called') {
    token.calledAt = now;
    if (isStaff || isAdmin) {
      token.servedBy = user._id;
    }
  }
  if (status === 'in-service') {
    token.servedAt = now;
  }
  if (status === 'completed') {
    token.completedAt = now;
  }

  token.status = status;
  await token.save();

  const populated = await QueueToken.findById(token._id)
    .populate('serviceId', 'name duration price')
    .populate('businessId', 'name')
    .populate('servedBy', 'name email');

  return sendResponse(
    res,
    200,
    populated,
    `R5: Token status updated to '${status}' successfully`
  );
};

module.exports = {
  generateToken,
  getTokenById,
  getTodayQueue,
  updateTokenStatus,
};
