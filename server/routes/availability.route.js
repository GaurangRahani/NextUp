const express = require('express');
const router = express.Router();
const { getAvailability } = require('../controllers/availability.controller');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, getAvailability);

module.exports = router;
