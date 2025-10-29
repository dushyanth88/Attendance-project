/**
 * Student bulk upload routes with comprehensive validation and audit logging
 */

import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { resolveFacultyId, validateFacultyClassBinding, parseClassId, createAuditLog } from '../services/facultyResolutionService.js';
import { bulkCreateStudentsWithStandardizedData } from '../services/studentCreationService.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import UploadLog from '../models/UploadLog.js';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv' // .csv
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
    }
  }
});

/**
 * Parse Excel file content
 */
const parseExcelFile = (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      throw new Error('File must contain at least a header row and one data row');
    }
    
    const headers = jsonData[0];
    const rows = jsonData.slice(1);
    
    return rows.map((row, index) => {
      const student = {};
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined) {
          student[header.trim()] = row[colIndex];
        }
      });
      student._rowIndex = index + 2; // +2 because we skip header and arrays are 0-indexed
      return student;
    });
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
};

/**
 * Parse CSV file content
 */
const parseCSVFile = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    
    stream
      .pipe(csv())
      .on('data', (data) => {
        // Add row index for error reporting
        data._rowIndex = results.length + 2; // +2 because we skip header and arrays are 0-indexed
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(new Error(`Error parsing CSV file: ${error.message}`));
      });
  });
};

/**
 * Normalize field names to handle different cases
 */
const normalizeStudentData = (student) => {
  const normalized = {};
  
  // Map various field name variations to standard names
  const fieldMappings = {
    rollNumber: ['Roll Number', 'rollNumber', 'RollNumber', 'roll_number', 'Roll_Number', 'Roll No', 'rollNo', 'RollNo'],
    name: ['Name', 'name', 'Student Name', 'studentName', 'student_name', 'Full Name', 'fullName', 'full_name'],
    email: ['Email', 'email', 'Email Address', 'emailAddress', 'email_address', 'E-mail', 'e_mail'],
    mobile: ['Mobile', 'mobile', 'Mobile Number', 'mobileNumber', 'mobile_number', 'Phone', 'phone', 'Phone Number'],
    parentContact: ['Parent Contact', 'parentContact', 'parent_contact', 'Parent Phone', 'parentPhone', 'parent_phone'],
    password: ['Password', 'password', 'Pass', 'pass']
  };
  
  Object.keys(fieldMappings).forEach(standardField => {
    const variations = fieldMappings[standardField];
    for (const variation of variations) {
      if (student[variation] !== undefined && student[variation] !== null && student[variation] !== '') {
        normalized[standardField] = student[variation];
        break;
      }
    }
  });
  
  return normalized;
};

/**
 * Validate student data
 */
const validateStudentData = (student, rowIndex) => {
  const errors = [];
  
  // Required fields validation
  if (!student.rollNumber || !student.rollNumber.toString().trim()) {
    errors.push('Roll Number is required');
  }
  
  if (!student.name || !student.name.toString().trim()) {
    errors.push('Name is required');
  }
  
  if (!student.email || !student.email.toString().trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email.toString().trim())) {
    errors.push('Invalid email format');
  }
  
  // Optional fields with validation
  if (student.mobile && !/^[0-9]{10}$/.test(student.mobile.toString().trim())) {
    errors.push('Mobile number must be exactly 10 digits');
  }
  
  if (student.parentContact && !/^[0-9]{10}$/.test(student.parentContact.toString().trim())) {
    errors.push('Parent contact must be exactly 10 digits');
  }
  
  if (student.password && student.password.toString().trim().length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    rowIndex
  };
};

/**
 * Create upload log entry
 */
const createUploadLog = async (logData) => {
  try {
    const uploadLog = new UploadLog(logData);
    await uploadLog.save();
    return uploadLog;
  } catch (error) {
    console.error('Error creating upload log:', error);
    // Don't throw error as this is not critical for the main flow
  }
};

// @desc    Upload students in bulk
// @route   POST /api/students/bulk-upload
// @access  Faculty and above
router.post('/bulk-upload', authenticate, facultyAndAbove, upload.single('file'), [
  body('batch').notEmpty().withMessage('Batch is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('section').optional().default('A'),
  body('department').notEmpty().withMessage('Department is required')
], async (req, res) => {
  const startTime = Date.now();
  let uploadLog = null;
  
  try {
    console.log('📤 Student bulk upload request received');
    console.log('🔐 User:', req.user ? 'Authenticated' : 'Not authenticated');
    console.log('📁 File:', req.file ? 'Present' : 'Missing');
    console.log('📋 Body:', req.body);
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { batch, year, semester, section, department } = req.body;
    const currentUser = req.user;
    
    // Normalize year and semester to match the student fetch logic
    const normalizeYear = (yearInput) => {
      if (!yearInput) return undefined;
      const asString = String(yearInput).trim();
      if (/^\d+$/.test(asString)) {
        const n = parseInt(asString, 10);
        if (n === 1) return '1st Year';
        if (n === 2) return '2nd Year';
        if (n === 3) return '3rd Year';
        if (n === 4) return '4th Year';
      }
      if (/^\d(st|nd|rd|th)\s*Year$/i.test(asString)) return asString.replace(/\s+/g, ' ');
      if (['1st', '2nd', '3rd', '4th'].includes(asString)) {
        return `${asString} Year`;
      }
      return asString;
    };

    const normalizeSemester = (semInput) => {
      if (!semInput && semInput !== 0) return undefined;
      const asString = String(semInput).trim();
      if (/^\d+$/.test(asString)) {
        return `Sem ${parseInt(asString, 10)}`;
      }
      if (/^Sem\s*\d$/i.test(asString)) {
        const n = asString.match(/\d+/)?.[0];
        return `Sem ${n}`;
      }
      return asString;
    };
    
    const normalizedYear = normalizeYear(year);
    const normalizedSemester = normalizeSemester(semester);
    const classId = `${batch}_${normalizedYear}_${normalizedSemester}_${section || 'A'}`;
    
    console.log('👤 Current user:', currentUser ? currentUser.email : 'No user');
    console.log('📊 Request data:', { batch, year, semester, section, department });
    console.log('🔄 Normalized values:', { 
      originalYear: year, 
      normalizedYear, 
      originalSemester: semester, 
      normalizedSemester 
    });
    console.log('🏫 Class ID:', classId);
    console.log('🏢 Department (original):', department);
    console.log('🏢 Department (uppercase):', department.toUpperCase());
    
    // Validate classId format
    if (!classId || classId.includes('undefined') || classId.includes('null')) {
      console.error('❌ Invalid classId generated:', classId);
      console.error('❌ Input parameters:', { batch, year, semester, section, department });
      return res.status(400).json({
        success: false,
        message: 'Invalid class parameters. Please check year and semester values.',
        details: {
          batch,
          year: normalizedYear,
          semester: normalizedSemester,
          section: section || 'A',
          department: currentUser.department
        }
      });
    }
    
    // Validate that all required context parameters are present
    if (!batch || !normalizedYear || !normalizedSemester || !currentUser.department) {
      return res.status(400).json({
        success: false,
        message: 'Missing required class context parameters',
        details: {
          batch: !!batch,
          year: !!normalizedYear,
          semester: !!normalizedSemester,
          department: !!currentUser.department
        }
      });
    }
    
    // Resolve faculty ID using centralized service - use same logic as manual creation
    const facultyResolution = await resolveFacultyId({
      user: currentUser,
      classId,
      batch,
      year: normalizedYear,
      semester: parseInt(semester), // Pass numeric semester for assignedClasses matching
      section: section || 'A',
      department: currentUser.department // Use user's department, not request body
    });
    
    const { facultyId, faculty, source } = facultyResolution;
    
    console.log('👨‍🏫 Faculty resolved:', {
      facultyId,
      source,
      facultyName: faculty.name
    });
    
    // Validate faculty-class binding
    const classMetadata = {
      batch,
      year: normalizedYear,
      semester: parseInt(semester), // Use numeric semester for assignedClasses matching
      section: section || 'A',
      department: currentUser.department // Use user's department for consistency
    };
    
    const isValidBinding = await validateFacultyClassBinding(facultyId, classId, classMetadata);
    
    if (!isValidBinding) {
      console.log('❌ Faculty-class binding validation failed');
      return res.status(403).json({
        success: false,
        message: 'Faculty not authorized for this class'
      });
    }
    
    // Create audit log
    await createAuditLog({
      operation: 'bulk_upload',
      facultyId,
      classId,
      source,
      userId: currentUser._id,
      details: {
        batch,
        year: normalizedYear,
        semester: normalizedSemester,
        section: section || 'A',
        department,
        facultyName: faculty.name,
        validationPassed: true
      }
    });
    
    // Parse file based on type
    let students = [];
    const fileType = req.file.mimetype;
    
    try {
      if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
        students = parseExcelFile(req.file.buffer);
      } else if (fileType.includes('csv')) {
        students = await parseCSVFile(req.file.buffer);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported file type. Please upload Excel or CSV files only.'
        });
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: parseError.message
      });
    }
    
    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data found in the uploaded file'
      });
    }
    
    console.log(`📊 Parsed ${students.length} students from file`);
    
    // Normalize and validate all students
    const normalizedStudents = students.map(student => normalizeStudentData(student));
    const validationResults = normalizedStudents.map(student => validateStudentData(student, student._rowIndex));
    const validStudents = [];
    const invalidStudents = [];
    
    validationResults.forEach((result, index) => {
      if (result.isValid) {
        validStudents.push(normalizedStudents[index]);
      } else {
        invalidStudents.push({
          rowIndex: result.rowIndex,
          data: normalizedStudents[index],
          errors: result.errors
        });
      }
    });
    
    console.log(`📊 Validation results: ${validStudents.length} valid, ${invalidStudents.length} invalid`);
    
    // Use standardized bulk creation service
    const result = await bulkCreateStudentsWithStandardizedData({
      currentUser,
      studentsData: validStudents,
      classContext: {
        batch,
        year: normalizedYear,
        semester: parseInt(semester), // Use numeric semester for consistency
        section: section || 'A',
        department: currentUser.department
      }
    });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error.message,
        details: result.error.details
      });
    }
    
    const { successful, failed } = result.data;
    const processingTime = Date.now() - startTime;
    const addedCount = successful.length;
    const errorCount = failed.length + invalidStudents.length;
    
    // Determine upload status
    let uploadStatus = 'success';
    if (addedCount === 0 && errorCount > 0) {
      uploadStatus = 'failed';
    } else if (errorCount > 0) {
      uploadStatus = 'partial';
    }
    
    // Create upload log
    const logData = {
      facultyId: facultyId,
      classId,
      batch,
      year,
      semester,
      section: section || 'A',
      department,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      totalRecords: students.length,
      addedCount,
      skippedCount: 0,
      errorCount,
      addedStudents: successful.map(s => ({
        rollNumber: s.student.rollNumber,
        name: s.student.name,
        email: s.student.email
      })),
      skippedStudents: [],
      errorStudents: [
        ...failed.map(s => ({
          rollNumber: s.studentData.rollNumber || 'N/A',
          name: s.studentData.name || 'N/A',
          email: s.studentData.email || 'N/A',
          error: s.error.message
        })),
        ...invalidStudents.map(s => ({
          rollNumber: s.data.rollNumber || 'N/A',
          name: s.data.name || 'N/A',
          email: s.data.email || 'N/A',
          error: s.errors.join(', ')
        }))
      ],
      uploadStatus,
      processingTime,
      createdBy: currentUser._id
    };
    
    uploadLog = await createUploadLog(logData);
    
    // Create final audit log with student details
    await createAuditLog({
      operation: 'bulk_upload',
      facultyId,
      classId,
      source,
      userId: currentUser._id,
      studentCount: addedCount,
      studentIds: successful.map(s => s.student._id),
      details: {
        batch,
        year: normalizedYear,
        semester: normalizedSemester,
        section: section || 'A',
        department,
        facultyName: faculty.name,
        validationPassed: true,
        resolutionTime: processingTime,
        fileName: req.file.originalname,
        fileSize: req.file.size
      },
      status: uploadStatus
    });
    
    // Final verification: Test that uploaded students can be retrieved using faculty dashboard query
    if (addedCount > 0) {
      try {
        console.log('🔍 Final verification: Testing student retrieval...');
        const testQuery = {
          batch,
          year: normalizedYear,
          semester: normalizedSemester,
          department: currentUser.department,
          facultyId: facultyId,
          status: 'active'
        };
        
        const testResults = await Student.find(testQuery).limit(3);
        console.log(`✅ Final verification: Successfully retrieved ${testResults.length} students`);
        
        if (testResults.length === 0) {
          console.error('❌ CRITICAL: Final verification failed - no students retrievable!');
          console.error('❌ Query used:', JSON.stringify(testQuery, null, 2));
        } else {
          console.log('✅ Final verification passed: Students are retrievable and will appear in faculty dashboard');
        }
      } catch (verificationError) {
        console.error('❌ Final verification error:', verificationError);
      }
    }
    
    // Prepare response
    const response = {
      success: true,
      message: 'Bulk upload completed successfully',
      classId,
      summary: {
        totalRecords: students.length,
        addedCount,
        skippedCount: 0,
        errorCount
      },
      addedStudents: successful.map(s => ({
        rollNumber: s.student.rollNumber,
        name: s.student.name,
        email: s.student.email
      })),
      skippedStudents: [],
      errorStudents: [
        ...failed.map(s => ({
          rowIndex: s.index,
          rollNumber: s.studentData.rollNumber || 'N/A',
          name: s.studentData.name || 'N/A',
          email: s.studentData.email || 'N/A',
          errors: [s.error.message]
        })),
        ...invalidStudents.map(s => ({
          rowIndex: s.rowIndex,
          rollNumber: s.data.rollNumber || 'N/A',
          name: s.data.name || 'N/A',
          email: s.data.email || 'N/A',
          errors: s.errors
        }))
      ],
      processingTime,
      uploadLogId: uploadLog?._id
    };
    
    // Log the upload event
    console.log(`✅ Bulk upload completed: ${addedCount} students added, ${errorCount} errors in ${processingTime}ms`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Bulk upload error:', error);
    
    // Create error log if we have partial data
    if (uploadLog) {
      await createUploadLog({
        ...uploadLog,
        uploadStatus: 'failed',
        processingTime: Date.now() - startTime,
        errorCount: 1,
        errorStudents: [{
          rollNumber: 'N/A',
          name: 'N/A',
          email: 'N/A',
          error: error.message
        }]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during bulk upload',
      error: error.message
    });
  }
});

// @desc    Test endpoint for debugging
// @route   GET /api/students/test
// @access  Faculty and above
router.get('/test', authenticate, facultyAndAbove, (req, res) => {
  res.json({
    success: true,
    message: 'Student bulk upload API is working',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// @desc    Get upload logs for faculty
// @route   GET /api/students/upload-logs
// @access  Faculty and above
router.get('/upload-logs', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { page = 1, limit = 10, classId } = req.query;
    const currentUser = req.user;
    
    // Get faculty
    const faculty = await Faculty.findOne({ userId: currentUser._id, status: 'active' });
    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found'
      });
    }
    
    const query = { facultyId: faculty._id };
    if (classId) {
      query.classId = classId;
    }
    
    const uploadLogs = await UploadLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await UploadLog.countDocuments(query);
    
    res.json({
      success: true,
      data: uploadLogs,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching upload logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upload logs'
    });
  }
});

export default router;
