const express = require('express');
const router = express.Router();
const {
  createBusiness,
  getCurrentBusiness,
  getDefaultBusiness,
  getBusinessById,
  updateBusiness,
} = require('../controllers/business.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Public route for kiosks & customers
router.get('/default', getDefaultBusiness);
router.get('/:id', getBusinessById);

// Protected routes
router.use(authenticate);
router.get('/', getCurrentBusiness);
router.post('/', authorize('admin'), createBusiness);
router.put('/:id', authorize('admin'), updateBusiness);

module.exports = router;
