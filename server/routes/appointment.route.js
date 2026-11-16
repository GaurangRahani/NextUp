const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  bookAppointment,
  getAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
} = require('../controllers/appointment.controller');

router
  .route('/')
  .post(authenticate, bookAppointment)
  .get(authenticate, getAppointments);

router
  .route('/:id')
  .get(authenticate, getAppointmentById);

router
  .route('/:id/cancel')
  .patch(authenticate, cancelAppointment);

router
  .route('/:id/reschedule')
  .patch(authenticate, rescheduleAppointment);

router
  .route('/:id/status')
  .patch(authenticate, authorize('admin', 'staff'), updateAppointmentStatus);

module.exports = router;
