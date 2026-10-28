// Small helpers for checking user input before it reaches the database.

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// True if the value is a valid MongoDB id (24 hex characters)
function isValidId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

// True if the value can be read as a date (for example "2026-11-02")
function isValidDate(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  return !isNaN(new Date(value).getTime());
}

// True if the value is a 24-hour time like "09:30"
function isValidTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

// Escapes characters that mean something inside a regular expression
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Reads a whole number from user input, or returns the fallback
function toInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

// Reads a number from user input (decimals allowed), or returns the fallback
function toNumber(value, fallback) {
  const number = Number(value);
  return value !== '' && value !== undefined && Number.isFinite(number) ? number : fallback;
}

// Reads text from user input, trims it, and limits its length.
// Returns '' for anything that is not a plain string.
function text(value, maxLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// Only allows redirects to pages inside this site, such as /dashboard.
// Anything else (for example https://another-site.com) uses the fallback.
function safeRedirect(path, fallback = '/dashboard') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return fallback;
  }
  return path;
}

module.exports = {
  isValidId,
  isValidDate,
  isValidTime,
  escapeRegex,
  toInt,
  toNumber,
  text,
  safeRedirect
};
