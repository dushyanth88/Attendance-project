/**
 * IST Timezone Utility Functions
 * Ensures all attendance operations use consistent IST timezone handling
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current IST date in YYYY-MM-DD format
 * @returns {string} - Current date in IST timezone
 */
export const getCurrentISTDate = () => {
  return dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * Get IST start of day for a given date
 * @param {string|Date} date - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} - IST start of day as UTC Date
 */
export const getISTStartOfDay = (date) => {
  const dateStr = typeof date === 'string' ? date : dayjs(date).format('YYYY-MM-DD');
  return dayjs(dateStr).tz(IST_TIMEZONE).startOf('day').toDate();
};

/**
 * Get IST end of day for a given date
 * @param {string|Date} date - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} - IST end of day as UTC Date
 */
export const getISTEndOfDay = (date) => {
  const dateStr = typeof date === 'string' ? date : dayjs(date).format('YYYY-MM-DD');
  return dayjs(dateStr).tz(IST_TIMEZONE).endOf('day').toDate();
};

/**
 * Get IST date range for a given date
 * @param {string|Date} date - Date string (YYYY-MM-DD) or Date object
 * @returns {Object} - Object with startOfDay and endOfDay
 */
export const getISTDateRange = (date) => {
  const dateStr = typeof date === 'string' ? date : dayjs(date).format('YYYY-MM-DD');
  return {
    startOfDay: getISTStartOfDay(dateStr),
    endOfDay: getISTEndOfDay(dateStr)
  };
};

/**
 * Convert any date to IST date string (YYYY-MM-DD)
 * @param {string|Date} date - Date to convert
 * @returns {string} - IST date string
 */
export const toISTDateString = (date) => {
  return dayjs(date).tz(IST_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * Check if a date is today in IST
 * @param {string|Date} date - Date to check
 * @returns {boolean} - True if date is today in IST
 */
export const isTodayInIST = (date) => {
  const today = getCurrentISTDate();
  const dateStr = toISTDateString(date);
  return today === dateStr;
};

/**
 * Get IST date string for attendance storage
 * This ensures consistent date storage regardless of server timezone
 * @param {string|Date} date - Date to normalize
 * @returns {string} - Normalized IST date string
 */
export const getAttendanceDate = (date) => {
  if (!date) {
    return getCurrentISTDate();
  }
  return toISTDateString(date);
};

/**
 * Create MongoDB date filter for IST date range
 * @param {string|Date} date - Date to create filter for
 * @returns {Object} - MongoDB date filter object
 */
export const createISTDateFilter = (date) => {
  const { startOfDay, endOfDay } = getISTDateRange(date);
  return {
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  };
};

/**
 * Create MongoDB date filter for specific IST date
 * @param {string|Date} date - Date to create filter for
 * @returns {Object} - MongoDB date filter object
 */
export const createISTExactDateFilter = (date) => {
  const dateStr = getAttendanceDate(date);
  const startOfDay = getISTStartOfDay(dateStr);
  const endOfDay = getISTEndOfDay(dateStr);
  
  return {
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  };
};

/**
 * Format date for display in IST
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatDateForIST = (date) => {
  return dayjs(date).tz(IST_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * Get current IST timestamp
 * @returns {Date} - Current IST time as UTC Date
 */
export const getCurrentISTTimestamp = () => {
  return dayjs().tz(IST_TIMEZONE).toDate();
};

export default {
  getCurrentISTDate,
  getISTStartOfDay,
  getISTEndOfDay,
  getISTDateRange,
  toISTDateString,
  isTodayInIST,
  getAttendanceDate,
  createISTDateFilter,
  createISTExactDateFilter,
  formatDateForIST,
  getCurrentISTTimestamp
};
