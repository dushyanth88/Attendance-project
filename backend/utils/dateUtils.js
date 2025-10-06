/**
 * Utility functions for consistent date handling across the application
 */

/**
 * Converts a date input to YYYY-MM-DD format string
 * @param {string|Date} dateInput - Date input (string or Date object)
 * @returns {string} Date in YYYY-MM-DD format
 */
export const normalizeDateToString = (dateInput) => {
  if (!dateInput) {
    throw new Error('Date input is required');
  }

  let date;
  
  if (typeof dateInput === 'string') {
    // If it's already a string, validate it's in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    // Otherwise, try to parse it as a date
    date = new Date(dateInput);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    throw new Error('Invalid date input type');
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  // Convert to YYYY-MM-DD format using UTC to avoid timezone issues
  return date.toISOString().split('T')[0];
};

/**
 * Validates if a date string is in YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid format
 */
export const isValidDateString = (dateString) => {
  if (typeof dateString !== 'string') {
    return false;
  }
  
  // Check format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString;
};

/**
 * Gets the current date in YYYY-MM-DD format
 * @returns {string} Current date in YYYY-MM-DD format
 */
export const getCurrentDateString = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Formats a date for display (e.g., "October 5, 2025")
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (dateString) => {
  if (!isValidDateString(dateString)) {
    return 'Invalid Date';
  }
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};
