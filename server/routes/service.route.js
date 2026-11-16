const express = require('express');
const router = express.Router();
const {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
} = require('../controllers/service.controller');
const authenticate = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Public listing (optional auth to support includeInactive for admin)
router.get('/', optionalAuth, getServices);
router.get('/:id', getServiceById);

// Admin-only management routes
router.post('/', authenticate, authorize('admin'), createService);
router.put('/:id', authenticate, authorize('admin'), updateService);
router.delete('/:id', authenticate, authorize('admin'), deleteService);

module.exports = router;
