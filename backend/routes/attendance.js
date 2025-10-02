import express from 'express';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import { authenticate, facultyAndAbove, hodAndAbove, principalAndAbove } from '../middleware/auth.js';

const router = express.Router();

// @desc    Mark attendance for students
// @route   POST /api/attendance/mark
// @access  Faculty and above
router.post('/mark', authenticate, facultyAndAbove, [
  body('studentId').isMongoId().withMessage('Valid student ID required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('class').trim().isLength({ min: 1 }).withMessage('Class is required'),
  body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid attendance status'),
  body('remarks').optional().trim().isLength({ max: 200 }).withMessage('Remarks cannot exceed 200 characters'),
  body('date').optional().isISO8601().withMessage('Invalid date format')
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

    const {
      studentId,
      subject,
      class: className,
      status,
      remarks,
      date
    } = req.body;

    // Verify student exists and get their department
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        msg: 'Student not found'
      });
    }

    // Check if faculty can mark attendance for this student
    if (req.user.role === 'faculty') {
      // Faculty can only mark attendance for students in their assigned classes
      if (!req.user.assignedClasses.includes(className)) {
        return res.status(403).json({
          success: false,
          msg: 'You are not assigned to this class'
        });
      }
    }

    // Check if attendance already marked for this student, subject, and date
    const attendanceDate = date ? new Date(date) : new Date();
    const existingAttendance = await Attendance.findOne({
      studentId,
      subject,
      date: {
        $gte: new Date(attendanceDate.setHours(0, 0, 0, 0)),
        $lt: new Date(attendanceDate.setHours(23, 59, 59, 999))
      }
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        msg: 'Attendance already marked for this student today'
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      studentId,
      facultyId: req.user._id,
      subject,
      class: className,
      status,
      remarks,
      department: student.department,
      markedBy: req.user._id,
      academicYear: new Date().getFullYear().toString(),
      date: attendanceDate
    });

    await attendance.save();

    res.status(201).json({
      success: true,
      msg: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Get attendance records for a student
// @route   GET /api/attendance/student/:studentId
// @access  Faculty and above, or student accessing their own data
router.get('/student/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject, class: className, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Check if user can access this student's data
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        msg: 'You can only view your own attendance'
      });
    }

    // Build filter
    const filter = { studentId };
    if (subject) filter.subject = subject;
    if (className) filter.class = className;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const attendance = await Attendance.find(filter)
      .populate('facultyId', 'name email')
      .populate('markedBy', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(filter);

    // Calculate attendance statistics
    const stats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
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
      }
    ]);

    const attendanceStats = stats[0] || {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0
    };

    const attendancePercentage = attendanceStats.totalDays > 0 
      ? ((attendanceStats.presentDays + attendanceStats.lateDays) / attendanceStats.totalDays * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        attendance,
        stats: {
          ...attendanceStats,
          attendancePercentage: parseFloat(attendancePercentage)
        },
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
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

// @desc    Update attendance record
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

export default router;
