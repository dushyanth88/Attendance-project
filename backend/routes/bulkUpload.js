/**
 * Bulk upload routes for students
 */

import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { bulkCreateStudentsWithStandardizedData } from '../services/studentCreationService.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import { body, validationResult } from 'express-validator';

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
 * Validate student data
 */
const validateStudentData = (student, rowIndex) => {
  const errors = [];
  
  // Required fields
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
 * Check for duplicates
 */
const checkDuplicates = async (students, facultyId, department) => {
  const rollNumbers = students.map(s => s.rollNumber.toString().trim());
  const emails = students.map(s => s.email.toString().trim().toLowerCase());
  
  // Check existing students in database
  const existingStudents = await Student.find({
    $or: [
      { rollNumber: { $in: rollNumbers } },
      { email: { $in: emails } }
    ],
    department,
    status: 'active'
  });
  
  // Check for duplicates within the upload batch
  const duplicateRollNumbers = [];
  const duplicateEmails = [];
  const seenRollNumbers = new Set();
  const seenEmails = new Set();
  
  students.forEach((student, index) => {
    const rollNumber = student.rollNumber.toString().trim();
    const email = student.email.toString().trim().toLowerCase();
    
    if (seenRollNumbers.has(rollNumber)) {
      duplicateRollNumbers.push({ index, rollNumber, rowIndex: student._rowIndex });
    } else {
      seenRollNumbers.add(rollNumber);
    }
    
    if (seenEmails.has(email)) {
      duplicateEmails.push({ index, email, rowIndex: student._rowIndex });
    } else {
      seenEmails.add(email);
    }
  });
  
  return {
    existingStudents,
    duplicateRollNumbers,
    duplicateEmails
  };
};

// @desc    Upload students in bulk
// @route   POST /api/bulk-upload/students
// @access  Faculty and above
router.post('/students', authenticate, facultyAndAbove, upload.single('file'), [
  body('batch').notEmpty().withMessage('Batch is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('section').optional().default('A'),
  body('department').notEmpty().withMessage('Department is required')
], async (req, res) => {
  try {
    console.log('📤 Bulk upload request received');
    
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
    
    // Normalize student data
    const normalizedStudents = students.map(student => normalizeStudentData(student));
    
    // Use standardized bulk creation service
    const result = await bulkCreateStudentsWithStandardizedData({
      currentUser,
      studentsData: normalizedStudents,
      classContext: {
        batch,
        year,
        semester: `Sem ${semester}`,
        section: section || 'A',
        department
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
    
    // Prepare response
    const response = {
      success: true,
      message: 'Bulk upload completed',
      summary: {
        totalRows: students.length,
        validStudents: finalValidStudents.length,
        insertedStudents: insertedStudents.length,
        invalidStudents: invalidStudents.length,
        skippedStudents: validStudents.length - finalValidStudents.length
      },
      details: {
        insertedStudents: insertedStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          email: s.email
        })),
        invalidStudents: invalidStudents.map(s => ({
          rowIndex: s.rowIndex,
          rollNumber: s.data.rollNumber,
          name: s.data.name,
          errors: s.errors
        })),
        duplicateCheck: {
          existingRollNumbers: duplicateCheck.existingStudents.map(s => s.rollNumber),
          existingEmails: duplicateCheck.existingStudents.map(s => s.email),
          duplicateRollNumbers: duplicateCheck.duplicateRollNumbers.map(d => d.rollNumber),
          duplicateEmails: duplicateCheck.duplicateEmails.map(d => d.email)
        }
      }
    };
    
    // Log the upload event
    console.log(`✅ Bulk upload completed: ${insertedStudents.length} students added, ${invalidStudents.length} invalid, ${validStudents.length - finalValidStudents.length} skipped`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk upload',
      error: error.message
    });
  }
});

// @desc    Test authentication
// @route   GET /api/bulk-upload/test-auth
// @access  Faculty and above
router.get('/test-auth', authenticate, facultyAndAbove, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: req.user
  });
});

// @desc    Download sample template
// @route   GET /api/bulk-upload/template
// @access  Faculty and above
router.get('/template', authenticate, facultyAndAbove, (req, res) => {
  try {
    console.log('Template download requested by user:', req.user?.id);
    // Create sample data
    const sampleData = [
      {
        'Roll Number': 'STU001',
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Mobile': '9876543210',
        'Parent Contact': '9876543211',
        'Password': 'password123'
      },
      {
        'Roll Number': 'STU002',
        'Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Mobile': '9876543212',
        'Parent Contact': '9876543213',
        'Password': 'password123'
      }
    ];
    
    // Create workbook
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    
    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Roll Number
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Mobile
      { wch: 15 }, // Parent Contact
      { wch: 15 }  // Password
    ];
    worksheet['!cols'] = columnWidths;
    
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');
    
    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    console.log('Buffer generated, size:', buffer.length);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="student_template.xlsx"');
    res.send(buffer);
    
    console.log('Template sent successfully');
    
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template'
    });
  }
});

export default router;
