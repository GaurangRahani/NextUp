const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');
const { assertOwnership } = require('../middleware/ownership');

/**
 * Create a new service (Admin only)
 * POST /api/v1/services
 */
const createService = async (req, res) => {
  const { name, description, duration, price, businessId } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Please provide service name');
  }

  const durationNum = Number(duration);
  if (isNaN(durationNum) || durationNum <= 0) {
    throw new ApiError(400, 'Service duration must be greater than zero');
  }

  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new ApiError(400, 'Service price cannot be negative');
  }

  const targetBusinessId = businessId || req.user.businessId;
  if (!targetBusinessId) {
    throw new ApiError(
      400,
      'Business ID is required. Please create or link a business first.'
    );
  }

  assertOwnership(req, { businessId: targetBusinessId });

  const service = await Service.create({
    name: name.trim(),
    description: description || '',
    duration: durationNum,
    price: priceNum,
    businessId: targetBusinessId,
    isActive: true,
  });

  sendResponse(res, 201, service, 'Service created successfully');
};

/**
 * List services
 * GET /api/v1/services
 */
const getServices = async (req, res) => {
  const { businessId, includeInactive } = req.query;

  const targetBusinessId = businessId || req.user?.businessId;
  if (!targetBusinessId) {
    throw new ApiError(400, 'businessId query parameter is required');
  }

  const filter = { businessId: targetBusinessId };

  // Only admins can see inactive services if requested
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin || includeInactive !== 'true') {
    filter.isActive = true;
  }

  const services = await Service.find(filter).sort({ name: 1 });

  sendResponse(res, 200, services, 'Services fetched successfully');
};

/**
 * Get single service by ID
 * GET /api/v1/services/:id
 */
const getServiceById = async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  sendResponse(res, 200, service, 'Service fetched successfully');
};

/**
 * Update service (Admin only)
 * PUT /api/v1/services/:id
 */
const updateService = async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  assertOwnership(req, { businessId: service.businessId });

  const { name, description, duration, price, isActive } = req.body;

  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Service name cannot be empty');
    service.name = name.trim();
  }

  if (description !== undefined) {
    service.description = description;
  }

  if (duration !== undefined) {
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      throw new ApiError(400, 'Service duration must be greater than zero');
    }
    service.duration = durationNum;
  }

  if (price !== undefined) {
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      throw new ApiError(400, 'Service price cannot be negative');
    }
    service.price = priceNum;
  }

  if (isActive !== undefined) {
    service.isActive = Boolean(isActive);
  }

  const updated = await service.save();

  sendResponse(res, 200, updated, 'Service updated successfully');
};

/**
 * Delete or Deactivate service (Rule R3)
 * DELETE /api/v1/services/:id
 */
const deleteService = async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  assertOwnership(req, { businessId: service.businessId });

  // Rule R3: Check for upcoming scheduled appointments
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const hasFutureAppointments = await Appointment.exists({
    serviceId: service._id,
    date: { $gte: startOfToday },
    status: 'scheduled',
  });

  if (hasFutureAppointments) {
    // Soft-deactivate instead of hard deleting (Rule R3)
    service.isActive = false;
    await service.save();

    return sendResponse(
      res,
      200,
      {
        _id: service._id,
        isActive: false,
        isDeactivated: true,
      },
      'Service has upcoming appointments and was deactivated instead of deleted (Rule R3)'
    );
  }

  // If no future appointments, delete
  await Service.findByIdAndDelete(service._id);

  sendResponse(
    res,
    200,
    {
      _id: service._id,
      isDeleted: true,
    },
    'Service deleted successfully'
  );
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
};
