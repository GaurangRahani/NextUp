const express = require('express');
const router = express.Router();
const sendResponse = require('../utils/sendResponse');

// GET /api/v1/health
router.get('/', (req, res) => {
  sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() }, 'Server is running');
});

module.exports = router;
