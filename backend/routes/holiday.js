import express from 'express';
import { body, validationResult } from 'express-validator';
import Holiday from '../models/Holiday.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { normalizeDateToString, isValidDateString } from '../utils/dateUtils.js';

const router = express.Router();

// @desc    Get holidays for student's department (Student access)
// @route   GET /api/holidays/student
// @access  Authenticated students
router.get('/student', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Only allow students to access this endpoint
    if (user.role !== 'student') {
      return res.status(403).json({
        status: 'error',
        message: 'Only students can access this endpoint'
      });
    }

    // Get student's department
    const Student = (await import('../models/Student.js')).default;
    const student = await Student.findOne({ userId: user._id });
    
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student profile not found'
      });
    }

    // Get current and future holidays
    const today = new Date().toISOString().split('T')[0];
    const holidays = await Holiday.find({
      department: student.department,
      isDeleted: false,
      holidayDate: { $gte: today }
    })
      .sort({ holidayDate: 1 })
      .limit(50);

    console.log('🎉 Fetching holidays for student:', {
      department: student.department,
      foundHolidays: holidays.length
    });

    res.json({
      status: 'success',
      data: holidays.map(holiday => ({
        id: holiday._id,
        date: typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0],
        reason: holiday.reason,
        createdAt: holiday.createdAt
      }))
    });

  } catch (error) {
    console.error('Get student holidays error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch holidays'
    });
  }
});

// All other holiday routes require authentication and faculty or above role
router.use(authenticate);
router.use(facultyAndAbove);

// @desc    Create a new holiday
// @route   POST /api/holidays
// @access  Faculty and above
router.post('/', [
  body('date').isISO8601().withMessage('Date must be a valid ISO date'),
  body('reason').trim().isLength({ min: 1, max: 255 }).withMessage('Reason is required and must be between 1-255 characters')
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

    const { date, reason } = req.body;
    const currentUser = req.user;

    // Validate and normalize date to YYYY-MM-DD format
    let holidayDateString;
    try {
      holidayDateString = normalizeDateToString(date);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format'
      });
    }

    // Check if holiday already exists for this date and department (ignore deleted holidays)
    const existingHoliday = await Holiday.findOne({
      holidayDate: holidayDateString,
      department: currentUser.department,
      isDeleted: false
    });

    if (existingHoliday) {
      return res.status(400).json({
        status: 'error',
        message: 'Holiday already exists for this date in your department'
      });
    }

    // Create new holiday
    const holiday = new Holiday({
      holidayDate: holidayDateString,
      reason,
      createdBy: currentUser._id,
      department: currentUser.department
    });

    try {
      await holiday.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        return res.status(400).json({
          status: 'error',
          message: 'Holiday already exists for this date in your department'
        });
      }
      throw saveError;
    }

    console.log('🎉 Holiday created:', {
      date: holidayDateString,
      reason,
      department: currentUser.department,
      createdBy: currentUser.name
    });

    res.status(201).json({
      status: 'success',
      message: 'Holiday created successfully',
      data: {
        id: holiday._id,
        date: holiday.holidayDate,
        reason: holiday.reason,
        department: holiday.department,
        createdBy: currentUser.name,
        createdAt: holiday.createdAt
      }
    });

  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create holiday'
    });
  }
});

// @desc    Get all holidays for a department
// @route   GET /api/holidays
// @access  Faculty and above
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, year } = req.query;
    const currentUser = req.user;

    let dateFilter = {};

    if (startDate && endDate) {
      // Convert to YYYY-MM-DD format for string comparison
      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      dateFilter = { $gte: start, $lte: end };
    } else if (year) {
      // Convert year to date range strings
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    } else {
      // Default to current year
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    }

    // Principal and admin can see all holidays across all departments
    // Others can only see holidays for their department
    const departmentFilter = (currentUser.role === 'principal' || currentUser.role === 'admin') 
      ? {} 
      : { department: currentUser.department };

    const holidays = await Holiday.find({
      ...departmentFilter,
      isDeleted: false,
      holidayDate: dateFilter
    })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name')
      .sort({ holidayDate: 1 });

    console.log('📅 Fetching holidays:', {
      department: currentUser.department,
      dateFilter,
      foundHolidays: holidays.length,
      holidays: holidays.map(h => ({
        id: h._id,
        date: h.holidayDate,
        reason: h.reason,
        isDeleted: h.isDeleted,
        deletedAt: h.deletedAt
      }))
    });

    res.json({
      status: 'success',
      data: holidays.map(holiday => ({
        id: holiday._id,
        date: typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0],
        reason: holiday.reason,
        department: holiday.department,
        createdBy: holiday.createdBy?.name || 'Unknown',
        createdByEmail: holiday.createdBy?.email || null,
        updatedBy: holiday.updatedBy?.name || null,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt
      }))
    });

  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch holidays'
    });
  }
});

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Faculty and above
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const holiday = await Holiday.findOne({
      _id: id,
      department: currentUser.department,
      isDeleted: false
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Soft delete by setting isDeleted to true
    holiday.isDeleted = true;
    holiday.deletedAt = new Date();
    await holiday.save();

    console.log('🗑️ Holiday deleted:', {
      id: holiday._id,
      date: holiday.holidayDate,
      reason: holiday.reason,
      isDeleted: holiday.isDeleted,
      deletedAt: holiday.deletedAt,
      deletedBy: currentUser.name
    });

    res.json({
      status: 'success',
      message: 'Holiday deleted successfully'
    });

  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete holiday'
    });
  }
});

// @desc    Update an existing holiday
// @route   PUT /api/holidays/:id
// @access  Faculty and above
router.put('/:id', [
  body('date').isISO8601().withMessage('Date must be a valid ISO date'),
  body('reason').trim().isLength({ min: 1, max: 255 }).withMessage('Reason is required and must be between 1-255 characters')
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
    const { date, reason } = req.body;
    const currentUser = req.user;

    // Find the holiday to update
    const holiday = await Holiday.findOne({
      _id: id,
      department: currentUser.department,
      isDeleted: false
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Validate and normalize date to YYYY-MM-DD format
    const newHolidayDate = new Date(date);
    if (isNaN(newHolidayDate.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format'
      });
    }
    
    // Convert to YYYY-MM-DD string to avoid timezone issues
    const newHolidayDateString = newHolidayDate.toISOString().split('T')[0];

    // Check if the new date conflicts with another holiday (excluding current holiday and deleted holidays)
    const existingHoliday = await Holiday.findOne({
      _id: { $ne: id },
      holidayDate: newHolidayDateString,
      department: currentUser.department,
      isDeleted: false
    });

    if (existingHoliday) {
      return res.status(400).json({
        status: 'error',
        message: 'Holiday already exists on this date'
      });
    }

    // Update the holiday
    const oldDate = holiday.holidayDate;
    holiday.holidayDate = newHolidayDateString;
    holiday.reason = reason;
    holiday.updatedBy = currentUser._id;

    await holiday.save();

    console.log('✏️ Holiday updated:', {
      id: holiday._id,
      oldDate,
      newDate: newHolidayDateString,
      reason,
      department: currentUser.department,
      updatedBy: currentUser.name
    });

    res.json({
      status: 'success',
      message: 'Holiday updated successfully',
      data: {
        id: holiday._id,
        date: holiday.holidayDate,
        reason: holiday.reason,
        department: holiday.department,
        createdBy: holiday.createdBy,
        updatedBy: currentUser.name,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt
      }
    });

  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update holiday'
    });
  }
});

// @desc    Check if a specific date is a holiday
// @route   GET /api/holidays/check/:date
// @access  Faculty and above
router.get('/check/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const currentUser = req.user;

    // Validate date format and convert to YYYY-MM-DD
    const checkDate = new Date(date);
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format'
      });
    }
    
    const checkDateString = checkDate.toISOString().split('T')[0];

    const holiday = await Holiday.findOne({
      holidayDate: checkDateString,
      department: currentUser.department,
      isDeleted: false
    });

    res.json({
      status: 'success',
      data: {
        isHoliday: !!holiday,
        holiday: holiday ? {
          id: holiday._id,
          date: typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0],
          reason: holiday.reason,
          createdBy: holiday.createdBy
        } : null
      }
    });

  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check holiday status'
    });
  }
});

export default router;
