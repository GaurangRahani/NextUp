const ApiError = require('./ApiError');

const VALID_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Converts 'HH:mm' to total minutes since midnight
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || !TIME_REGEX.test(timeStr)) {
    return null;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Validates an array of operating hours
 * @param {Array} operatingHours
 * @returns {boolean} true if valid, throws ApiError otherwise
 */
const validateOperatingHours = (operatingHours) => {
  if (!Array.isArray(operatingHours)) {
    throw new ApiError(400, 'Operating hours must be an array');
  }

  const seenDays = new Set();

  for (const entry of operatingHours) {
    const { day, open, close, isClosed } = entry;

    if (!VALID_DAYS.includes(day)) {
      throw new ApiError(
        400,
        `Invalid day: '${day}'. Must be one of: ${VALID_DAYS.join(', ')}`
      );
    }

    if (seenDays.has(day)) {
      throw new ApiError(400, `Duplicate operating hours entry for day: '${day}'`);
    }
    seenDays.add(day);

    if (isClosed) {
      continue;
    }

    // If not closed, open and close are required
    if (!open || !close) {
      throw new ApiError(
        400,
        `Open and close times are required for open day '${day}'`
      );
    }

    const openMin = timeToMinutes(open);
    const closeMin = timeToMinutes(close);

    if (openMin === null) {
      throw new ApiError(
        400,
        `Invalid open time '${open}' for ${day}. Expected 24h format HH:mm (e.g. '09:00')`
      );
    }

    if (closeMin === null) {
      throw new ApiError(
        400,
        `Invalid close time '${close}' for ${day}. Expected 24h format HH:mm (e.g. '18:00')`
      );
    }

    if (openMin >= closeMin) {
      throw new ApiError(
        400,
        `Operating hours for ${day}: open time (${open}) must be before close time (${close})`
      );
    }
  }

  return true;
};

const minutesToTime = (totalMinutes) => {
  if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDayOfWeek = (dateInput, timezone = 'Asia/Kolkata') => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(d);
};

const DEFAULT_OPERATING_HOURS = [
  { day: 'Monday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Tuesday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Wednesday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Thursday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Friday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Saturday', open: '10:00', close: '17:00', isClosed: false },
  { day: 'Sunday', open: '00:00', close: '00:00', isClosed: true },
];

module.exports = {
  VALID_DAYS,
  TIME_REGEX,
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  validateOperatingHours,
  DEFAULT_OPERATING_HOURS,
};
