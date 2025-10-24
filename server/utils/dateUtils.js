/**
 * Convert SQLite datetime format to ISO 8601
 * SQLite datetime: "2025-10-22 10:28:01" -> "2025-10-22T10:28:01.000Z"
 * SQLite date: "2025-10-22" -> "2025-10-22T00:00:00.000Z"
 */
const convertSQLiteDate = (dateStr) => {
  if (!dateStr || dateStr === '' || dateStr === 'null') return null;
  try {
    // Handle both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DD HH:mm:ss) formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Date-only format: YYYY-MM-DD
      return new Date(dateStr + 'T00:00:00.000Z').toISOString();
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      // DateTime format: YYYY-MM-DD HH:mm:ss
      const isoDate = dateStr.replace(' ', 'T') + '.000Z';
      return new Date(isoDate).toISOString();
    }
    // Fallback: try to parse as-is
    return new Date(dateStr).toISOString();
  } catch (e) {
    console.error('Error converting date:', dateStr, e);
    return null;
  }
};

/**
 * Convert snake_case to camelCase
 */
const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * Sanitize an object's date fields
 * @param {Object} obj - Object with potential date fields
 * @param {Array<string>} dateFields - Array of field names to convert
 * @returns {Object} - Object with converted dates
 */
const sanitizeDates = (obj, dateFields = ['created_at', 'updated_at', 'start_date', 'end_date']) => {
  const sanitized = { ...obj };
  dateFields.forEach(field => {
    if (sanitized[field] !== undefined) {
      const converted = convertSQLiteDate(sanitized[field]);
      const camelField = toCamelCase(field);

      // Remove null date fields from response to prevent frontend parsing errors
      if (converted === null) {
        delete sanitized[field];
        delete sanitized[camelField];
      } else {
        // Add camelCase version for frontend
        sanitized[camelField] = converted;
        // Keep snake_case for backward compatibility
        sanitized[field] = converted;
      }
    }
  });
  return sanitized;
};

/**
 * Sanitize an array of objects' date fields
 */
const sanitizeDatesArray = (array, dateFields) => {
  return array.map(item => sanitizeDates(item, dateFields));
};

module.exports = {
  convertSQLiteDate,
  sanitizeDates,
  sanitizeDatesArray
};
