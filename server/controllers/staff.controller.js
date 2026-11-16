const StaffProfile = require('../models/StaffProfile');
const User = require('../models/User');
const Service = require('../models/Service');
const Business = require('../models/Business');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { assertOwnership } = require('../middleware/ownership');

/**
 * Helper: Resolve target businessId for admin user
 */
const resolveBusinessId = async (req, providedId) => {
  if (providedId) return providedId;
  if (req.user?.businessId) return req.user.businessId;

  // Search if user owns any business
  const biz = await Business.findOne({ ownerId: req.user._id });
  if (biz) {
    if (!req.user.businessId) {
      await User.findByIdAndUpdate(req.user._id, { businessId: biz._id });
      req.user.businessId = biz._id;
    }
    return biz._id;
  }

  return null;
};

/**
 * Helper: Validate that all assigned services belong to the same business (No cross-business assignment)
 */
const validateServicesBelongToBusiness = async (serviceIds, businessId) => {
  if (!serviceIds || serviceIds.length === 0) return;

  const services = await Service.find({ _id: { $in: serviceIds } });

  if (services.length !== serviceIds.length) {
    throw new ApiError(400, 'One or more specified services do not exist');
  }

  const foreignService = services.find(
    (s) => s.businessId.toString() !== businessId.toString()
  );

  if (foreignService) {
    throw new ApiError(
      400,
      `Cannot assign service '${foreignService.name}' from a different business`
    );
  }
};

/**
 * Create a new staff member (Admin only)
 * POST /api/v1/staff
 */
const createStaff = async (req, res) => {
  const { name, email, password, userId, serviceIds = [], businessId } = req.body;

  const targetBusinessId = await resolveBusinessId(req, businessId);
  if (!targetBusinessId) {
    throw new ApiError(
      400,
      'Business ID is required. Please set up your business profile first.'
    );
  }

  assertOwnership(req, { businessId: targetBusinessId });

  // Validate service assignments belong to this business
  if (serviceIds.length > 0) {
    await validateServicesBelongToBusiness(serviceIds, targetBusinessId);
  }

  let staffUserId = userId;

  if (!staffUserId) {
    // Create a new staff user account
    if (!name || !name.trim()) {
      throw new ApiError(400, 'Please provide staff member name');
    }
    if (!email || !email.trim()) {
      throw new ApiError(400, 'Please provide staff member email');
    }
    if (!password || password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ApiError(409, 'User already exists with this email');
    }

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'staff',
      businessId: targetBusinessId,
    });
    staffUserId = newUser._id;
  } else {
    // Check existing user
    const existingUser = await User.findById(staffUserId);
    if (!existingUser) {
      throw new ApiError(404, 'User not found');
    }

    // Check if staff profile already exists
    const existingProfile = await StaffProfile.findOne({ userId: staffUserId });
    if (existingProfile) {
      throw new ApiError(409, 'Staff profile already exists for this user');
    }

    // Ensure user has staff role and businessId set
    if (existingUser.role !== 'staff' || !existingUser.businessId) {
      await User.findByIdAndUpdate(staffUserId, {
        role: 'staff',
        businessId: targetBusinessId,
      });
    }
  }

  const staffProfile = await StaffProfile.create({
    userId: staffUserId,
    businessId: targetBusinessId,
    serviceIds,
    isActive: true,
  });

  const populated = await StaffProfile.findById(staffProfile._id)
    .populate('userId', 'name email role')
    .populate('serviceIds', 'name duration price isActive');

  sendResponse(res, 201, populated, 'Staff member created successfully');
};

/**
 * List staff members for a business
 * GET /api/v1/staff
 */
const getStaffList = async (req, res) => {
  const { businessId, serviceId, includeInactive } = req.query;

  let targetBusinessId = businessId;
  if (!targetBusinessId && req.user) {
    targetBusinessId = await resolveBusinessId(req);
  }

  if (!targetBusinessId) {
    throw new ApiError(400, 'businessId query parameter is required');
  }

  const filter = { businessId: targetBusinessId };

  // Only admin can see inactive staff when requested
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin || includeInactive !== 'true') {
    filter.isActive = true;
  }

  // Filter staff offering a particular service
  if (serviceId) {
    filter.serviceIds = serviceId;
  }

  const staffList = await StaffProfile.find(filter)
    .populate('userId', 'name email role')
    .populate('serviceIds', 'name duration price isActive')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, staffList, 'Staff members fetched successfully');
};

/**
 * Get single staff member by ID
 * GET /api/v1/staff/:id
 */
const getStaffById = async (req, res) => {
  const staff = await StaffProfile.findById(req.params.id)
    .populate('userId', 'name email role')
    .populate('serviceIds', 'name duration price isActive');

  if (!staff) {
    throw new ApiError(404, 'Staff profile not found');
  }

  sendResponse(res, 200, staff, 'Staff profile fetched successfully');
};

/**
 * Update staff profile
 * PUT /api/v1/staff/:id
 */
const updateStaff = async (req, res) => {
  const staff = await StaffProfile.findById(req.params.id);
  if (!staff) {
    throw new ApiError(404, 'Staff profile not found');
  }

  // Authorize: Admin of the business or the staff user themselves
  const isAdmin = req.user.role === 'admin';
  const isSelf = staff.userId.toString() === req.user._id.toString();

  if (!isAdmin && !isSelf) {
    throw new ApiError(403, 'Access denied: not authorized to update this staff profile');
  }

  if (isAdmin) {
    assertOwnership(req, { businessId: staff.businessId });
  }

  const { name, serviceIds, isActive } = req.body;

  // Validate cross-business service assignment if services are updated
  if (serviceIds !== undefined) {
    if (!isAdmin) {
      throw new ApiError(403, 'Only admins can modify service assignments');
    }
    await validateServicesBelongToBusiness(serviceIds, staff.businessId);
    staff.serviceIds = serviceIds;
  }

  if (typeof isActive === 'boolean') {
    if (!isAdmin) {
      throw new ApiError(403, 'Only admins can change staff active status');
    }
    staff.isActive = isActive;
  }

  if (name && name.trim()) {
    await User.findByIdAndUpdate(staff.userId, { name: name.trim() });
  }

  await staff.save();

  const updated = await StaffProfile.findById(staff._id)
    .populate('userId', 'name email role')
    .populate('serviceIds', 'name duration price isActive');

  sendResponse(res, 200, updated, 'Staff profile updated successfully');
};

/**
 * Assign services to staff member (Admin only)
 * PUT /api/v1/staff/:id/services
 */
const assignServices = async (req, res) => {
  const { serviceIds } = req.body;

  if (!Array.isArray(serviceIds)) {
    throw new ApiError(400, 'serviceIds must be an array of service IDs');
  }

  const staff = await StaffProfile.findById(req.params.id);
  if (!staff) {
    throw new ApiError(404, 'Staff profile not found');
  }

  assertOwnership(req, { businessId: staff.businessId });

  // Validate no cross-business service assignment
  await validateServicesBelongToBusiness(serviceIds, staff.businessId);

  staff.serviceIds = serviceIds;
  await staff.save();

  const updated = await StaffProfile.findById(staff._id)
    .populate('userId', 'name email role')
    .populate('serviceIds', 'name duration price isActive');

  sendResponse(res, 200, updated, 'Services assigned to staff successfully');
};

/**
 * Deactivate staff member (Admin only)
 * DELETE /api/v1/staff/:id
 */
const deactivateStaff = async (req, res) => {
  const staff = await StaffProfile.findById(req.params.id);
  if (!staff) {
    throw new ApiError(404, 'Staff profile not found');
  }

  assertOwnership(req, { businessId: staff.businessId });

  staff.isActive = false;
  await staff.save();

  sendResponse(
    res,
    200,
    { _id: staff._id, isActive: false, isDeactivated: true },
    'Staff member deactivated successfully'
  );
};

module.exports = {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  assignServices,
  deactivateStaff,
};
