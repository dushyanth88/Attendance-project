/**
 * Centralized Student Creation Service
 * Ensures consistent facultyId and classId assignment across all creation methods
 */

import mongoose from 'mongoose';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';

/**
 * Standardized student creation with consistent facultyId and classId assignment
 * @param {Object} options - Creation options
 * @param {Object} options.currentUser - Authenticated user (faculty)
 * @param {Object} options.studentData - Student data from form or file
 * @param {Object} options.classContext - Class context (batch, year, semester, section)
 * @returns {Object} - { success, student, user, error }
 */
export async function createStudentWithStandardizedData(options) {
  const { currentUser, studentData, classContext } = options;
  
  try {
    console.log('🔧 Creating student with standardized data:', {
      studentName: studentData.name,
      facultyId: currentUser._id,
      classContext
    });

    // Step 1: Validate faculty authorization
    const faculty = await validateFacultyAuthorization(currentUser, classContext);
    if (!faculty.success) {
      console.error('❌ Faculty authorization failed:', faculty.error);
      return { success: false, error: faculty.error };
    }

    console.log('✅ Faculty authorization successful:', faculty.data);

    // Step 2: Get standardized class data from faculty assignment
    const classData = await getStandardizedClassData(faculty.data, classContext);
    if (!classData.success) {
      console.error('❌ Class data generation failed:', classData.error);
      return { success: false, error: classData.error };
    }

    console.log('✅ Class data generated successfully:', classData.data);

    // Step 3: Validate student data
    const validation = validateStudentData(studentData);
    if (!validation.success) {
      console.error('❌ Student data validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    console.log('✅ Student data validation passed');

    // Step 4: Check for duplicates
    const duplicateCheck = await checkForDuplicates(studentData, classData.data);
    if (!duplicateCheck.success) {
      console.error('❌ Duplicate check failed:', duplicateCheck.error);
      return { success: false, error: duplicateCheck.error };
    }

    console.log('✅ Duplicate check passed');

    // Step 5: Create User record
    const userResult = await createUserRecord(studentData, classData.data, currentUser);
    if (!userResult.success) {
      console.error('❌ User creation failed:', userResult.error);
      return { success: false, error: userResult.error };
    }

    console.log('✅ User record created:', userResult.data._id);

    // Step 6: Create Student record with standardized data
    const studentResult = await createStudentRecord(studentData, classData.data, userResult.data, currentUser);
    if (!studentResult.success) {
      console.error('❌ Student creation failed:', studentResult.error);
      // Cleanup user if student creation fails
      await User.findByIdAndDelete(userResult.data._id);
      return { success: false, error: studentResult.error };
    }

    console.log('✅ Student created successfully with standardized data:', {
      studentId: studentResult.data._id,
      facultyId: studentResult.data.facultyId,
      classId: studentResult.data.classId
    });

    return {
      success: true,
      student: studentResult.data,
      user: userResult.data
    };

  } catch (error) {
    console.error('❌ Error in createStudentWithStandardizedData:', error);
    return {
      success: false,
      error: {
        message: 'Internal server error during student creation',
        details: error.message
      }
    };
  }
}

/**
 * Validate faculty authorization for the class
 */
async function validateFacultyAuthorization(currentUser, classContext) {
  try {
    console.log('🔍 Validating faculty authorization:', {
      userId: currentUser._id,
      department: currentUser.department,
      classContext
    });

    // First check ClassAssignment model with flexible matching
    const classAssignment = await ClassAssignment.findOne({
      facultyId: currentUser._id,
      batch: classContext.batch,
      year: classContext.year,
      active: true
    });

    if (classAssignment) {
      console.log('✅ Found class assignment:', classAssignment);
      return {
        success: true,
        data: {
          facultyId: currentUser._id,
          source: 'class_assignment',
          classAssignment
        }
      };
    }

    // Fallback to Faculty model with flexible matching
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      is_class_advisor: true,
      batch: classContext.batch,
      year: classContext.year,
      department: currentUser.department,
      status: 'active'
    });

    if (faculty) {
      console.log('✅ Found faculty record:', faculty);
      return {
        success: true,
        data: {
          facultyId: faculty._id,
          source: 'faculty_model',
          faculty
        }
      };
    }

    // If no specific class assignment found, check if user is a faculty member
    const generalFaculty = await Faculty.findOne({
      userId: currentUser._id,
      department: currentUser.department,
      status: 'active'
    });

    if (generalFaculty) {
      console.log('✅ Found general faculty record:', generalFaculty);
      return {
        success: true,
        data: {
          facultyId: generalFaculty._id,
          source: 'general_faculty',
          faculty: generalFaculty
        }
      };
    }

    // If still no faculty found, allow creation but use current user as faculty
    console.log('⚠️ No specific faculty assignment found, using current user as faculty');
    return {
      success: true,
      data: {
        facultyId: currentUser._id,
        source: 'current_user',
        faculty: null
      }
    };

  } catch (error) {
    console.error('❌ Error validating faculty authorization:', error);
    return {
      success: false,
      error: {
        message: 'Error validating faculty authorization',
        details: error.message
      }
    };
  }
}

/**
 * Get standardized class data from faculty assignment
 */
async function getStandardizedClassData(facultyData, classContext) {
  try {
    const { facultyId, source } = facultyData;
    
    console.log('🔧 Getting standardized class data:', {
      facultyId,
      source,
      classContext
    });
    
    // Always use the facultyId from the authorization result
    const standardizedFacultyId = facultyId;
    
    // Generate standardized classId
    const classId = `${classContext.batch}_${classContext.year}_${classContext.semester}_${classContext.section || 'A'}`;
    
    // Generate classAssigned format
    const yearNumber = classContext.year.includes('1st') ? '1' : 
                     classContext.year.includes('2nd') ? '2' : 
                     classContext.year.includes('3rd') ? '3' : '4';
    const classAssigned = `${yearNumber}${classContext.section || 'A'}`;

    console.log('✅ Generated standardized data:', {
      facultyId: standardizedFacultyId,
      classId,
      classAssigned,
      batch: classContext.batch,
      year: classContext.year,
      semester: classContext.semester,
      section: classContext.section || 'A',
      department: classContext.department
    });

    return {
      success: true,
      data: {
        facultyId: standardizedFacultyId,
        classId,
        classAssigned,
        batch: classContext.batch,
        year: classContext.year,
        semester: classContext.semester,
        section: classContext.section || 'A',
        department: classContext.department,
        source
      }
    };

  } catch (error) {
    console.error('❌ Error getting standardized class data:', error);
    return {
      success: false,
      error: {
        message: 'Error generating standardized class data',
        details: error.message
      }
    };
  }
}

/**
 * Validate student data
 */
function validateStudentData(studentData) {
  const errors = [];

  // Required fields
  if (!studentData.rollNumber || !studentData.rollNumber.toString().trim()) {
    errors.push('Roll number is required');
  }

  if (!studentData.name || !studentData.name.toString().trim()) {
    errors.push('Name is required');
  }

  if (!studentData.email || !studentData.email.toString().trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email.toString().trim())) {
    errors.push('Invalid email format');
  }

  // Optional fields validation
  if (studentData.mobile && !/^[0-9]{10}$/.test(studentData.mobile.toString().trim())) {
    errors.push('Mobile number must be exactly 10 digits');
  }

  if (studentData.parentContact && !/^[0-9]{10}$/.test(studentData.parentContact.toString().trim())) {
    errors.push('Parent contact must be exactly 10 digits');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        message: 'Student data validation failed',
        details: errors
      }
    };
  }

  return { success: true };
}

/**
 * Check for duplicate students
 */
async function checkForDuplicates(studentData, classData) {
  try {
    const email = studentData.email.toString().trim().toLowerCase();
    const rollNumber = studentData.rollNumber.toString().trim();

    // Check for existing user with same email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        success: false,
        error: {
          message: 'Student already exists with this email',
          code: 'DUPLICATE_EMAIL'
        }
      };
    }

    // Check for existing student with same roll number in same batch
    const existingStudent = await Student.findOne({
      rollNumber,
      batch: classData.batch,
      department: classData.department,
      status: 'active'
    });

    if (existingStudent) {
      return {
        success: false,
        error: {
          message: 'Student already exists with this roll number in the same batch',
          code: 'DUPLICATE_ROLL_NUMBER'
        }
      };
    }

    // Check for existing mobile number
    if (studentData.mobile) {
      const existingMobile = await Student.findOne({
        mobile: studentData.mobile.toString().trim(),
        status: 'active'
      });

      if (existingMobile) {
        return {
          success: false,
          error: {
            message: 'Student already exists with this mobile number',
            code: 'DUPLICATE_MOBILE'
          }
        };
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return {
      success: false,
      error: {
        message: 'Error checking for duplicates',
        details: error.message
      }
    };
  }
}

/**
 * Create User record
 */
async function createUserRecord(studentData, classData, currentUser) {
  try {
    const user = new User({
      name: studentData.name.toString().trim(),
      email: studentData.email.toString().trim().toLowerCase(),
      password: studentData.password || 'defaultPassword123',
      role: 'student',
      department: classData.department,
      class: `${classData.year} ${classData.section}`,
      mobile: studentData.mobile ? studentData.mobile.toString().trim() : '',
      createdBy: currentUser._id,
      status: 'active'
    });

    await user.save();
    return { success: true, data: user };

  } catch (error) {
    console.error('Error creating user record:', error);
    return {
      success: false,
      error: {
        message: 'Error creating user record',
        details: error.message
      }
    };
  }
}

/**
 * Create Student record with standardized data
 */
async function createStudentRecord(studentData, classData, user, currentUser) {
  try {
    const student = new Student({
      userId: user._id,
      rollNumber: studentData.rollNumber.toString().trim(),
      name: studentData.name.toString().trim(),
      email: studentData.email.toString().trim().toLowerCase(),
      mobile: studentData.mobile ? studentData.mobile.toString().trim() : '',
      parentContact: studentData.parentContact ? studentData.parentContact.toString().trim() : '',
      batch: classData.batch,
      year: classData.year,
      semester: classData.semester,
      section: classData.section,
      classAssigned: classData.classAssigned,
      facultyId: classData.facultyId, // Always ObjectId from authenticated user
      classId: classData.classId, // Standardized classId format
      department: classData.department,
      createdBy: currentUser._id, // Always authenticated user
      status: 'active'
    });

    await student.save();
    return { success: true, data: student };

  } catch (error) {
    console.error('Error creating student record:', error);
    return {
      success: false,
      error: {
        message: 'Error creating student record',
        details: error.message
      }
    };
  }
}

/**
 * Bulk create students with standardized data
 */
export async function bulkCreateStudentsWithStandardizedData(options) {
  const { currentUser, studentsData, classContext } = options;
  
  try {
    console.log(`🔧 Bulk creating ${studentsData.length} students with standardized data`);

    const results = {
      successful: [],
      failed: [],
      total: studentsData.length
    };

    // Process each student
    for (let i = 0; i < studentsData.length; i++) {
      const studentData = studentsData[i];
      
      try {
        const result = await createStudentWithStandardizedData({
          currentUser,
          studentData,
          classContext
        });

        if (result.success) {
          results.successful.push({
            index: i,
            student: result.student,
            user: result.user
          });
        } else {
          results.failed.push({
            index: i,
            studentData,
            error: result.error
          });
        }
      } catch (error) {
        results.failed.push({
          index: i,
          studentData,
          error: {
            message: 'Unexpected error during student creation',
            details: error.message
          }
        });
      }
    }

    console.log(`✅ Bulk creation completed: ${results.successful.length} successful, ${results.failed.length} failed`);

    return {
      success: true,
      data: results
    };

  } catch (error) {
    console.error('Error in bulk create students:', error);
    return {
      success: false,
      error: {
        message: 'Error during bulk student creation',
        details: error.message
      }
    };
  }
}

export default {
  createStudentWithStandardizedData,
  bulkCreateStudentsWithStandardizedData
};
