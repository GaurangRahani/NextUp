/**
 * Convert a UTC ISO string to a human-readable local string.
 * @param {string} utcString  - ISO 8601 UTC string from the API
 * @param {string} timezone   - IANA timezone e.g. 'Asia/Kolkata'
 * @param {object} options    - Intl.DateTimeFormat options
 */
export const toLocalDisplay = (utcString, timezone = 'Asia/Kolkata', options = {}) => {
  if (!utcString) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(utcString));
};

/**
 * Convert a local date + time string to a UTC ISO string for the API.
 * @param {string} localDate  - 'YYYY-MM-DD'
 * @param {string} localTime  - 'HH:MM' (24-hour)
 * @param {string} timezone   - IANA timezone
 */
export const toUTCPayload = (localDate, localTime, timezone = 'Asia/Kolkata') => {
  const localDateTimeString = `${localDate}T${localTime}:00`;
  // Create a date interpreting the string as the given timezone
  const date = new Date(
    new Date(localDateTimeString).toLocaleString('en-US', { timeZone: timezone })
  );
  return date.toISOString();
};

/**
 * Format minutes into a readable string e.g. 75 -> "1h 15m"
 */
export const formatWaitTime = (minutes) => {
  if (minutes <= 0) return 'Now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
