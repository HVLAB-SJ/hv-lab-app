/**
 * Convert SQLite datetime format to ISO 8601
 * SQLite: "2025-10-22 10:28:01"
 * ISO 8601: "2025-10-22T10:28:01.000Z"
 */
const convertSQLiteDate = (dateStr) => {
  if (!dateStr || dateStr === '' || dateStr === 'null') return null;
  try {
    // Replace space with 'T' and add timezone
    const isoDate = dateStr.replace(' ', 'T') + '.000Z';
    return new Date(isoDate).toISOString();
  } catch (e) {
    return null;
  }
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
      sanitized[field] = convertSQLiteDate(sanitized[field]);
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
