const ApiError = require('../utils/ApiError');

/**
 * Checks if the requesting user satisfies ownership rules (Rule R6):
 * - Customers can only access their own records
 * - Staff can only access records matching their staff ID or business
 * - Admins can only access records belonging to their business
 *
 * @param {object} req - Express request
 * @param {object} targets - { customerId, staffId, businessId }
 * @returns {boolean}
 */
const assertOwnership = (req, { customerId, staffId, businessId } = {}) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Admins are scoped to their business
  if (user.role === 'admin') {
    if (
      businessId &&
      user.businessId &&
      user.businessId.toString() !== businessId.toString()
    ) {
      throw new ApiError(
        403,
        'Access denied: cannot access records from another business'
      );
    }
    return true;
  }

  // Staff can access their own schedule/appointments or their business's general data
  if (user.role === 'staff') {
    if (staffId && user._id.toString() !== staffId.toString()) {
      throw new ApiError(
        403,
        'Access denied: staff can only access their own schedule'
      );
    }
    if (
      businessId &&
      user.businessId &&
      user.businessId.toString() !== businessId.toString()
    ) {
      throw new ApiError(
        403,
        'Access denied: cannot access records from another business'
      );
    }
    return true;
  }

  // Customers can only access their own records
  if (user.role === 'customer') {
    if (customerId && user._id.toString() !== customerId.toString()) {
      throw new ApiError(
        403,
        'Access denied: customers can only access their own data'
      );
    }
    return true;
  }

  throw new ApiError(403, 'Access denied');
};

module.exports = {
  assertOwnership,
};
