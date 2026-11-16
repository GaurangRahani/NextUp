const Business = require('../models/Business');
const User = require('../models/User');
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

module.exports = {
  createBusiness,
  getCurrentBusiness,
  getDefaultBusiness,
  getBusinessById,
  updateBusiness,
};
