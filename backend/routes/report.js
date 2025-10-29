import express from 'express';
import { body, query, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

// Normalization functions (same as attendance route)
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

const makeClassKey = ({ batch, year, semester, section }) => {
  return `${batch}_${year}_${semester}${section ? `_${section}` : ''}`;
};

const router = express.Router();

// All report routes require authentication and faculty or above role
router.use(authenticate);
router.use(facultyAndAbove);

// Helper function to get class-based attendance data
async function getClassBasedAttendanceData(batch, year, semester, section, dateFilter, currentUser) {
  console.log('🔍 Getting class-based attendance data for:', { batch, year, semester, section, dateFilter });

  // Normalize inputs to match attendance marking format
  const normalizedYear = normalizeYear(year);
  const normalizedSemester = normalizeSemester(semester);
  
  console.log('🔍 Normalized values:', { normalizedYear, normalizedSemester });

  // Authorization check - ensure faculty is class advisor for this class
  if (currentUser.role === 'faculty') {
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(semester),
      department: currentUser.department,
      ...(section && { section }),
      status: 'active'
    });

    if (!faculty) {
      throw new Error('You can only generate reports for your assigned class');
    }
  }

  // Get all students in the class using normalized values
  const studentQuery = {
    batch,
    year: normalizedYear,
    semester: normalizedSemester,
    department: currentUser.department,
    ...(section && { section }),
    status: 'active'
  };
  
  console.log('🔍 Student query:', studentQuery);
  
  const studentsInClass = await Student.find(studentQuery)
    .populate('userId', 'name email mobile')
    .sort({ rollNumber: 1 });

  // Get holidays in the date range to exclude from working days
  const Holiday = (await import('../models/Holiday.js')).default;
  const holidays = await Holiday.find({
    department: currentUser.department,
    holidayDate: dateFilter,
    isActive: true
  }).select('holidayDate reason');

  // Create a set of holiday dates for quick lookup
  const holidayDates = new Set(holidays.map(h => h.holidayDate.toISOString().split('T')[0]));
  console.log(`🎉 Found ${holidays.length} holidays in date range`);

  console.log(`👥 Found ${studentsInClass.length} students in class`);
  
  // Debug: Check what students exist in the database
  const allStudents = await Student.find({
    batch,
    department: currentUser.department,
    status: 'active'
  }).select('rollNumber year semester section');
  console.log('🔍 All students in batch:', allStudents.map(s => ({
    rollNumber: s.rollNumber,
    year: s.year,
    semester: s.semester,
    section: s.section
  })));

  if (studentsInClass.length === 0) {
    return {
      studentsInClass: [],
      attendanceRecords: [],
      cumulativeAbsences: [],
      attendanceMarked: false,
      message: 'No students found in this class'
    };
  }

  // Get attendance records for the date range using normalized values
  const studentUserIds = studentsInClass.map(student => student.userId._id);
  const classId = makeClassKey({ batch, year: normalizedYear, semester: normalizedSemester, section });
  
  console.log('🔍 Report generation query:', {
    studentUserIds: studentUserIds.length,
    classId,
    dateFilter,
    batch,
    year: normalizedYear,
    semester: normalizedSemester,
    section
  });
  
  const attendanceRecords = await Attendance.find({
    studentId: { $in: studentUserIds },
    classId,
    date: dateFilter
  })
    .populate('studentId', 'name email mobile')
    .sort({ date: -1, 'studentId.name': 1 });

    console.log(`📊 Found ${attendanceRecords.length} attendance records for classId: ${classId}`);
    
    // Debug: Log sample attendance records
    if (attendanceRecords.length > 0) {
      console.log('🔍 Sample attendance records:', attendanceRecords.slice(0, 3).map(record => ({
        studentId: record.studentId._id,
        studentName: record.studentId.name,
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        classId: record.classId
      })));
    }
  
  // Check for orphaned attendance records (students in attendance but not in student management)
  const orphanedRecords = attendanceRecords.filter(record => 
    !studentUserIds.includes(record.studentId._id)
  );
  
  if (orphanedRecords.length > 0) {
    console.log('⚠️ Found orphaned attendance records:', orphanedRecords.length);
  }
  
  // Debug: Check what classIds exist in the database
  const allClassIds = await Attendance.distinct('classId', {
    studentId: { $in: studentUserIds },
    date: dateFilter
  });
  console.log('🔍 Available classIds in DB:', allClassIds);

  // Calculate cumulative absences for each student using the same logic as student dashboard
  const cumulativeAbsences = await Promise.all(
    studentsInClass.map(async (student) => {
      try {
        // Get attendance records for this student using the same logic as student dashboard
        const studentAttendanceRecords = await Attendance.find({
          studentId: student.userId._id
        }).sort({ date: -1 });

        // Calculate statistics using the same logic as /api/attendance/student/:studentId/comprehensive
        const presentCount = studentAttendanceRecords.filter(r => r.status === 'Present').length;
        const absentCount = studentAttendanceRecords.filter(r => r.status === 'Absent').length;
        const totalWorkingDays = presentCount + absentCount;
        const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 0;

        // Get the most recent absent record for reason and action taken
        const latestAbsentRecord = studentAttendanceRecords.find(record => record.status === 'Absent');
        
        // Get all absent dates
        const absentDates = studentAttendanceRecords
          .filter(record => record.status === 'Absent')
          .map(record => record.date.toISOString().split('T')[0]);

        // Debug: Log student attendance summary
        console.log(`📊 Student ${student.rollNumber} (${student.userId.name}) - Attendance Summary:`, {
          presentDays: presentCount,
          absentDays: absentCount,
          totalWorkingDays: totalWorkingDays,
          attendancePercentage: attendancePercentage,
          absentDates: absentDates
        });

        // Validate student data completeness
        const mobileNumber = student.mobile || student.userId.mobile;
        const displayMobile = mobileNumber ? mobileNumber : 'N/A';
        
        return {
          studentId: student.userId._id,
          rollNumber: student.rollNumber,
          name: student.userId.name,
          email: student.userId.email,
          mobile: displayMobile,
          totalAbsentDays: absentCount, // Use the calculated absent count from attendance summary
          totalPresentDays: presentCount,
          totalWorkingDays: totalWorkingDays,
          attendancePercentage: attendancePercentage,
          reason: latestAbsentRecord?.reason || '',
          actionTaken: latestAbsentRecord?.actionTaken || '',
          absentDates: absentDates
        };
      } catch (error) {
        console.error(`❌ Error fetching attendance for student ${student.rollNumber}:`, error);
        return {
          studentId: student.userId._id,
          rollNumber: student.rollNumber,
          name: student.userId.name,
          email: student.userId.email,
          mobile: student.mobile || student.userId.mobile || 'N/A',
          totalAbsentDays: 0,
          totalPresentDays: 0,
          totalWorkingDays: 0,
          attendancePercentage: 0,
          reason: '',
          actionTaken: '',
          absentDates: []
        };
      }
    })
  );

  // Filter to only include students with absences
  const studentsWithAbsences = cumulativeAbsences.filter(student => student.totalAbsentDays > 0);

  // Calculate total working days (excluding holidays)
  const allAttendanceDates = [...new Set(attendanceRecords.map(record => record.date.toISOString().split('T')[0]))];
  const workingDays = allAttendanceDates.filter(date => !holidayDates.has(date));
  const totalWorkingDays = workingDays.length;

  return {
    studentsInClass,
    attendanceRecords,
    cumulativeAbsences: studentsWithAbsences, // Use the filtered list of students with absences
    holidays: holidays.map(h => ({
      date: h.holidayDate.toISOString().split('T')[0],
      reason: h.reason
    })),
    totalWorkingDays,
    attendanceMarked: attendanceRecords.length > 0,
    message: attendanceRecords.length === 0 ? 'No attendance records found for this date/class.' : 
             orphanedRecords.length > 0 ? `Warning: ${orphanedRecords.length} attendance records found for students not in current class.` : null
  };
}

// Helper function to get attendance data for a class and date
async function getAttendanceData(classToQuery, dateFilter, currentUser) {
  console.log('🔍 Getting attendance data for:', { classToQuery, dateFilter });

  // Authorization check
  if (currentUser.role === 'faculty') {
    const hasUserAssignment = Array.isArray(currentUser.assignedClasses) && currentUser.assignedClasses.includes(classToQuery);
    let hasFacultyAssignment = false;
    if (!hasUserAssignment) {
      const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
      hasFacultyAssignment = facultyDoc && facultyDoc.assignedClass === classToQuery;
    }
    if (!hasUserAssignment && !hasFacultyAssignment) {
      throw new Error('You can only generate reports for your assigned class');
    }
  }

  // Get all students in the class
  const studentsInClass = await Student.find({ classAssigned: classToQuery })
    .select('_id rollNumber name userId')
    .sort({ rollNumber: 1 });

  console.log(`👥 Found ${studentsInClass.length} students in class ${classToQuery}`);

  if (studentsInClass.length === 0) {
    return {
      studentsInClass: [],
      allAttendanceRecords: [],
      absenteeRecords: [],
      attendanceMarked: false,
      message: 'No students found in this class'
    };
  }

  // Get all attendance records for the date to check if attendance was marked
  const studentUserIds = studentsInClass.map(student => student.userId);
  
  console.log('🔍 Searching for attendance records with filter:', dateFilter);
  console.log('📋 Student User IDs:', studentUserIds.length);

  const allAttendanceRecords = await Attendance.find({
    studentId: { $in: studentUserIds },
    date: dateFilter
  })
  .populate('studentId', 'name email')
  .sort({ date: -1 });

  console.log(`📊 Found ${allAttendanceRecords.length} attendance records`);

  // Check if attendance was marked for this date
  if (allAttendanceRecords.length === 0) {
    return {
      studentsInClass,
      allAttendanceRecords: [],
      absenteeRecords: [],
      attendanceMarked: false,
      message: 'Attendance not taken for this date.'
    };
  }

  // Filter for absent students only
  const absenteeRecords = allAttendanceRecords.filter(record => record.status === 'Absent');
  console.log(`❌ Found ${absenteeRecords.length} absentee records`);

  return {
    studentsInClass,
    allAttendanceRecords,
    absenteeRecords,
    attendanceMarked: true,
    message: absenteeRecords.length === 0 ? 'All students were present on this date.' : null
  };
}

// OLD ABSENTEES ENDPOINT REMOVED - Using new endpoint below

// @desc    Export absentees report as PDF
// @route   GET /api/report/absentees/export/pdf
// @access  Faculty and above
router.get('/absentees/export/pdf', async (req, res) => {
  try {
    const { class_id, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    // Get class to query
    let classToQuery = class_id;
    if (!classToQuery) {
      if (currentUser.assignedClass) {
        classToQuery = currentUser.assignedClass;
      } else {
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        if (facultyDoc && facultyDoc.assignedClass && facultyDoc.assignedClass !== 'None') {
          classToQuery = facultyDoc.assignedClass;
        }
      }
    }

    if (!classToQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Class ID is required'
      });
    }

    // Build date filter (same logic as main report)
    let dateFilter = {};
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    }

    // Get attendance data using helper function
    const { studentsInClass, absenteeRecords, attendanceMarked, message } = 
      await getAttendanceData(classToQuery, dateFilter, currentUser);

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="absentees-report-${classToQuery}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('Absentees Report', { align: 'center' });
    doc.moveDown();
    
    // Add report details
    doc.fontSize(12);
    doc.text(`Class: ${classToQuery}`, { align: 'left' });
    
    if (date) {
      doc.text(`Date: ${date}`, { align: 'left' });
    } else if (startDate && endDate) {
      doc.text(`Date Range: ${startDate} to ${endDate}`, { align: 'left' });
    }
    
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.text(`Generated by: ${currentUser.name}`, { align: 'left' });
    doc.moveDown();

    if (!attendanceMarked) {
      doc.text('⚠️ Attendance not taken for this date.', { align: 'center' });
    } else if (absenteeRecords.length === 0) {
      doc.text('✅ All students were present on this date.', { align: 'center' });
    } else {
      // Sort absentees by roll number
      const sortedAbsentees = absenteeRecords.map(record => {
        const student = studentsInClass.find(s => s.userId.toString() === record.studentId._id.toString());
        return {
          rollNo: student?.rollNumber || 'N/A',
          name: student?.name || record.studentId.name,
          date: record.date.toISOString().split('T')[0],
          status: record.status,
          reason: record.reason || 'No reason provided'
        };
      }).sort((a, b) => {
        const rollA = parseInt(a.rollNo) || 0;
        const rollB = parseInt(b.rollNo) || 0;
        return rollA - rollB;
      });

      // Add table header
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 120;
      const col3X = 250;
      const col4X = 320;
      const col5X = 420;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Roll No', col1X, tableTop);
      doc.text('Student Name', col2X, tableTop);
      doc.text('Date', col3X, tableTop);
      doc.text('Status', col4X, tableTop);
      doc.text('Reason', col5X, tableTop);

      // Add line under header
      doc.moveTo(col1X, tableTop + 15)
         .lineTo(550, tableTop + 15)
         .stroke();

      // Add data rows
      let currentY = tableTop + 25;
      doc.font('Helvetica');

      sortedAbsentees.forEach((absentee, index) => {
        if (currentY > 700) { // Start new page if needed
          doc.addPage();
          currentY = 50;
        }

        doc.text(absentee.rollNo, col1X, currentY);
        doc.text(absentee.name, col2X, currentY);
        doc.text(absentee.date, col3X, currentY);
        doc.text(absentee.status, col4X, currentY);
        doc.text(absentee.reason, col5X, currentY, { width: 100 });

        currentY += 20;
      });

      // Add summary
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total Absentees: ${sortedAbsentees.length}`, { align: 'right' });
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('❌ Export PDF error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate PDF report'
    });
  }
});

// @desc    Export absentees report as Excel
// @route   GET /api/report/absentees/export/excel
// @access  Faculty and above
router.get('/absentees/export/excel', async (req, res) => {
  try {
    const { class_id, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    // Get class to query
    let classToQuery = class_id;
    if (!classToQuery) {
      if (currentUser.assignedClass) {
        classToQuery = currentUser.assignedClass;
      } else {
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        if (facultyDoc && facultyDoc.assignedClass && facultyDoc.assignedClass !== 'None') {
          classToQuery = facultyDoc.assignedClass;
        }
      }
    }

    if (!classToQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Class ID is required'
      });
    }

    // Build date filter (same logic as main report)
    let dateFilter = {};
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    }

    // Get attendance data using helper function
    const { studentsInClass, absenteeRecords, attendanceMarked, message } = 
      await getAttendanceData(classToQuery, dateFilter, currentUser);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absentees Report');

    // Add header information
    worksheet.addRow(['Absentees Report']);
    worksheet.addRow([`Class: ${classToQuery}`]);
    
    if (date) {
      worksheet.addRow([`Date: ${date}`]);
    } else if (startDate && endDate) {
      worksheet.addRow([`Date Range: ${startDate} to ${endDate}`]);
    }
    
    worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
    worksheet.addRow([`Generated by: ${currentUser.name}`]);
    worksheet.addRow([]); // Empty row

    // Add table headers
    const headerRow = worksheet.addRow(['Roll No', 'Student Name', 'Date', 'Status', 'Reason']);
    
    // Style header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    if (!attendanceMarked) {
      worksheet.addRow(['⚠️ Attendance not taken for this date.']);
    } else if (absenteeRecords.length === 0) {
      worksheet.addRow(['✅ All students were present on this date.']);
    } else {
      // Sort absentees by roll number
      const sortedAbsentees = absenteeRecords.map(record => {
        const student = studentsInClass.find(s => s.userId.toString() === record.studentId._id.toString());
        return {
          rollNo: student?.rollNumber || 'N/A',
          name: student?.name || record.studentId.name,
          date: record.date.toISOString().split('T')[0],
          status: record.status,
          reason: record.reason || 'No reason provided'
        };
      }).sort((a, b) => {
        const rollA = parseInt(a.rollNo) || 0;
        const rollB = parseInt(b.rollNo) || 0;
        return rollA - rollB;
      });

      sortedAbsentees.forEach(absentee => {
        const dataRow = worksheet.addRow([
          absentee.rollNo,
          absentee.name,
          absentee.date,
          absentee.status,
          absentee.reason
        ]);

        // Add borders to data rows
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Add summary row
      worksheet.addRow([]);
      const summaryRow = worksheet.addRow(['', '', '', 'Total Absentees:', sortedAbsentees.length]);
      summaryRow.getCell(4).font = { bold: true };
      summaryRow.getCell(5).font = { bold: true };
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="absentees-report-${classToQuery}-${new Date().toISOString().split('T')[0]}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Export Excel error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate Excel report'
    });
  }
});

// @desc    Get enhanced absentee report with cumulative data
// @route   GET /api/report/enhanced-absentees
// @access  Faculty and above
router.get('/enhanced-absentees', [
  query('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  query('year').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  query('semester').isNumeric().withMessage('Semester must be a number'),
  query('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { batch, year, semester, section, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    console.log('📊 Enhanced report request:', { batch, year, semester, section, date, startDate, endDate });

    // Additional validation for semester range
    const semesterNum = parseInt(semester);
    if (semesterNum < 1 || semesterNum > 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Semester must be between 1 and 8'
      });
    }

    // Build date filter
    let dateFilter = {};
    if (date) {
      // Single date
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      // Date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // For enhanced reports, if no date specified, get ALL attendance records (cumulative)
      // This ensures we capture all historical absences, not just today's
      dateFilter = {}; // Empty filter means all dates
      console.log('📅 No date specified - using cumulative mode (all dates)');
    }

    // Get class-based attendance data
    const { studentsInClass, cumulativeAbsences, attendanceMarked, message, totalWorkingDays, holidays } = 
      await getClassBasedAttendanceData(batch, year, semester, section, dateFilter, currentUser);

    // Format the report data
    const reportData = cumulativeAbsences.map((student, index) => ({
      sNo: index + 1,
      studentId: student.studentId, // Include studentId for updates
      year: `${batch}, ${year}, Sem ${semester}${section ? `, Section ${section}` : ''}`,
      regNo: student.rollNumber,
      studentName: student.name,
      phoneNumber: student.mobile || 'N/A',
      totalAbsentDays: student.totalAbsentDays, // Now using the correct attendance summary data
      totalPresentDays: student.totalPresentDays,
      totalWorkingDays: student.totalWorkingDays,
      attendancePercentage: student.attendancePercentage,
      reason: student.reason,
      actionTaken: student.actionTaken,
      absentDates: student.absentDates
    }));

    console.log('✅ Enhanced report generated successfully:', {
      batch, year, semester, section,
      totalStudents: studentsInClass.length,
      totalAbsentees: cumulativeAbsences.length,
      totalWorkingDays,
      attendanceMarked
    });

    // Debug: Log sample student data to verify totalAbsentDays calculation
    if (cumulativeAbsences.length > 0) {
      console.log('🔍 Sample student absence data:', {
        firstStudent: {
          name: cumulativeAbsences[0].name,
          rollNumber: cumulativeAbsences[0].rollNumber,
          totalAbsentDays: cumulativeAbsences[0].totalAbsentDays,
          absentDates: cumulativeAbsences[0].absentDates
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        classInfo: {
          batch,
          year,
          semester,
          section: section || 'All Sections'
        },
        dateRange: { startDate, endDate, date },
        reportData,
        totalAbsentees: cumulativeAbsences.length,
        totalStudents: studentsInClass.length,
        totalWorkingDays: totalWorkingDays || 0,
        holidays: holidays || [],
        attendanceMarked,
        message,
        generatedAt: new Date().toISOString(),
        generatedBy: currentUser.name
      }
    });

  } catch (error) {
    console.error('❌ Enhanced report error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      status: 'error',
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Update reason and action taken for a student's absence
// @route   PUT /api/report/update-absence-details
// @access  Faculty and above
router.put('/update-absence-details', [
  body('studentId').isMongoId().withMessage('Valid student ID required'),
  body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  body('actionTaken').optional().isString().isLength({ max: 500 }).withMessage('Action taken cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { studentId, reason, actionTaken } = req.body;
    const currentUser = req.user;

    console.log('💾 Update absence details request:', {
      studentId,
      reason,
      actionTaken,
      currentUser: currentUser._id
    });

    // Find the most recent absent record for this student
    const latestAbsentRecord = await Attendance.findOne({
      studentId,
      status: 'Absent'
    }).sort({ date: -1 });

    console.log('🔍 Found absent record:', latestAbsentRecord);

    if (!latestAbsentRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'No absent record found for this student'
      });
    }

    // Update the record
    const updateData = {};
    if (reason !== undefined) updateData.reason = reason;
    if (actionTaken !== undefined) updateData.actionTaken = actionTaken;

    const updatedRecord = await Attendance.findByIdAndUpdate(
      latestAbsentRecord._id,
      updateData,
      { new: true }
    ).populate('studentId', 'name rollNumber');

    console.log('✅ Absence details updated:', {
      studentId,
      recordId: updatedRecord._id,
      reason: updatedRecord.reason,
      actionTaken: updatedRecord.actionTaken
    });

    res.status(200).json({
      status: 'success',
      message: 'Absence details updated successfully',
      data: {
        recordId: updatedRecord._id,
        studentName: updatedRecord.studentId.name,
        rollNumber: updatedRecord.studentId.rollNumber,
        reason: updatedRecord.reason,
        actionTaken: updatedRecord.actionTaken,
        date: updatedRecord.date
      }
    });

  } catch (error) {
    console.error('❌ Update absence details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update absence details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Export enhanced absentee report as PDF
// @route   GET /api/report/enhanced-absentees/export/pdf
// @access  Faculty and above
router.get('/enhanced-absentees/export/pdf', async (req, res) => {
  try {
    const { batch, year, semester, section, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    // Build date filter
    let dateFilter = {};
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // For enhanced reports, if no date specified, get ALL attendance records (cumulative)
      dateFilter = {}; // Empty filter means all dates
      console.log('📅 PDF Export - No date specified - using cumulative mode (all dates)');
    }

    // Get class-based attendance data
    const { studentsInClass, cumulativeAbsences, attendanceMarked, message, totalWorkingDays, holidays } = 
      await getClassBasedAttendanceData(batch, year, semester, section, dateFilter, currentUser);

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `enhanced-absentees-report-${batch}-${year}-Sem${semester}${section ? `-${section}` : ''}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('Enhanced Absentees Report', { align: 'center' });
    doc.moveDown();
    
    // Add report details
    doc.fontSize(12);
    doc.text(`Institution: [Institution Name]`, { align: 'left' });
    doc.text(`Department: ${currentUser.department}`, { align: 'left' });
    doc.text(`Class: ${batch}, ${year}, Sem ${semester}${section ? `, Section ${section}` : ''}`, { align: 'left' });
    
    if (date) {
      doc.text(`Date: ${date}`, { align: 'left' });
    } else if (startDate && endDate) {
      doc.text(`Date Range: ${startDate} to ${endDate}`, { align: 'left' });
    }
    
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.text(`Generated by: ${currentUser.name}`, { align: 'left' });
    doc.moveDown();

    if (!attendanceMarked) {
      doc.text('⚠️ No attendance records found for this date/class.', { align: 'center' });
    } else if (cumulativeAbsences.length === 0) {
      doc.text('✅ No absentees found for the selected period.', { align: 'center' });
    } else {
      // Add table header
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 80;
      const col3X = 120;
      const col4X = 200;
      const col5X = 280;
      const col6X = 350;
      const col7X = 450;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('S.No', col1X, tableTop);
      doc.text('Year', col2X, tableTop);
      doc.text('Reg No', col3X, tableTop);
      doc.text('Student Name', col4X, tableTop);
      doc.text('Phone No', col5X, tableTop);
      doc.text('Total Absent', col6X, tableTop);
      doc.text('Reason', col7X, tableTop);

      // Add line under header
      doc.moveTo(col1X, tableTop + 15)
         .lineTo(550, tableTop + 15)
         .stroke();

      // Add data rows
      let currentY = tableTop + 25;
      doc.font('Helvetica');

      cumulativeAbsences.forEach((student, index) => {
        if (currentY > 700) { // Start new page if needed
          doc.addPage();
          currentY = 50;
        }

        const yearText = `${batch}, ${year}, Sem ${semester}${section ? `, Section ${section}` : ''}`;
        
        doc.text((index + 1).toString(), col1X, currentY);
        doc.text(yearText, col2X, currentY, { width: 35 });
        doc.text(student.rollNumber, col3X, currentY);
        doc.text(student.name, col4X, currentY, { width: 75 });
        doc.text(student.mobile || 'N/A', col5X, currentY, { width: 65 });
        doc.text(student.totalAbsentDays.toString(), col6X, currentY);
        doc.text(student.reason || 'No reason provided', col7X, currentY, { width: 100 });

        currentY += 20;
      });

      // Add summary
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total Absentees: ${cumulativeAbsences.length}`, { align: 'right' });
      doc.text(`Total Students: ${studentsInClass.length}`, { align: 'right' });
    }

    // Add signatures section
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Signatures:', { align: 'left' });
    doc.moveDown();
    
    // Get the current Y position for consistent alignment
    const signatureY = doc.y;
    
    doc.fontSize(10).font('Helvetica');
    doc.text('Class Advisor', 100, signatureY);
    doc.text('HOD', 300, signatureY);
    doc.text('Principal', 500, signatureY);
    
    // Add signature lines at consistent Y position
    const lineY = signatureY + 20;
    doc.moveTo(100, lineY).lineTo(200, lineY).stroke();
    doc.moveTo(300, lineY).lineTo(400, lineY).stroke();
    doc.moveTo(500, lineY).lineTo(600, lineY).stroke();

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('❌ Export enhanced PDF error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate enhanced PDF report'
    });
  }
});

// @desc    Export enhanced absentee report as Excel
// @route   GET /api/report/enhanced-absentees/export/excel
// @access  Faculty and above
router.get('/enhanced-absentees/export/excel', async (req, res) => {
  try {
    const { batch, year, semester, section, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    // Build date filter
    let dateFilter = {};
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // For enhanced reports, if no date specified, get ALL attendance records (cumulative)
      dateFilter = {}; // Empty filter means all dates
      console.log('📅 Excel Export - No date specified - using cumulative mode (all dates)');
    }

    // Get class-based attendance data
    const { studentsInClass, cumulativeAbsences, attendanceMarked, message, totalWorkingDays, holidays } = 
      await getClassBasedAttendanceData(batch, year, semester, section, dateFilter, currentUser);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Enhanced Absentees Report');

    // Add header information
    worksheet.addRow(['Enhanced Absentees Report']);
    worksheet.addRow([`Institution: [Institution Name]`]);
    worksheet.addRow([`Department: ${currentUser.department}`]);
    worksheet.addRow([`Class: ${batch}, ${year}, Sem ${semester}${section ? `, Section ${section}` : ''}`]);
    
    if (date) {
      worksheet.addRow([`Date: ${date}`]);
    } else if (startDate && endDate) {
      worksheet.addRow([`Date Range: ${startDate} to ${endDate}`]);
    }
    
    worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
    worksheet.addRow([`Generated by: ${currentUser.name}`]);
    worksheet.addRow([]); // Empty row

    // Add table headers
    const headerRow = worksheet.addRow([
      'S.No', 'Year (Batch/Year/Semester)', 'Reg No', 'Student Name', 
      'Phone Number', 'Total No. of Days Absent', 'Reason', 'Action Taken'
    ]);
    
    // Style header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    if (!attendanceMarked) {
      worksheet.addRow(['⚠️ No attendance records found for this date/class.']);
    } else if (cumulativeAbsences.length === 0) {
      worksheet.addRow(['✅ No absentees found for the selected period.']);
    } else {
      const yearText = `${batch}, ${year}, Sem ${semester}${section ? `, Section ${section}` : ''}`;
      
      cumulativeAbsences.forEach((student, index) => {
        const dataRow = worksheet.addRow([
          index + 1,
          yearText,
          student.rollNumber,
          student.name,
          student.mobile || 'N/A',
          student.totalAbsentDays,
          student.reason || 'No reason provided',
          student.actionTaken || 'No action taken'
        ]);

        // Add borders to data rows
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Add summary rows
      worksheet.addRow([]);
      const summaryRow1 = worksheet.addRow(['', '', '', '', '', 'Total Absentees:', cumulativeAbsences.length]);
      const summaryRow2 = worksheet.addRow(['', '', '', '', '', 'Total Students:', studentsInClass.length]);
      
      summaryRow1.getCell(6).font = { bold: true };
      summaryRow1.getCell(7).font = { bold: true };
      summaryRow2.getCell(6).font = { bold: true };
      summaryRow2.getCell(7).font = { bold: true };

      // Add signatures section
      worksheet.addRow([]);
      const signatureHeaderRow = worksheet.addRow(['Signatures:']);
      signatureHeaderRow.getCell(1).font = { bold: true };
      
      const signatureRow = worksheet.addRow(['Class Advisor', '', 'HOD', '', 'Principal']);
      signatureRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
      });
      
      // Add signature lines (empty rows for signing)
      worksheet.addRow(['_________________', '', '_________________', '', '_________________']);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    // Set response headers
    const filename = `enhanced-absentees-report-${batch}-${year}-Sem${semester}${section ? `-${section}` : ''}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Export enhanced Excel error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate enhanced Excel report'
    });
  }
});

// Test endpoint to check if report routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Report routes are working',
    timestamp: new Date().toISOString()
  });
});

// @desc    Generate absentees report
// @route   GET /api/report/absentees
// @access  Faculty and above
router.get('/absentees', [
  query('batch').notEmpty().withMessage('Batch is required'),
  query('year').notEmpty().withMessage('Year is required'),
  query('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  query('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
], async (req, res) => {
  try {
    console.log('🔍 Absentees endpoint hit with query:', req.query);
    console.log('🔍 User from auth middleware:', req.user);
    
    // Extract parameters - handle both old and new format
    const { batch, year, semester, section, startDate, endDate, class_id, date } = req.query;
    const currentUser = req.user;

    // If using old format, try to extract from class_id
    let actualBatch, actualYear, actualSemester, actualSection;
    
    if (class_id) {
      // Parse class_id format: "2022-2026, 4th Year, Sem 7, Section A"
      const parts = class_id.split(', ');
      if (parts.length >= 4) {
        actualBatch = parts[0];
        actualYear = parts[1];
        actualSemester = parts[2].replace('Sem ', '');
        actualSection = parts[3].replace('Section ', '');
      }
    } else {
      actualBatch = batch;
      actualYear = year;
      actualSemester = semester;
      actualSection = section;
    }

    console.log('📊 Absentees report request:', { 
      batch: actualBatch, 
      year: actualYear, 
      semester: actualSemester, 
      section: actualSection, 
      startDate, 
      endDate, 
      userId: currentUser._id 
    });

    // Validate required parameters
    if (!actualBatch || !actualYear || !actualSemester) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: batch, year, semester are required'
      });
    }

    // Normalize inputs
    const normalizedYear = normalizeYear(actualYear);
    const normalizedSemester = normalizeSemester(actualSemester);
    
    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // If no date range specified, get all attendance records
      dateFilter = {};
    }

    // Get all students in the class - try different semester formats
    let studentsInClass = [];
    
    // Try the normalized format first (without section filter like history-by-class)
    const studentQuery1 = {
      batch: actualBatch,
      year: normalizedYear,
      semester: normalizedSemester,
      department: currentUser.department,
      status: 'active'
    };
    
    console.log('🔍 Student query (normalized):', studentQuery1);
    studentsInClass = await Student.find(studentQuery1)
      .populate('userId', 'name email mobile')
      .sort({ rollNumber: 1 });

    console.log(`👥 Found ${studentsInClass.length} students with normalized format`);

    // If no students found, try with raw semester format
    if (studentsInClass.length === 0) {
      const studentQuery2 = {
        batch: actualBatch,
        year: normalizedYear,
        semester: actualSemester, // Use raw semester format
        department: currentUser.department,
        status: 'active'
      };
      
      console.log('🔍 Student query (raw):', studentQuery2);
      studentsInClass = await Student.find(studentQuery2)
        .populate('userId', 'name email mobile')
        .sort({ rollNumber: 1 });
      
      console.log(`👥 Found ${studentsInClass.length} students with raw format`);
    }

    // If still no students found, try with integer semester
    if (studentsInClass.length === 0) {
      const studentQuery3 = {
        batch: actualBatch,
        year: normalizedYear,
        semester: parseInt(actualSemester), // Try integer format
        department: currentUser.department,
        status: 'active'
      };
      
      console.log('🔍 Student query (integer):', studentQuery3);
      studentsInClass = await Student.find(studentQuery3)
        .populate('userId', 'name email mobile')
        .sort({ rollNumber: 1 });
      
      console.log(`👥 Found ${studentsInClass.length} students with integer format`);
    }

    // Debug: Check what sections the students actually have
    if (studentsInClass.length > 0) {
      console.log('🔍 Student sections:', studentsInClass.map(s => ({
        rollNumber: s.rollNumber,
        name: s.userId.name,
        section: s.section
      })));
    }

    // Filter by section after finding students (like history-by-class does)
    if (actualSection && studentsInClass.length > 0) {
      const originalCount = studentsInClass.length;
      studentsInClass = studentsInClass.filter(student => student.section === actualSection);
      console.log(`🔍 Filtered by section '${actualSection}': ${originalCount} -> ${studentsInClass.length} students`);
      
      // If no students after section filter, try without section filter
      if (studentsInClass.length === 0) {
        console.log('⚠️ No students found with section filter, using all students');
        studentsInClass = await Student.find({
          batch: actualBatch,
          year: normalizedYear,
          semester: normalizedSemester,
          department: currentUser.department,
          status: 'active'
        })
          .populate('userId', 'name email mobile')
          .sort({ rollNumber: 1 });
        console.log(`👥 Using all students without section filter: ${studentsInClass.length} students`);
      }
    }

    if (studentsInClass.length === 0) {
      return res.json({
        success: true,
        data: {
          classInfo: {
            batch: actualBatch,
            year: actualYear,
            semester: actualSemester,
            section: actualSection || 'All',
            department: currentUser.department
          },
          reportInfo: {
            totalStudents: 0,
            totalAbsentees: 0,
            totalWorkingDays: 0,
            holidaysCount: 0,
            dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All dates'
          },
          absentees: []
        }
      });
    }

    // Get attendance records for the students
    const studentUserIds = studentsInClass.map(student => student.userId._id);
    
    // Determine the correct semester format for classId generation
    let semesterForClassId = normalizedSemester;
    if (studentsInClass.length > 0) {
      // Use the semester format that actually found students
      const firstStudent = studentsInClass[0];
      if (firstStudent.classId) {
        // Extract semester from existing classId
        const classIdParts = firstStudent.classId.split('_');
        if (classIdParts.length >= 3) {
          semesterForClassId = classIdParts[2]; // Get semester part
        }
      }
    }
    
    const classId = makeClassKey({ batch: actualBatch, year: normalizedYear, semester: semesterForClassId, section: actualSection });
    console.log('🔑 Generated classId:', classId);
    
    const attendanceRecords = await Attendance.find({
      studentId: { $in: studentUserIds },
      classId,
      date: dateFilter
    })
    .populate('studentId', 'name email mobile')
    .sort({ date: -1, 'studentId.name': 1 });

    console.log(`📊 Found ${attendanceRecords.length} attendance records`);

    // Calculate absentees data
    const studentAbsenceMap = {};
    
    // Initialize all students
    studentsInClass.forEach(student => {
      studentAbsenceMap[student.userId._id] = {
        studentId: student.userId._id,
        rollNumber: student.rollNumber,
        name: student.userId.name,
        mobile: student.userId.mobile,
        totalAbsentDays: 0,
        totalPresentDays: 0,
        absentDates: [],
        reason: '',
        actionTaken: ''
      };
    });

    // Process attendance records
    attendanceRecords.forEach(record => {
      const studentId = record.studentId._id;
      if (studentAbsenceMap[studentId]) {
        if (record.status === 'Absent') {
          studentAbsenceMap[studentId].totalAbsentDays++;
          studentAbsenceMap[studentId].absentDates.push(record.date.toISOString().split('T')[0]);
          if (record.reason) {
            studentAbsenceMap[studentId].reason = record.reason;
          }
          if (record.actionTaken) {
            studentAbsenceMap[studentId].actionTaken = record.actionTaken;
          }
        } else if (record.status === 'Present') {
          studentAbsenceMap[studentId].totalPresentDays++;
        }
      }
    });

    // Calculate attendance percentages
    const totalWorkingDays = attendanceRecords.length > 0 ? 
      new Set(attendanceRecords.map(r => r.date.toISOString().split('T')[0])).size : 0;
    
    Object.values(studentAbsenceMap).forEach(student => {
      const totalDays = student.totalAbsentDays + student.totalPresentDays;
      student.attendancePercentage = totalDays > 0 ? (student.totalPresentDays / totalDays) * 100 : 100;
      student.totalWorkingDays = totalWorkingDays;
    });

    // Filter only students who have been absent (totalAbsentDays > 0)
    const absenteesData = Object.values(studentAbsenceMap).filter(student => student.totalAbsentDays > 0);

    // Format the absentees report data
    const absenteesReport = absenteesData.map((student, index) => ({
      sNo: index + 1,
      rollNumber: student.rollNumber,
      name: student.name,
      totalDaysAbsent: student.totalAbsentDays,
      reason: student.reason || 'Not specified',
      actionTaken: student.actionTaken || 'No action taken',
      attendancePercentage: student.attendancePercentage,
      absentDates: student.absentDates || []
    }));

    console.log('✅ Absentees report generated successfully:', {
      totalStudents: studentsInClass.length,
      totalAbsentees: absenteesReport.length,
      totalWorkingDays,
      holidaysCount: 0
    });

    res.json({
      success: true,
      data: {
        classInfo: {
          batch: actualBatch,
          year: actualYear,
          semester: actualSemester,
          section: actualSection || 'All',
          department: currentUser.department
        },
        reportInfo: {
          totalStudents: studentsInClass.length,
          totalAbsentees: absenteesReport.length,
          totalWorkingDays,
          holidaysCount: 0,
          dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All dates'
        },
        absentees: absenteesReport
      }
    });

  } catch (error) {
    console.error('❌ Error generating absentees report:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate absentees report',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
