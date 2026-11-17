const express = require('express');
const router = express.Router();
const {
  generateToken,
  getTokenById,
  getTodayQueue,
  updateTokenStatus,
  getQueueDashboard,
} = require('../controllers/queue.controller');
const authenticate = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');

// M8: Walk-in token generation & retrieval
router.post('/tokens', optionalAuth, generateToken);
router.get('/tokens/:id', getTokenById);
router.get('/today', getTodayQueue);

// M9: Queue Dashboard & Status Management (Rule R5)
router.patch('/tokens/:id/status', authenticate, updateTokenStatus);
router.get('/dashboard', authenticate, getQueueDashboard);

module.exports = router;
