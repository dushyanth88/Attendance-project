/**
 * Utility functions for student data synchronization
 */

import { apiFetch } from './apiFetch';

/**
 * Refresh students list for a specific class
 * @param {Object} classInfo - Class information (batch, year, semester, section)
 * @returns {Promise<Array>} Updated students list
 */
export const refreshStudentsList = async (classInfo) => {
  try {
    const response = await apiFetch({
      url: `/api/students?batch=${encodeURIComponent(classInfo.batch)}&year=${encodeURIComponent(classInfo.year)}&semester=${encodeURIComponent(classInfo.semester)}&section=${encodeURIComponent(classInfo.section)}`,
      method: 'GET'
    });

    if (response.data.success) {
      return response.data.data.students || [];
    } else {
      console.error('Failed to refresh students list:', response.data.message);
      return [];
    }
  } catch (error) {
    console.error('Error refreshing students list:', error);
    return [];
  }
};

/**
 * Refresh students list for faculty route
 * @param {Object} classData - Class data (batch, year, semester, department)
 * @returns {Promise<Array>} Updated students list
 */
export const refreshFacultyStudentsList = async (classData) => {
  try {
    const response = await apiFetch({
      url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
      method: 'GET'
    });

    if (response.data.success) {
      return response.data.data.students || [];
    } else {
      console.error('Failed to refresh faculty students list:', response.data.message);
      return [];
    }
  } catch (error) {
    console.error('Error refreshing faculty students list:', error);
    return [];
  }
};

/**
 * Validate student data before update
 * @param {Object} studentData - Student data to validate
 * @returns {Object} Validation result
 */
export const validateStudentData = (studentData) => {
  const errors = {};

  if (studentData.name && studentData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (studentData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (studentData.mobile && !/^[0-9]{10}$/.test(studentData.mobile)) {
    errors.mobile = 'Mobile number must be exactly 10 digits';
  }

  if (studentData.parentContact && !/^[0-9]{10}$/.test(studentData.parentContact)) {
    errors.parentContact = 'Parent contact must be exactly 10 digits';
  }

  if (studentData.password && studentData.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Format student data for display
 * @param {Object} student - Raw student data
 * @returns {Object} Formatted student data
 */
export const formatStudentData = (student) => {
  return {
    id: student.id || student._id,
    _id: student._id || student.id,
    userId: student.userId,
    rollNumber: student.rollNumber || student.roll_number,
    name: student.name || student.full_name,
    email: student.email,
    mobile: student.mobile || student.mobile_number || '',
    parentContact: student.parentContact || student.parent_contact || '',
    department: student.department,
    batch: student.batch,
    year: student.year,
    semester: student.semester,
    section: student.section || 'A'
  };
};
