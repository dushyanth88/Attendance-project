import express from 'express';
import { body, validationResult } from 'express-validator';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All student routes require authentication and faculty or above role
router.use(authenticate);
router.use(facultyAndAbove);

// @desc    Create new student
// @route   POST /api/student/create
// @access  Faculty and above
router.post('/create', [
  body('rollNumber').trim().isLength({ min: 1, max: 20 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('classAssigned').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class assignment')
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

    const { rollNumber, name, email, password, classAssigned } = req.body;
    const currentUser = req.user;

    // Check if student already exists
    const existingStudent = await Student.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { rollNumber: rollNumber }
      ]
    });
    
    if (existingStudent) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }

    // Find faculty assigned to this class
    const assignedFaculty = await Faculty.findOne({ 
      assignedClass: classAssigned,
      department: currentUser.department,
      status: 'active'
    });

    if (!assignedFaculty) {
      return res.status(400).json({
        status: 'error',
        message: 'No faculty assigned to this class'
      });
    }

    // Create student
    const studentData = {
      rollNumber,
      name,
      email: email.toLowerCase(),
      password,
      classAssigned,
      facultyId: assignedFaculty._id,
      department: currentUser.department,
      createdBy: currentUser._id
    };

    const student = new Student(studentData);
    await student.save();

    // Remove password from response
    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.status(201).json({
      status: 'success',
      message: 'Student added successfully',
      data: studentResponse
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get students by class
// @route   GET /api/student/list/:classAssigned
// @access  Faculty and above
router.get('/list/:classAssigned', async (req, res) => {
  try {
    const { classAssigned } = req.params;
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    // Build filter object
    const filter = { 
      classAssigned,
      department: currentUser.department
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const students = await Student.find(filter)
      .select('-password')
      .populate('facultyId', 'name position')
      .populate('createdBy', 'name email')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Student.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        students,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get student by ID
// @route   GET /api/student/:id
// @access  Faculty and above
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .select('-password')
      .populate('facultyId', 'name position')
      .populate('createdBy', 'name email');

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: student
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Update student
// @route   PUT /api/student/update/:id
// @access  Faculty and above
router.put('/update/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Update student fields
    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Delete student
// @route   DELETE /api/student/delete/:id
// @access  Faculty and above
router.delete('/delete/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    await Student.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

export default router;
