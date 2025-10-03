import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import { authenticate, adminOnly, hodAndAbove, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// Generate batch ranges for the dropdown (2020-2030 with +4 years)
const generateBatchRanges = () => {
  const startYear = 2020;
  const endYear = 2030;
  const batches = [];
  
  for (let year = startYear; year <= endYear; year++) {
    const batchRange = `${year}-${year + 4}`;
    batches.push(batchRange);
  }
  
  return batches.reverse(); // Show newest first
};

// All admin routes require authentication and admin role (except some shared endpoints)
router.use(authenticate);

// @desc    Get available batch ranges (shared with HOD)
// @route   GET /api/admin/batch-ranges
// @access  Admin and HOD
router.get('/batch-ranges', hodAndAbove, (req, res) => {
  try {
    const batches = generateBatchRanges();
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error generating batch ranges:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to generate batch ranges'
    });
  }
});

// @desc    Check if class advisor position is available (shared with HOD)
// @route   POST /api/admin/check-advisor-availability
// @access  Admin and HOD
router.post('/check-advisor-availability', hodAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, department } = req.body;

    if (!batch || !year || !semester || !department) {
      return res.status(400).json({
        success: false,
        msg: 'Batch, year, semester, and department are required'
      });
    }

    // HOD can only check availability for their own department
    if (req.user.role === 'hod' && req.user.department !== department) {
      return res.status(403).json({
        success: false,
        msg: 'HOD can only check advisor availability for their own department'
      });
    }

    // Validate batch format
    if (!batch.match(/^\d{4}-\d{4}$/)) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid batch format. Expected format: YYYY-YYYY (e.g., 2022-2026)'
      });
    }

    // Check if another faculty is already assigned to this batch/year/semester in this department
    const existingAdvisor = await Faculty.findOne({
      is_class_advisor: true,
      batch,
      year,
      semester,
      department,
      status: 'active'
    });

    let available = true;
    let existingAdvisorInfo = null;

    if (existingAdvisor) {
      available = false;
      existingAdvisorInfo = {
        name: existingAdvisor.name,
        email: existingAdvisor.email
      };
    }

    res.json({
      success: true,
      data: {
        available,
        classId: `${year}-${semester}-${batch}`,
        existingAdvisor: existingAdvisorInfo
      }
    });
  } catch (error) {
    console.error('Error checking advisor availability:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to check advisor availability'
    });
  }
});

// @desc    Get all users with pagination and filtering
// @route   GET /api/admin/users
// @access  Admin only
router.get('/users', adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const department = req.query.department;
    const status = req.query.status;
    const search = req.query.search;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Admin only
router.get('/users/:id', adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Create new user
// @route   POST /api/admin/users
// @access  Admin only
router.post('/users', adminOnly, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['principal', 'hod', 'faculty', 'student']).withMessage('Invalid role'),
  body('department').optional().trim().isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'),
  body('class').optional().trim().isLength({ min: 1 }).withMessage('Class is required for students'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('assignedClasses').optional().isArray().withMessage('Assigned classes must be an array'),
  body('phone').optional().trim().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('address').optional().trim().isLength({ max: 200 }).withMessage('Address cannot exceed 200 characters'),
  // Faculty-specific fields
  body('position').optional().trim().isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('is_class_advisor').optional().isBoolean().withMessage('is_class_advisor must be boolean'),
  body('batch').optional().matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').optional().isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      password,
      role,
      department,
      class: userClass,
      subjects,
      assignedClasses,
      phone,
      address,
      dateOfBirth,
      emergencyContact,
      // Faculty-specific fields
      position,
      is_class_advisor,
      batch,
      year,
      semester
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: 'User with this email already exists'
      });
    }

    // Validate role-specific requirements
    if (['hod', 'faculty', 'student'].includes(role) && !department) {
      return res.status(400).json({
        success: false,
        msg: 'Department is required for this role'
      });
    }

    if (role === 'student' && !userClass) {
      return res.status(400).json({
        success: false,
        msg: 'Class is required for students'
      });
    }

    // Faculty-specific validations
    if (role === 'faculty') {
      if (!position) {
        return res.status(400).json({
          success: false,
          msg: 'Position is required for faculty'
        });
      }

      // Class advisor validations
      if (is_class_advisor) {
        if (!batch || !year || !semester) {
          return res.status(400).json({
            success: false,
            msg: 'Batch, year, and semester are required for class advisors'
          });
        }

        // Validate batch format
        if (!batch.match(/^\d{4}-\d{4}$/)) {
          return res.status(400).json({
            success: false,
            msg: 'Invalid batch format. Expected format: YYYY-YYYY (e.g., 2022-2026)'
          });
        }

        // Check if another faculty is already assigned to this batch/year/semester
        const existingAdvisor = await Faculty.findOne({
          is_class_advisor: true,
          batch,
          year,
          semester,
          status: 'active'
        });

        if (existingAdvisor) {
          return res.status(400).json({
            success: false,
            msg: `Another faculty is already assigned as class advisor for Batch ${batch}, ${year}, Semester ${semester}`
          });
        }
      }
    }

    // Create user
    const userData = {
      name,
      email: email.toLowerCase(),
      password,
      role,
      department,
      class: userClass,
      subjects: subjects || [],
      assignedClasses: assignedClasses || [],
      phone,
      address,
      dateOfBirth,
      emergencyContact,
      createdBy: req.user._id
    };

    const user = new User(userData);
    await user.save();

    let facultyProfile = null;
    let advisorMessage = '';

    // Create faculty profile if role is faculty
    if (role === 'faculty') {
      const facultyData = {
        name,
        userId: user._id,
        email: email.toLowerCase(),
        position,
        assignedClass: 'None', // Default value for existing schema
        department,
        phone: phone || '',
        address: address || '',
        dateOfBirth,
        emergencyContact,
        createdBy: req.user._id,
        is_class_advisor: is_class_advisor || false
      };

      // Add class advisor fields if applicable
      if (is_class_advisor) {
        facultyData.batch = batch;
        facultyData.year = year;
        facultyData.semester = semester;
        advisorMessage = ` and assigned as Class Advisor for Batch ${batch}, ${year}, Semester ${semester}`;
      }

      facultyProfile = new Faculty(facultyData);
      await facultyProfile.save();
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    const responseData = {
      user: userResponse
    };

    if (facultyProfile) {
      responseData.faculty = {
        id: facultyProfile._id,
        position: facultyProfile.position,
        is_class_advisor: facultyProfile.is_class_advisor,
        advisorAssignment: facultyProfile.getAdvisorAssignment()
      };
    }

    res.status(201).json({
      success: true,
      msg: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully${advisorMessage}`,
      data: responseData
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Admin only
router.put('/users/:id', adminOnly, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('role').optional().isIn(['principal', 'hod', 'faculty', 'student']).withMessage('Invalid role'),
  body('department').optional().trim().isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'),
  body('class').optional().trim().isLength({ min: 1 }).withMessage('Class is required for students'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('assignedClasses').optional().isArray().withMessage('Assigned classes must be an array'),
  body('status').optional().isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status'),
  body('phone').optional().trim().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('address').optional().trim().isLength({ max: 200 }).withMessage('Address cannot exceed 200 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    // Prevent updating admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        msg: 'Cannot update admin user'
      });
    }

    // Update user fields
    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      msg: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin only
router.delete('/users/:id', adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        msg: 'Cannot delete admin user'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      msg: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Reset user password
// @route   POST /api/admin/users/:id/reset-password
// @access  Admin only
router.post('/users/:id/reset-password', adminOnly, [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      msg: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Admin only
router.get('/dashboard', adminOnly, async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalFaculty,
      totalHODs,
      totalPrincipals,
      activeUsers,
      inactiveUsers,
      departments
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'hod' }),
      User.countDocuments({ role: 'principal' }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'inactive' }),
      User.distinct('department')
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalStudents,
        totalFaculty,
        totalHODs,
        totalPrincipals,
        activeUsers,
        inactiveUsers,
        totalDepartments: departments.length,
        departments
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

export default router;
