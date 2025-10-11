import express from 'express';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';
import { authenticate, facultyAndAbove, hodAndAbove, principalAndAbove, verifyToken } from '../middleware/auth.js';
import ClassAttendance from '../models/ClassAttendance.js';
import { getCurrentISTDate, getISTStartOfDay, getISTEndOfDay, getAttendanceDate, createISTExactDateFilter, getCurrentISTTimestamp } from '../utils/istTimezone.js';

const router = express.Router();

// Helpers for year/semester normalization
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

// SSE clients mapped by student userId => Set of response streams
const studentSseClients = new Map();

// @desc    Mark attendance for a specific class (faculty class management)
// @route   POST /api/attendance/mark-class
// @access  Faculty and above
router.post('/mark-class', [
  body('facultyId').isMongoId().withMessage('Valid faculty ID is required'),
  body('batch').notEmpty().withMessage('Batch is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('section').notEmpty().withMessage('Section is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('attendance').isArray().withMessage('Attendance must be an array'),
  body('attendance.*.studentId').isMongoId().withMessage('Valid student ID is required'),
  body('attendance.*.status').isIn(['Present', 'Absent']).withMessage('Status must be Present or Absent')
], authenticate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { facultyId, batch, year, semester, section, date, attendance } = req.body;
    const currentUser = req.user;

    // Verify faculty is assigned to this class
    const faculty = await Faculty.findOne({
      _id: facultyId,
      'classAdvisors.batch': batch,
      'classAdvisors.year': year,
      'classAdvisors.semester': semester,
      'classAdvisors.section': section,
      'classAdvisors.isActive': true
    });

    if (!faculty) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not assigned as class advisor for this section'
      });
    }

    // Convert date to IST
    const istDate = getCurrentISTDate(date);
    const attendanceDate = getAttendanceDate(istDate);

    // Check if attendance already exists for this class and date
    const existingAttendance = await Attendance.findOne({
      batch,
      year,
      semester,
      section,
      date: attendanceDate,
      facultyId
    });

    if (existingAttendance) {
      return res.status(400).json({
        status: 'error',
        message: 'Attendance already marked for this class and date',
        data: { existingAttendanceId: existingAttendance._id }
      });
    }

    // Create new attendance record
    const newAttendance = new Attendance({
      facultyId,
      batch,
      year,
      semester,
      section,
      date: attendanceDate,
      attendance: attendance.map(record => ({
        studentId: record.studentId,
        status: record.status
      })),
      createdAt: getCurrentISTTimestamp(),
      updatedAt: getCurrentISTTimestamp()
    });

    await newAttendance.save();

    // Calculate statistics
    const presentCount = attendance.filter(record => record.status === 'Present').length;
    const absentCount = attendance.filter(record => record.status === 'Absent').length;
    const totalStudents = attendance.length;

    res.status(201).json({
      status: 'success',
      message: 'Attendance marked successfully',
      data: {
        attendanceId: newAttendance._id,
        classInfo: {
          batch,
          year,
          semester,
          section
        },
        statistics: {
          totalStudents,
          presentCount,
          absentCount,
          attendancePercentage: totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0
        },
        date: attendanceDate
      }
    });
  } catch (error) {
    console.error('Error marking class attendance:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while marking attendance'
    });
  }
});

// @desc    Get students for a specific class
// @route   GET /api/attendance/class-students
// @access  Faculty and above
router.get('/class-students', authenticate, async (req, res) => {
  try {
    const { batch, year, semester, section } = req.query;
    const currentUser = req.user;

    if (!batch || !year || !semester || !section) {
      return res.status(400).json({
        status: 'error',
        message: 'Batch, year, semester, and section are required'
      });
    }

    // Verify faculty is assigned to this class
    const faculty = await Faculty.findOne({
      _id: currentUser._id,
      'classAdvisors.batch': batch,
      'classAdvisors.year': year,
      'classAdvisors.semester': semester,
      'classAdvisors.section': section,
      'classAdvisors.isActive': true
    });

    if (!faculty) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not assigned as class advisor for this section'
      });
    }

    // Get students for this class
    const students = await Student.find({
      batch,
      year,
      semester,
      section,
      department: currentUser.department
    }).select('name email rollNumber mobile batch year semester section department')
     .sort({ rollNumber: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        students,
        totalStudents: students.length,
        classInfo: {
          batch,
          year,
          semester,
          section,
          department: currentUser.department
        }
      }
    });
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching class students'
    });
  }
});

// @desc    Get attendance history for a specific class
// @route   GET /api/attendance/class-history
// @access  Faculty and above
router.get('/class-history', authenticate, async (req, res) => {
  try {
    const { batch, year, semester, section, startDate, endDate } = req.query;
    const currentUser = req.user;

    if (!batch || !year || !semester || !section) {
      return res.status(400).json({
        status: 'error',
        message: 'Batch, year, semester, and section are required'
      });
    }

    // Verify faculty is assigned to this class
    const faculty = await Faculty.findOne({
      _id: currentUser._id,
      'classAdvisors.batch': batch,
      'classAdvisors.year': year,
      'classAdvisors.semester': semester,
      'classAdvisors.section': section,
      'classAdvisors.isActive': true
    });

    if (!faculty) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not assigned as class advisor for this section'
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      const startIST = getISTStartOfDay(startDate);
      const endIST = getISTEndOfDay(endDate);
      dateFilter = {
        date: {
          $gte: startIST,
          $lte: endIST
        }
      };
    } else if (startDate) {
      const startIST = getISTStartOfDay(startDate);
      dateFilter = { date: { $gte: startIST } };
    } else if (endDate) {
      const endIST = getISTEndOfDay(endDate);
      dateFilter = { date: { $lte: endIST } };
    }

    // Get attendance records for this class
    const attendanceRecords = await Attendance.find({
      batch,
      year,
      semester,
      section,
      facultyId: currentUser._id,
      ...dateFilter
    })
    .populate('attendance.studentId', 'name rollNumber')
    .sort({ date: -1 });

    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.reduce((sum, record) => {
      return sum + record.attendance.filter(att => att.status === 'Present').length;
    }, 0);
    const totalAbsent = attendanceRecords.reduce((sum, record) => {
      return sum + record.attendance.filter(att => att.status === 'Absent').length;
    }, 0);

    res.status(200).json({
      status: 'success',
      data: {
        attendanceRecords,
        totalRecords,
        statistics: {
          totalPresent,
          totalAbsent,
          averageAttendance: totalRecords > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0
        },
        classInfo: {
          batch,
          year,
          semester,
          section
        }
      }
    });
  } catch (error) {
    console.error('Error fetching class attendance history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching attendance history'
    });
  }
});

const addSseClient = (studentUserId, res) => {
  if (!studentSseClients.has(studentUserId)) {
    studentSseClients.set(studentUserId, new Set());
  }
  studentSseClients.get(studentUserId).add(res);
};

const removeSseClient = (studentUserId, res) => {
  const set = studentSseClients.get(studentUserId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) studentSseClients.delete(studentUserId);
};

const sendAttendanceEvent = (studentUserId, payload) => {
  const set = studentSseClients.get(String(studentUserId));
  if (!set || set.size === 0) return;
  const data = `event: attendance\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch (_) { /* ignore broken pipe */ }
  }
};

// @desc    SSE stream for student real-time attendance updates
// @route   GET /api/attendance/stream?token=... (JWT access token)
// @access  Student (self)
router.get('/stream', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Token required' });
    }
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    const user = await User.findById(decoded.id).select('_id role status');
    if (!user || user.status !== 'active' || user.role !== 'student') {
      return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Register client
    const studentUserId = String(user._id);
    addSseClient(studentUserId, res);

    // Initial event to confirm connection
    res.write(`event: connected\n` + `data: {"status":"ok"}\n\n`);

    // Heartbeat
    const hb = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch (_) { /* ignore */ }
    }, 25000);

    req.on('close', () => {
      clearInterval(hb);
      removeSseClient(studentUserId, res);
      try { res.end(); } catch (_) {}
    });
  } catch (error) {
    console.error('SSE stream error:', error);
    try { res.end(); } catch (_) {}
  }
});

// @desc    Mark daily attendance for a class
// @route   POST /api/attendance/mark
// @access  Faculty and above
router.post('/mark', authenticate, facultyAndAbove, [
  body('classId').optional().isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class'),
  body('class_assigned').optional().isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('absentRollNumbers').optional().isArray().withMessage('absentRollNumbers must be an array'),
  body('absentees').optional().isArray().withMessage('absentees must be an array')
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

    const currentUser = req.user;
    const classAssigned = req.body.classId || req.body.class_assigned;
    if (!classAssigned) {
      return res.status(400).json({ status: 'error', message: 'classId is required' });
    }
    
    // Get the attendance date in IST timezone
    const requestDateString = getAttendanceDate(req.body.date);
    
    console.log('📅 Marking attendance for date:', requestDateString);
    const absenteesRaw = req.body.absentRollNumbers ?? req.body.absentees ?? [];
    const absentees = Array.isArray(absenteesRaw) ? absenteesRaw.map(r => String(r).trim()).filter(Boolean) : [];

    // Authorization: Faculty can only mark attendance for their assigned class
    if (currentUser.role === 'faculty') {
      const hasUserAssignment = Array.isArray(currentUser.assignedClasses) && currentUser.assignedClasses.includes(classAssigned);
      let hasFacultyAssignment = false;
      if (!hasUserAssignment) {
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        hasFacultyAssignment = facultyDoc && facultyDoc.assignedClass === classAssigned;
      }
      if (!hasUserAssignment && !hasFacultyAssignment) {
        return res.status(403).json({ status: 'error', message: 'You are not assigned to this class' });
      }
    }

    // Fetch all students in the class for the same department
    const students = await Student.find({ classAssigned, department: currentUser.department, status: 'active' });
    if (!students || students.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No students found for this class' });
    }

    // Validate absentees roll numbers exist in that class
    const rollToStudent = new Map(students.map(s => [s.rollNumber, s]));
    for (const roll of absentees) {
      if (!rollToStudent.has(roll)) {
        return res.status(400).json({ status: 'error', message: `Invalid absentee roll number: ${roll}` });
      }
    }

    // Check duplicate attendance: any existing class record or per-student records on the date
    const existingClass = await ClassAttendance.findOne({ classId: classAssigned, date: requestDateString });
    if (existingClass) {
      return res.status(400).json({ status: 'error', message: 'Attendance already marked. Use Edit Attendance.' });
    }
    const studentIds = students.map(s => s.userId); // Attendance.studentId references User
    const existingCount = await Attendance.countDocuments({
      studentId: { $in: studentIds },
      date: requestDateString
    });
    if (existingCount > 0) {
      return res.status(400).json({ status: 'error', message: 'Attendance already marked. Use Edit Attendance.' });
    }

    // Prepare bulk attendance records: default Present, Absent for listed rolls
    const bulkOps = students.map(s => ({
      insertOne: {
        document: {
          studentId: s.userId,
          facultyId: currentUser._id,
          date: getISTStartOfDay(requestDateString), // Store IST start of day as UTC Date
          localDate: requestDateString, // Store IST date string for easier filtering
          status: absentees.includes(s.rollNumber) ? 'Absent' : 'Present',
          reason: null, // Initialize as null, students can submit reasons later
          updatedBy: 'faculty',
          updatedAt: getCurrentISTTimestamp()
        }
      }
    }));

    const result = await Attendance.bulkWrite(bulkOps, { ordered: true });
    console.log('✅ Bulk write result:', result);

    // Verify records were created using IST date range
    const dateFilter = createISTExactDateFilter(requestDateString);
    const verificationRecords = await Attendance.find({
      studentId: { $in: students.map(s => s.userId) },
      ...dateFilter
    });
    console.log(`🔍 Verification: Created ${verificationRecords.length} attendance records`);

    const classDoc = await ClassAttendance.create({
      classId: classAssigned,
      date: requestDateString,
      absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
      markedBy: currentUser._id
    });

    return res.status(201).json({ 
      status: 'success', 
      message: 'Attendance marked successfully', 
      attendanceId: classDoc._id,
      data: {
        class: classAssigned,
        date: requestDateString,
        totalStudents: students.length,
        recordsCreated: verificationRecords.length,
        absentStudents: absentees.length
      }
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to mark attendance' });
  }
});

// @desc    Get attendance records for a student
// @route   GET /api/attendance/student/:studentId
// @access  Faculty and above, or student accessing their own data
router.get('/student/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    // Check if user can access this student's data
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only view your own attendance'
      });
    }

    // Build filter using localDate for simpler timezone handling
    const filter = { studentId };
    if (startDate || endDate) {
      filter.localDate = {};
      if (startDate) {
        const startDateStr = getAttendanceDate(startDate);
        filter.localDate.$gte = startDateStr;
      }
      if (endDate) {
        const endDateStr = getAttendanceDate(endDate);
        filter.localDate.$lte = endDateStr;
      }
    }

    const skip = (page - 1) * limit;

    const attendanceDocs = await Attendance.find(filter)
      .populate('facultyId', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(filter);

    // Calculate attendance statistics
    const stats = await Attendance.aggregate([
      { $match: { studentId: new (Attendance.db.base.Types.ObjectId)(studentId), ...(filter.date ? { date: filter.date } : {}) } },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          absentDays: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } }
        }
      }
    ]);

    const attendanceStats = stats[0] || { totalDays: 0, presentDays: 0, absentDays: 0 };
    const overallPercentage = attendanceStats.totalDays > 0
      ? Math.round((attendanceStats.presentDays / attendanceStats.totalDays) * 100)
      : 0;

    const attendance = attendanceDocs.map(doc => ({ 
      date: typeof doc.date === 'string' ? doc.date : doc.date.toISOString().split('T')[0], 
      status: doc.status,
      reason: doc.reason || null,
      updatedBy: doc.updatedBy || 'faculty',
      updatedAt: doc.updatedAt
    }));

    // Prefer returning roll number if available
    const studentDoc = await Student.findOne({ userId: studentId });
    const studentIdentifier = studentDoc?.rollNumber || studentId;

    res.status(200).json({
      student_id: studentIdentifier,
        attendance,
      overall_percentage: `${overallPercentage}%`
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @desc    Get comprehensive attendance records for a student (including holidays)
// @route   GET /api/attendance/student/:studentId/comprehensive
// @access  Faculty and above, or student accessing their own data
router.get('/student/:studentId/comprehensive', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only view your own attendance'
      });
    }

    const filter = { studentId: new mongoose.Types.ObjectId(studentId) };
    if (startDate || endDate) {
      filter.localDate = {};
      if (startDate) {
        const startDateStr = getAttendanceDate(startDate);
        filter.localDate.$gte = startDateStr;
      }
      if (endDate) {
        const endDateStr = getAttendanceDate(endDate);
        filter.localDate.$lte = endDateStr;
      }
    }

    const attendanceDocs = await Attendance.find(filter)
      .populate('facultyId', 'name email')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    const studentDoc = await Student.findOne({ userId: studentId });
    if (!studentDoc) {
      return res.status(404).json({ status: 'error', message: 'Student not found' });
    }

    const holidayFilter = { department: studentDoc.department };
    if (startDate || endDate) {
      holidayFilter.holidayDate = {};
      if (startDate) holidayFilter.holidayDate.$gte = startDate;
      if (endDate) holidayFilter.holidayDate.$lte = endDate;
    }

    const holidays = await Holiday.find(holidayFilter)
      .sort({ holidayDate: 1 })
      .limit(100);

    const attendanceRecords = attendanceDocs.map(doc => ({
      date: typeof doc.date === 'string' ? doc.date : doc.date.toISOString().split('T')[0],
      status: doc.status,
      reason: doc.reason || '',
      markedBy: doc.facultyId ? doc.facultyId.name : 'System'
    }));

    const holidayRecords = holidays.map(holiday => ({
      date: typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0],
      status: 'Holiday',
      reason: holiday.reason || 'Holiday',
      markedBy: 'System'
    }));

    const allRecords = [...attendanceRecords, ...holidayRecords];

    const presentCount = attendanceRecords.filter(r => r.status === 'Present').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'Absent').length;
    const totalWorkingDays = presentCount + absentCount;
    const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 0;

    res.status(200).json({
      status: 'success',
      lastUpdated: new Date().toISOString(),
      data: {
        student: {
          id: studentId,
          rollNumber: studentDoc.rollNumber,
          name: studentDoc.name,
          department: studentDoc.department,
          classAssigned: studentDoc.classAssigned
        },
        attendance: {
          records: allRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
          summary: {
            presentDays: presentCount,
            absentDays: absentCount,
            totalWorkingDays: totalWorkingDays,
            attendancePercentage: attendancePercentage,
            holidays: holidayRecords.length
          }
        }
      }
    });
  } catch (error) {
    console.error('Get comprehensive student attendance error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @desc    Get attendance records for a class
// @route   GET /api/attendance/class/:className
// @access  Faculty and above
router.get('/class/:className', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { className } = req.params;
    const { subject, date, page = 1, limit = 50 } = req.query;

    // Check if faculty can access this class
    if (req.user.role === 'faculty' && !req.user.assignedClasses.includes(className)) {
      return res.status(403).json({
        success: false,
        msg: 'You are not assigned to this class'
      });
    }

    // Build filter
    const filter = { class: className };
    if (subject) filter.subject = subject;
    if (date) {
      const attendanceDate = new Date(date);
      filter.date = {
        $gte: new Date(attendanceDate.setHours(0, 0, 0, 0)),
        $lt: new Date(attendanceDate.setHours(23, 59, 59, 999))
      };
    }

    const skip = (page - 1) * limit;

    const attendance = await Attendance.find(filter)
      .populate('studentId', 'name email class')
      .populate('facultyId', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        attendance,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Get department attendance summary
// @route   GET /api/attendance/department/:department
// @access  HOD and above
router.get('/department/:department', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { department } = req.params;
    const { startDate, endDate } = req.query;

    // Check if user can access this department
    if (req.user.role === 'hod' && req.user.department !== department) {
      return res.status(403).json({
        success: false,
        msg: 'You can only access your department data'
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Get department attendance summary
    const summary = await Attendance.aggregate([
      { $match: { department, ...dateFilter } },
      {
        $group: {
          _id: {
            class: '$class',
            subject: '$subject'
          },
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          class: '$_id.class',
          subject: '$_id.subject',
          totalDays: 1,
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          attendancePercentage: {
            $multiply: [
              {
                $divide: [
                  { $add: ['$presentDays', '$lateDays'] },
                  '$totalDays'
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { class: 1, subject: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        department,
        summary,
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || 'All time'
        }
      }
    });
  } catch (error) {
    console.error('Get department attendance error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Edit today's attendance
// @route   PUT /api/attendance/edit
// @access  Faculty and above
router.put('/edit', authenticate, facultyAndAbove, [
  body('classId').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class'),
  body('date').isISO8601().withMessage('Invalid date format'),
  body('absentRollNumbers').isArray().withMessage('absentRollNumbers must be an array')
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

    const currentUser = req.user;
    const { classId, date, absentRollNumbers } = req.body;

    // Get the attendance date in IST timezone
    const requestDateString = getAttendanceDate(date);
    const dateFilter = createISTExactDateFilter(requestDateString);
    
    console.log('✏️ Editing attendance for date:', requestDateString);

    // Authorization: Faculty can only edit attendance for their assigned class
    if (currentUser.role === 'faculty') {
      const hasUserAssignment = Array.isArray(currentUser.assignedClasses) && currentUser.assignedClasses.includes(classId);
      let hasFacultyAssignment = false;
      if (!hasUserAssignment) {
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        hasFacultyAssignment = facultyDoc && facultyDoc.assignedClass === classId;
      }
      if (!hasUserAssignment && !hasFacultyAssignment) {
        return res.status(403).json({ status: 'error', message: 'You are not assigned to this class' });
      }
    }

    // Fetch all students in the class
    const students = await Student.find({ 
      classAssigned: classId, 
      department: currentUser.department, 
      status: 'active' 
    });
    
    if (!students || students.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No students found for this class' });
    }

    // Validate absentee roll numbers
    const absentees = absentRollNumbers.map(r => String(r).trim());
    const rollToStudent = new Map(students.map(s => [s.rollNumber, s]));
    for (const roll of absentees) {
      if (!rollToStudent.has(roll)) {
        return res.status(400).json({ status: 'error', message: `Invalid absentee roll number: ${roll}` });
      }
    }

    // Update attendance records using bulkWrite
    const bulkOps = students.map(s => {
      const isAbsent = absentees.includes(s.rollNumber);
      const updateFields = {
        status: isAbsent ? 'Absent' : 'Present',
        facultyId: currentUser._id,
        localDate: requestDateString, // Update IST date
        updatedBy: 'faculty',
        updatedAt: getCurrentISTTimestamp()
      };
      
      // If changing from Absent to Present, clear the reason
      if (!isAbsent) {
        updateFields.reason = null;
      }
      
      return {
        updateOne: {
          filter: { studentId: s.userId, localDate: requestDateString },
          update: { $set: updateFields },
          upsert: false // Only update existing records
        }
      };
    });

    console.log('📝 Bulk operations to execute:', JSON.stringify(bulkOps, null, 2));
    
    // Execute bulk write with error handling
    let result;
    try {
      result = await Attendance.bulkWrite(bulkOps, { ordered: true });
      console.log('✅ Edit bulk write result:', result);
      
      if (result.modifiedCount === 0) {
        console.log('⚠️ No records were modified!');
        return res.status(400).json({ 
          status: 'error', 
          message: 'No attendance records found to update for the specified date' 
        });
      }
    } catch (bulkError) {
      console.error('❌ Bulk write error:', bulkError);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Failed to update attendance records',
        error: bulkError.message
      });
    }

    // Verify records were updated using localDate
    const verificationRecords = await Attendance.find({
      studentId: { $in: students.map(s => s.userId) },
      localDate: requestDateString
    });
    console.log(`🔍 Verification: Found ${verificationRecords.length} updated attendance records`);
    console.log('🔍 Verification records:', JSON.stringify(verificationRecords, null, 2));
    
    if (verificationRecords.length === 0) {
      console.log('❌ No verification records found!');
      return res.status(500).json({ 
        status: 'error', 
        message: 'Attendance records were not updated properly' 
      });
    }

    // Update ClassAttendance record
    await ClassAttendance.findOneAndUpdate(
      { classId, date: date }, // Use string date for ClassAttendance
      { 
        absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
        markedBy: currentUser._id
      },
      { upsert: true }
    );

    return res.status(200).json({ 
      status: 'success', 
      message: 'Attendance updated successfully',
      data: {
        class: classId,
        date: requestDate.toISOString().split('T')[0],
        totalStudents: students.length,
        recordsUpdated: verificationRecords.length,
        absentStudents: absentees.length
      }
    });
  } catch (error) {
    console.error('Edit attendance error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update attendance' });
  }
});

// @desc    Get attendance history for a class and date
// @route   GET /api/attendance/history
// @access  Faculty and above
router.get('/history', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const classId = req.query.classId;
    const dateString = req.query.date;
    
    if (!classId || !dateString) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'classId and date are required' 
      });
    }

    const currentUser = req.user;

    // Authorization: Faculty can only view attendance for their assigned class
    if (currentUser.role === 'faculty') {
      const hasUserAssignment = Array.isArray(currentUser.assignedClasses) && currentUser.assignedClasses.includes(classId);
      let hasFacultyAssignment = false;
      if (!hasUserAssignment) {
        const facultyDoc = await Faculty.findOne({ userId: currentUser._id });
        hasFacultyAssignment = facultyDoc && facultyDoc.assignedClass === classId;
      }
      if (!hasUserAssignment && !hasFacultyAssignment) {
        return res.status(403).json({ status: 'error', message: 'You are not assigned to this class' });
      }
    }

    // Normalize date to cover the full day
    const queryDate = new Date(dateString);
    queryDate.setHours(0, 0, 0, 0);
    const endDate = new Date(queryDate);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all students in the class
    const studentsInClass = await Student.find({ 
      classAssigned: classId, 
      department: currentUser.department, 
      status: 'active' 
    }).select('rollNumber name userId');

    // Fetch attendance records for the specified date and class
    const attendanceRecords = await Attendance.find({
      studentId: { $in: studentsInClass.map(s => s.userId) },
      date: { $gte: queryDate, $lte: endDate }
    }).select('studentId status');

    // Create a map of attendance status by student ID
    const attendanceMap = new Map(
      attendanceRecords.map(att => [att.studentId.toString(), att.status])
    );

    // Combine student data with attendance status
    const records = studentsInClass.map(student => ({
      rollNo: student.rollNumber,
      name: student.name,
      status: attendanceMap.get(student.userId.toString()) || 'Absent' // Default to Absent if no record
    }));

    const marked = attendanceRecords.length > 0; // Flag if any attendance was marked for this day

    res.status(200).json({
      status: 'success',
      data: {
        classId,
        date: dateString,
        records,
        marked
      }
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// --- New endpoints based on Student Management (batch/year/semester[/section]) ---

// @desc    Mark attendance for a class by batch/year/semester (defaults Present, mark absentees)
// @route   POST /api/attendance/mark-students
// @access  Faculty and above
router.post('/mark-students', authenticate, facultyAndAbove, [
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').exists().withMessage('Year is required'),
  body('semester').exists().withMessage('Semester is required'),
  body('section').optional().isString().trim(),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('absentRollNumbers').optional().isArray().withMessage('absentRollNumbers must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const currentUser = req.user;
    const { batch, section } = req.body;
    const normalizedYear = normalizeYear(req.body.year);
    const normalizedSemester = normalizeSemester(req.body.semester);

    // Authorization: verify faculty is advisor for this class
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(String(req.body.semester), 10) || parseInt(String(normalizedSemester).match(/\d+/)?.[0] || '0', 10),
      ...(section ? { section } : {}),
      department: currentUser.department,
      status: 'active'
    });
    if (!faculty) {
      return res.status(403).json({ status: 'error', message: 'You are not authorized to mark attendance for this class' });
    }

    // Get the selected date in IST and convert to YYYY-MM-DD string format
    let requestDateString;
    if (req.body.date) {
      // If date is provided, ensure it's in IST and convert to string
      const selectedDate = new Date(req.body.date);
      // Convert to IST by adding 5.5 hours to avoid UTC conversion issues
      const istDate = new Date(selectedDate.getTime() + (5.5 * 60 * 60 * 1000));
      requestDateString = istDate.toISOString().split('T')[0];
    } else {
      // Use current IST date
      const now = new Date();
      const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      requestDateString = istDate.toISOString().split('T')[0];
    }

    // Fetch students from Student Management list
    const students = await Student.find({
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      department: currentUser.department,
      status: 'active'
    }).select('rollNumber userId');

    if (!students || students.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No students found for this class' });
    }

    const absentees = Array.isArray(req.body.absentRollNumbers) ? req.body.absentRollNumbers.map(r => String(r).trim()) : [];
    
    const rollToStudent = new Map(students.map(s => [s.rollNumber, s]));
    
    // Validate all provided absent roll numbers exist
    for (const roll of absentees) {
      if (!rollToStudent.has(roll)) {
        return res.status(400).json({ status: 'error', message: `Invalid roll number: ${roll}` });
      }
    }
    
    // Determine present students (all students not in absentees list)
    const presentStudents = students.filter(s => !absentees.includes(s.rollNumber));
    const presentRollNumbers = presentStudents.map(s => s.rollNumber);

    // Upsert attendance records: mark all students (absent and present)
    const classKey = makeClassKey({ batch, year: normalizedYear, semester: normalizedSemester, section });
    const bulkOps = [];
    
    // Add operations for absent students
    for (const roll of absentees) {
      const student = rollToStudent.get(roll);
      bulkOps.push({
        updateOne: {
          filter: { studentId: student.userId, classId: classKey, localDate: requestDateString },
          update: {
            $set: {
              status: 'Absent',
              facultyId: currentUser._id,
              date: requestDateString,
              localDate: requestDateString,
              classId: classKey
            }
          },
          upsert: true
        }
      });
    }
    
    // Add operations for present students (all others)
    for (const roll of presentRollNumbers) {
      const student = rollToStudent.get(roll);
      bulkOps.push({
        updateOne: {
          filter: { studentId: student.userId, classId: classKey, localDate: requestDateString },
          update: {
            $set: {
              status: 'Present',
              facultyId: currentUser._id,
              date: requestDateString,
              localDate: requestDateString,
              classId: classKey
            }
          },
          upsert: true
        }
      });
    }

    await Attendance.bulkWrite(bulkOps, { ordered: true });

    // Push SSE updates to all students
    for (const student of students) {
      const status = absentees.includes(student.rollNumber) ? 'Absent' : 'Present';
      sendAttendanceEvent(String(student.userId), {
        date: requestDateString,
        status
      });
    }

    // Upsert ClassAttendance mark summary
    await ClassAttendance.findOneAndUpdate(
      { classId: classKey, date: requestDateString },
      {
        classId: classKey,
        date: requestDateString,
        absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
        presentRollNumbers: presentRollNumbers.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
        markedBy: currentUser._id
      },
      { upsert: true }
    );

    return res.status(200).json({ 
      status: 'success', 
      message: 'Attendance saved successfully',
      data: {
        marked: {
          present: presentRollNumbers,
          absent: absentees
        },
        totalStudents: students.length,
        presentCount: presentRollNumbers.length,
        absentCount: absentees.length
      }
    });
  } catch (error) {
    console.error('Mark students attendance error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to save attendance' });
  }
});

// @desc    Edit attendance for a class by batch/year/semester
// @route   PUT /api/attendance/edit-students
// @access  Faculty and above
router.put('/edit-students', authenticate, facultyAndAbove, [
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').exists().withMessage('Year is required'),
  body('semester').exists().withMessage('Semester is required'),
  body('section').optional().isString().trim(),
  body('date').isISO8601().withMessage('Invalid date format'),
  body('absentRollNumbers').isArray().withMessage('absentRollNumbers must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const currentUser = req.user;
    const { batch, section } = req.body;
    const normalizedYear = normalizeYear(req.body.year);
    const normalizedSemester = normalizeSemester(req.body.semester);

    // Authorization
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(String(req.body.semester), 10) || parseInt(String(normalizedSemester).match(/\d+/)?.[0] || '0', 10),
      ...(section ? { section } : {}),
      department: currentUser.department,
      status: 'active'
    });
    if (!faculty) {
      return res.status(403).json({ status: 'error', message: 'You are not authorized to edit attendance for this class' });
    }

    const requestDate = new Date(req.body.date);
    requestDate.setHours(0, 0, 0, 0);

    const students = await Student.find({
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      department: currentUser.department,
      status: 'active'
    }).select('rollNumber userId');

    if (!students || students.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No students found for this class' });
    }

    const absentees = req.body.absentRollNumbers.map(r => String(r).trim());
    const rollToStudent = new Map(students.map(s => [s.rollNumber, s]));
    for (const roll of absentees) {
      if (!rollToStudent.has(roll)) {
        return res.status(400).json({ status: 'error', message: `Invalid absentee roll number: ${roll}` });
      }
    }

    const classKey = makeClassKey({ batch, year: normalizedYear, semester: normalizedSemester, section });
    const bulkOps = students.map(s => ({
      updateOne: {
        filter: { studentId: s.userId, classId: classKey, date: requestDate },
        update: { $set: { status: absentees.includes(s.rollNumber) ? 'Absent' : 'Present', facultyId: currentUser._id, classId: classKey } },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(bulkOps, { ordered: true });

    // Push SSE updates
    for (const s of students) {
      const status = absentees.includes(s.rollNumber) ? 'Absent' : 'Present';
      sendAttendanceEvent(String(s.userId), {
        date: requestDate.toISOString().slice(0, 10),
        status
      });
    }

    // Determine present students (all students not in absentees list)
    const presentStudents = students.filter(s => !absentees.includes(s.rollNumber));
    const presentRollNumbers = presentStudents.map(s => s.rollNumber);

    await ClassAttendance.findOneAndUpdate(
      { classId: classKey, date: requestDate },
      { 
        absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)), 
        presentRollNumbers: presentRollNumbers.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
        markedBy: currentUser._id 
      },
      { upsert: true }
    );

    return res.status(200).json({ 
      status: 'success', 
      message: 'Attendance updated successfully',
      data: {
        marked: {
          present: presentRollNumbers,
          absent: absentees
        },
        totalStudents: students.length,
        presentCount: presentRollNumbers.length,
        absentCount: absentees.length
      }
    });
  } catch (error) {
    console.error('Edit students attendance error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update attendance' });
  }
});

// @desc    Attendance history by batch/year/semester and date
// @route   GET /api/attendance/history-by-class?batch=...&year=...&semester=...&date=YYYY-MM-DD[&section=A]
// @access  Faculty and above
router.get('/history-by-class', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section, date } = req.query;
    console.log('🔍 History-by-class request:', { batch, year, semester, section, date });
    
    if (!batch || !year || !semester || !date) {
      return res.status(400).json({ status: 'error', message: 'batch, year, semester and date are required' });
    }

    const currentUser = req.user;
    const normalizedYear = normalizeYear(year);
    const normalizedSemester = normalizeSemester(semester);
    
    console.log('🔍 Normalized values:', { normalizedYear, normalizedSemester });

    // Authorization
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(String(semester), 10) || parseInt(String(normalizedSemester).match(/\d+/)?.[0] || '0', 10),
      ...(section ? { section } : {}),
      department: currentUser.department,
      status: 'active'
    });
    
    console.log('👨‍🏫 Faculty authorization check:', faculty ? '✅ Authorized' : '❌ Not authorized');
    
    if (!faculty) {
      return res.status(403).json({ status: 'error', message: 'You are not authorized to view attendance for this class' });
    }

    const studentsInClass = await Student.find({
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      department: currentUser.department,
      status: 'active'
    }).select('rollNumber name userId');
    
    console.log('👥 Students found:', studentsInClass.length);

    const classKey = makeClassKey({ batch, year: normalizedYear, semester: normalizedSemester, section });
    console.log('🔑 Class key:', classKey);
    
    // Use localDate instead of date for filtering
    const attendanceRecords = await Attendance.find({
      studentId: { $in: studentsInClass.map(s => s.userId) },
      classId: classKey,
      localDate: date
    }).select('studentId status');
    
    console.log('📊 Attendance records found:', attendanceRecords.length);
    attendanceRecords.forEach(r => {
      console.log(`  - StudentId: ${r.studentId}, Status: ${r.status}`);
    });

    const attendanceMap = new Map(attendanceRecords.map(att => [att.studentId.toString(), att.status]));
    const records = studentsInClass.map(student => ({
      rollNo: student.rollNumber,
      name: student.name,
      status: attendanceMap.get(student.userId.toString()) || 'Not Marked'
    }));
    
    console.log('📋 Final records:', records);

    res.status(200).json({ status: 'success', data: { records } });
  } catch (error) {
    console.error('History by class error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to fetch attendance history' });
  }
});

// @desc    Update attendance record (legacy endpoint)
// @route   PUT /api/attendance/:id
// @access  Faculty and above
router.put('/:id', authenticate, facultyAndAbove, [
  body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid attendance status'),
  body('remarks').optional().trim().isLength({ max: 200 }).withMessage('Remarks cannot exceed 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        msg: 'Attendance record not found'
      });
    }

    // Check if user can update this attendance
    if (req.user.role === 'faculty' && attendance.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        msg: 'You can only update attendance you marked'
      });
    }

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
        remarks: req.body.remarks
      },
      { new: true, runValidators: true }
    ).populate('studentId', 'name email class');

    res.status(200).json({
      success: true,
      msg: 'Attendance updated successfully',
      data: updatedAttendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Submit reason for absence (Student)
// @route   PATCH /api/attendance/reason
// @access  Student and above
router.patch('/reason', authenticate, [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('date').isISO8601().withMessage('Invalid date format'),
  body('reason').notEmpty().withMessage('Reason is required')
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

    const { studentId, date, reason } = req.body;
    const currentUser = req.user;

    // Check if user can submit reason for this student
    if (currentUser.role === 'student' && currentUser._id.toString() !== studentId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only submit reasons for your own attendance'
      });
    }

    // Convert date to proper format for querying
    const attendanceDate = new Date(`${date}T00:00:00Z`);

    // Find the attendance record
    const attendanceRecord = await Attendance.findOne({
      studentId,
      date: attendanceDate
    });

    if (!attendanceRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'Attendance record not found'
      });
    }

    // Check if student is marked absent
    if (attendanceRecord.status !== 'Absent') {
      return res.status(400).json({
        status: 'error',
        message: 'Can only submit reasons for absent attendance'
      });
    }

    // Update the reason
    const updatedRecord = await Attendance.findOneAndUpdate(
      { studentId, date: attendanceDate },
      { 
        $set: { 
          reason: reason.trim(),
          updatedBy: 'student',
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({
      status: 'success',
      message: 'Reason submitted successfully',
      data: {
        attendanceId: updatedRecord._id,
        studentId: updatedRecord.studentId,
        date: date,
        status: updatedRecord.status,
        reason: updatedRecord.reason,
        updatedBy: updatedRecord.updatedBy,
        updatedAt: updatedRecord.updatedAt
      }
    });

  } catch (error) {
    console.error('Submit reason error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit reason'
    });
  }
});

// @desc    Update absence reason
// @route   PUT /api/attendance/:id/reason
// @access  Faculty and above
router.put('/:id/reason', authenticate, facultyAndAbove, [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
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

    const { id } = req.params;
    const { reason } = req.body;
    const currentUser = req.user;

    // Find the attendance record
    const attendance = await Attendance.findById(id).populate('studentId', 'department');
    if (!attendance) {
      return res.status(404).json({
        status: 'error',
        message: 'Attendance record not found'
      });
    }

    // Authorization: Faculty can only update reasons for students in their department
    if (currentUser.role === 'faculty') {
      // Check if the student belongs to the faculty's department
      const student = await Student.findOne({ userId: attendance.studentId._id });
      if (!student || student.department !== currentUser.department) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only update reasons for students in your department'
        });
      }
    }

    // Update the reason
    attendance.reason = reason || '';
    await attendance.save();

    res.status(200).json({
      status: 'success',
      message: 'Absence reason updated successfully',
      data: {
        id: attendance._id,
        reason: attendance.reason,
        updatedAt: attendance.updatedAt
      }
    });
  } catch (error) {
    console.error('Update absence reason error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Generate attendance report
// @route   GET /api/attendance/report
// @access  Faculty and above
router.get('/report', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section, startDate, endDate } = req.query;
    const currentUser = req.user;

    console.log('📊 Report request:', { batch, year, semester, section, startDate, endDate, userId: currentUser._id });

    if (!batch || !year || !semester || !section) {
      return res.status(400).json({
        success: false,
        message: 'Batch, year, semester, and section are required'
      });
    }

    // Check if faculty has access to this class
    const classAssignment = await ClassAssignment.findOne({
      facultyId: currentUser._id,
      batch,
      year,
      semester: parseInt(semester),
      section,
      active: true
    });

    if (!classAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to generate reports for this class'
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.date = { ...dateFilter.date, $gte: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.date = { ...dateFilter.date, $lte: new Date(endDate) };
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find({
      batch,
      year,
      semester: parseInt(semester),
      section,
      ...dateFilter
    }).sort({ date: 1 });

    // Calculate statistics
    const totalDays = attendanceRecords.length;
    const totalStudents = attendanceRecords.length > 0 ? attendanceRecords[0].totalStudents : 0;
    const totalPresent = attendanceRecords.reduce((sum, record) => sum + record.presentCount, 0);
    const averageAttendance = totalDays > 0 ? (totalPresent / (totalDays * totalStudents)) * 100 : 0;

    // Prepare report data
    const reportData = {
      classInfo: {
        batch,
        year,
        semester: parseInt(semester),
        section
      },
      summary: {
        totalDays,
        totalStudents,
        totalPresent,
        averageAttendance: Math.round(averageAttendance * 100) / 100
      },
      records: attendanceRecords.map(record => ({
        date: record.date,
        presentCount: record.presentCount,
        absentCount: record.totalStudents - record.presentCount,
        totalStudents: record.totalStudents,
        percentage: Math.round((record.presentCount / record.totalStudents) * 100 * 100) / 100
      }))
    };

    console.log('✅ Report generated:', reportData.summary);

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating report'
    });
  }
});

export default router;
