import express from 'express';
import { body, validationResult } from 'express-validator';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import { authenticate, hodAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All faculty routes require authentication and HOD or above role
router.use(authenticate);
router.use(hodAndAbove);

// @desc    Create new faculty
// @route   POST /api/faculty/create
// @access  HOD and above
router.post('/create', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('position').isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('assignedClass').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', 'None']).withMessage('Invalid assigned class')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, position, assignedClass } = req.body;
    const currentUser = req.user;

    // Check if faculty already exists (by user email across system)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Faculty already exists'
      });
    }

    // Create corresponding user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      department: currentUser.department,
      assignedClasses: assignedClass && assignedClass !== 'None' ? [assignedClass] : [],
      createdBy: currentUser._id
    });
    await user.save();

    // Create faculty details and link to userId
    const faculty = new Faculty({
      userId: user._id,
      name,
      email: email.toLowerCase(),
      position,
      assignedClass,
      department: currentUser.department,
      createdBy: currentUser._id
    });
    await faculty.save();

    const facultyResponse = faculty.toObject();

    res.status(201).json({
      status: 'success',
      message: 'Faculty created successfully',
      data: facultyResponse
    });
  } catch (error) {
    console.error('Create faculty error:', error);
    // Best-effort rollback if user created but faculty failed
    if (error?.keyPattern?.email || error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Faculty already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get all faculties in HOD's department
// @route   GET /api/faculty/list
// @access  HOD and above
router.get('/list', async (req, res) => {
  try {
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    // Build filter object
    const filter = { department: currentUser.department };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const faculties = await Faculty.find(filter)
      .select('-password')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Faculty.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        faculties,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Get faculties error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get faculty by ID
// @route   GET /api/faculty/:id
// @access  HOD and above
router.get('/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'name email');

    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: faculty
    });
  } catch (error) {
    console.error('Get faculty error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Update faculty
// @route   PUT /api/faculty/:id
// @access  HOD and above
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('position').optional().isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('assignedClass').optional().isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', 'None']).withMessage('Invalid assigned class')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    // Update faculty fields
    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const updatedFaculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: 'Faculty updated successfully',
      data: updatedFaculty
    });
  } catch (error) {
    console.error('Update faculty error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Delete faculty
// @route   DELETE /api/faculty/:id
// @access  HOD and above
router.delete('/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    await Faculty.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Faculty deleted successfully'
    });
  } catch (error) {
    console.error('Delete faculty error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

export default router;
