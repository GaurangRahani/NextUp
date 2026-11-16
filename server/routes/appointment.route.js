const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  bookAppointment,
  getAppointments,
  getAppointmentById,
} = require('../controllers/appointment.controller');

router
  .route('/')
  .post(authenticate, bookAppointment)
  .get(authenticate, getAppointments);

router
  .route('/:id')
  .get(authenticate, getAppointmentById);

module.exports = router;
