import express from 'express';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove, hodAndAbove, principalAndAbove } from '../middleware/auth.js';
import ClassAttendance from '../models/ClassAttendance.js';

const router = express.Router();

// @desc    Mark daily attendance for a class
// @route   POST /api/attendance/mark
// @access  Faculty and above
router.post('/mark', authenticate, facultyAndAbove, [
  body('classId').optional().isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class'),
  body('class_assigned').optional().isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('absentRollNumbers').optional().isArray().withMessage('absentRollNumbers must be an array'),
  body('absentees').optional().isArray().withMessage('absentees must be an array'),
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
    // Enforce today-only marking (if date provided, it must be today)
    const requestDate = req.body.date ? new Date(req.body.date) : new Date();
    requestDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (requestDate.getTime() !== today.getTime()) {
      return res.status(400).json({ status: 'error', message: "Only today's attendance can be marked" });
    }
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
    const existingClass = await ClassAttendance.findOne({ classId: classAssigned, date: requestDate });
    if (existingClass) {
      return res.status(400).json({ status: 'error', message: 'Attendance already marked. Use Edit Attendance.' });
    }
    const studentIds = students.map(s => s.userId); // Attendance.studentId references User
    const existingCount = await Attendance.countDocuments({
      studentId: { $in: studentIds },
      date: requestDate
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
          date: new Date(requestDate),
          status: absentees.includes(s.rollNumber) ? 'Absent' : 'Present'
        }
      }
    }));

    await Attendance.bulkWrite(bulkOps, { ordered: true });

    const classDoc = await ClassAttendance.create({
      classId: classAssigned,
      date: requestDate,
      absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
      markedBy: currentUser._id
    });

    return res.status(201).json({ status: 'success', message: 'Attendance marked successfully', attendanceId: classDoc._id });
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

    // Build filter
    const filter = { studentId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
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

    const attendance = attendanceDocs.map(doc => ({ date: doc.date.toISOString().slice(0, 10), status: doc.status }));

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

    // Enforce today-only editing
    const requestDate = new Date(date);
    requestDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestDate.getTime() !== today.getTime()) {
      return res.status(403).json({ 
        status: 'error', 
        message: "Only today's attendance can be edited" 
      });
    }

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
    const bulkOps = students.map(s => ({
      updateOne: {
        filter: { studentId: s.userId, date: requestDate },
        update: { 
          $set: { 
            status: absentees.includes(s.rollNumber) ? 'Absent' : 'Present',
            facultyId: currentUser._id
          }
        },
        upsert: false // Only update existing records
      }
    }));

    await Attendance.bulkWrite(bulkOps, { ordered: true });

    // Update ClassAttendance record
    await ClassAttendance.findOneAndUpdate(
      { classId, date: requestDate },
      { 
        absentRollNumbers: absentees.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)),
        markedBy: currentUser._id
      },
      { upsert: true }
    );

    return res.status(200).json({ 
      status: 'success', 
      message: 'Attendance updated successfully' 
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

export default router;
