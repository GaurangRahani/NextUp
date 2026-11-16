const express = require('express');
const router = express.Router();
const {
  createBusiness,
  getCurrentBusiness,
  getBusinessById,
  updateBusiness,
} = require('../controllers/business.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Public route for customers
router.get('/:id', getBusinessById);

// Admin-protected routes
router.use(authenticate);
router.post('/', authorize('admin'), createBusiness);
router.get('/', authorize('admin'), getCurrentBusiness);
router.put('/:id', authorize('admin'), updateBusiness);

module.exports = router;
