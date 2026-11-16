const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  assignServices,
  deactivateStaff,
} = require('../controllers/staff.controller');

router
  .route('/')
  .post(authenticate, authorize('admin'), createStaff)
  .get(optionalAuth, getStaffList);

router
  .route('/:id')
  .get(optionalAuth, getStaffById)
  .put(authenticate, authorize('admin', 'staff'), updateStaff)
  .delete(authenticate, authorize('admin'), deactivateStaff);

router
  .route('/:id/services')
  .put(authenticate, authorize('admin'), assignServices);

module.exports = router;
