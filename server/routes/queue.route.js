const express = require('express');
const router = express.Router();
const {
  generateToken,
  getTokenById,
  getTodayQueue,
} = require('../controllers/queue.controller');
const { optionalAuth } = require('../middleware/auth');

// M8: Walk-in token generation & retrieval
router.post('/tokens', optionalAuth, generateToken);
router.get('/tokens/:id', getTokenById);
router.get('/today', getTodayQueue);

module.exports = router;
