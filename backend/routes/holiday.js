import express from 'express';
import { body, validationResult } from 'express-validator';
import Holiday from '../models/Holiday.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All holiday routes require authentication and faculty or above role
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

    // Normalize date to remove time component
    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    // Check if holiday already exists for this date and department
    const existingHoliday = await Holiday.findOne({
      holidayDate,
      department: currentUser.department,
      isActive: true
    });

    if (existingHoliday) {
      return res.status(400).json({
        status: 'error',
        message: 'Holiday already exists for this date in your department'
      });
    }

    // Create new holiday
    const holiday = new Holiday({
      holidayDate,
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
      date: holidayDate.toISOString().split('T')[0],
      reason,
      department: currentUser.department,
      createdBy: currentUser.name
    });

    res.status(201).json({
      status: 'success',
      message: 'Holiday created successfully',
      data: {
        id: holiday._id,
        date: holiday.holidayDate.toISOString().split('T')[0],
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
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else if (year) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    } else {
      // Default to current year
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    }

    const holidays = await Holiday.find({
      department: currentUser.department,
      isActive: true,
      holidayDate: dateFilter
    })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ holidayDate: 1 });

    res.json({
      status: 'success',
      data: holidays.map(holiday => ({
        id: holiday._id,
        date: holiday.holidayDate.toISOString().split('T')[0],
        reason: holiday.reason,
        createdBy: holiday.createdBy.name,
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
      isActive: true
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Soft delete by setting isActive to false
    holiday.isActive = false;
    await holiday.save();

    console.log('🗑️ Holiday deleted:', {
      date: holiday.holidayDate.toISOString().split('T')[0],
      reason: holiday.reason,
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
      isActive: true
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Normalize date to remove time component
    const newHolidayDate = new Date(date);
    newHolidayDate.setHours(0, 0, 0, 0);

    // Check if the new date conflicts with another holiday (excluding current holiday)
    const existingHoliday = await Holiday.findOne({
      _id: { $ne: id },
      holidayDate: newHolidayDate,
      department: currentUser.department,
      isActive: true
    });

    if (existingHoliday) {
      return res.status(400).json({
        status: 'error',
        message: 'Holiday already exists on this date'
      });
    }

    // Update the holiday
    const oldDate = holiday.holidayDate.toISOString().split('T')[0];
    holiday.holidayDate = newHolidayDate;
    holiday.reason = reason;
    holiday.updatedBy = currentUser._id;

    await holiday.save();

    console.log('✏️ Holiday updated:', {
      id: holiday._id,
      oldDate,
      newDate: newHolidayDate.toISOString().split('T')[0],
      reason,
      department: currentUser.department,
      updatedBy: currentUser.name
    });

    res.json({
      status: 'success',
      message: 'Holiday updated successfully',
      data: {
        id: holiday._id,
        date: holiday.holidayDate.toISOString().split('T')[0],
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

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const holiday = await Holiday.findOne({
      holidayDate: checkDate,
      department: currentUser.department,
      isActive: true
    });

    res.json({
      status: 'success',
      data: {
        isHoliday: !!holiday,
        holiday: holiday ? {
          id: holiday._id,
          date: holiday.holidayDate.toISOString().split('T')[0],
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
