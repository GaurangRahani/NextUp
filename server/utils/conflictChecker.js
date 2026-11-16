const { timeToMinutes } = require('./hoursValidator');

/**
 * Checks if two time intervals overlap (Rule R1)
 * Rule R1: Two appointments for the same staff member never overlap
 * (newStart < existingEnd AND newEnd > existingStart); back-to-back is allowed.
 *
 * @param {string} startA - "HH:mm"
 * @param {string} endA   - "HH:mm"
 * @param {string} startB - "HH:mm"
 * @param {string} endB   - "HH:mm"
 * @returns {boolean} true if overlapping, false otherwise
 */
const hasOverlap = (startA, endA, startB, endB) => {
  const startAMin = timeToMinutes(startA);
  const endAMin = timeToMinutes(endA);
  const startBMin = timeToMinutes(startB);
  const endBMin = timeToMinutes(endB);

  if (
    startAMin === null ||
    endAMin === null ||
    startBMin === null ||
    endBMin === null
  ) {
    return false;
  }

  return startAMin < endBMin && endAMin > startBMin;
};

/**
 * Finds if there is an overlapping active appointment for a given staff member and date (Rule R1)
 *
 * @param {object} params
 * @param {object} params.AppointmentModel - Mongoose Appointment model
 * @param {string|ObjectId} params.staffId - Staff User ID
 * @param {Date|string} params.date - Date of appointment
 * @param {string} params.startTime - "HH:mm"
 * @param {string} params.endTime - "HH:mm"
 * @param {string|ObjectId} [params.excludeAppointmentId] - ID to ignore (e.g. for rescheduling)
 * @returns {Promise<object|null>} The conflicting appointment document or null
 */
const findConflictingAppointment = async ({
  AppointmentModel,
  staffId,
  date,
  startTime,
  endTime,
  excludeAppointmentId = null,
}) => {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const query = {
    staffId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: 'cancelled' },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existingAppointments = await AppointmentModel.find(query);

  const conflict = existingAppointments.find((appt) =>
    hasOverlap(startTime, endTime, appt.startTime, appt.endTime)
  );

  return conflict || null;
};

module.exports = {
  hasOverlap,
  findConflictingAppointment,
};
