import express from 'express';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = express.Router();

// All report routes require authentication and faculty or above role
router.use(authenticate);
router.use(facultyAndAbove);

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

// @desc    Get absentees report for a class and date range
// @route   GET /api/report/absentees
// @access  Faculty and above
router.get('/absentees', async (req, res) => {
  try {
    const { class_id, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    console.log('📊 Report request:', { class_id, date, startDate, endDate });
    console.log('👤 Current user:', { id: currentUser._id, role: currentUser.role, assignedClass: currentUser.assignedClass });

    // Get class to query - prioritize class_id from request
    let classToQuery = class_id;
    
    // If no class_id provided, try to get from user's assigned class
    if (!classToQuery) {
      if (currentUser.assignedClass) {
        classToQuery = currentUser.assignedClass;
      } else if (Array.isArray(currentUser.assignedClasses) && currentUser.assignedClasses.length > 0) {
        classToQuery = currentUser.assignedClasses[0];
      } else {
        // Try to get from Faculty model
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        if (facultyDoc && facultyDoc.assignedClass && facultyDoc.assignedClass !== 'None') {
          classToQuery = facultyDoc.assignedClass;
        }
      }
    }

    console.log('🏫 Class to query:', classToQuery);

    if (!classToQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Class ID is required'
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
      console.log('📅 Single date filter:', { startOfDay, endOfDay });
    } else if (startDate && endDate) {
      // Date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
      console.log('📅 Date range filter:', { start, end });
    } else {
      // Default to today if no date specified
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { $gte: startOfDay, $lte: endOfDay };
      console.log('📅 Default today filter:', { startOfDay, endOfDay });
    }

    // Get attendance data using helper function
    const { studentsInClass, allAttendanceRecords, absenteeRecords, attendanceMarked, message } = 
      await getAttendanceData(classToQuery, dateFilter, currentUser);

    // Format the absentee data with proper sorting
    const absentees = absenteeRecords.map(record => {
      const student = studentsInClass.find(s => s.userId.toString() === record.studentId._id.toString());
      return {
        id: record._id,
        rollNo: student?.rollNumber || 'N/A',
        studentName: student?.name || record.studentId.name,
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        reason: record.reason || '',
        studentId: record.studentId._id
      };
    }).sort((a, b) => {
      // Sort by roll number (convert to number for proper sorting)
      const rollA = parseInt(a.rollNo) || 0;
      const rollB = parseInt(b.rollNo) || 0;
      return rollA - rollB;
    });

    console.log('✅ Report generated successfully:', {
      class: classToQuery,
      totalStudents: studentsInClass.length,
      totalAttendanceRecords: allAttendanceRecords.length,
      totalAbsentees: absentees.length,
      attendanceMarked
    });

    res.status(200).json({
      status: 'success',
      data: {
        class: classToQuery,
        dateRange: { startDate, endDate, date },
        absentees,
        totalAbsentees: absentees.length,
        totalAttendanceRecords: allAttendanceRecords.length,
        attendanceMarked,
        message
      }
    });

  } catch (error) {
    console.error('❌ Get absentees report error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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

export default router;
