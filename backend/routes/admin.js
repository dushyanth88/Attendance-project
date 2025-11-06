import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import Student from '../models/Student.js';
import { authenticate, adminOnly, hodAndAbove, facultyAndAbove, principalAndAbove } from '../middleware/auth.js';

const router = express.Router();

// Generate batch ranges for the dropdown (2022-2030 with +4 years)
const generateBatchRanges = () => {
  const startYear = 2022;
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

// @desc    Get department statistics
// @route   GET /api/admin/department-stats
// @access  HOD and above
router.get('/department-stats', hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    const department = currentUser.department;

    console.log('📊 Fetching department statistics for:', department);
    console.log('📊 Current user:', {
      id: currentUser._id,
      name: currentUser.name,
      role: currentUser.role,
      department: currentUser.department
    });

    // First, let's check what students exist in the database
    const allStudents = await Student.find({}).limit(5);
    console.log('📊 Sample students in database:', allStudents.map(s => ({
      id: s._id,
      name: s.name,
      department: s.department,
      status: s.status
    })));

    // Get total number of students in the department (without status filter first)
    const totalStudentsNoFilter = await Student.countDocuments({
      department: department
    });

    // Get total number of students in the department (with status filter)
    const totalStudents = await Student.countDocuments({
      department: department,
      status: 'active'
    });

    // Also try without status filter if no results
    const totalStudentsFinal = totalStudents > 0 ? totalStudents : totalStudentsNoFilter;

    console.log('📊 Student counts:', {
      department,
      totalStudentsNoFilter,
      totalStudents,
      totalStudentsFinal
    });

    // Check what faculty exist in the database
    const allFaculty = await Faculty.find({}).limit(5);
    console.log('📊 Sample faculty in database:', allFaculty.map(f => ({
      id: f._id,
      name: f.name,
      department: f.department,
      status: f.status
    })));

    // Get total number of faculty members in the department (without status filter first)
    const totalFacultyNoFilter = await Faculty.countDocuments({
      department: department
    });

    // Get total number of faculty members in the department (with status filter)
    const totalFaculty = await Faculty.countDocuments({
      department: department,
      status: 'active'
    });

    // Get faculty count from User model as well (for users with faculty role)
    const facultyUsersNoFilter = await User.countDocuments({
      role: 'faculty',
      department: department
    });

    const facultyUsers = await User.countDocuments({
      role: 'faculty',
      department: department,
      status: 'active'
    });

    // Use unfiltered counts if filtered counts are 0
    const totalFacultyFinal = totalFaculty > 0 ? totalFaculty : totalFacultyNoFilter;
    const facultyUsersFinal = facultyUsers > 0 ? facultyUsers : facultyUsersNoFilter;

    console.log('📊 Faculty counts:', {
      department,
      totalFacultyNoFilter,
      totalFaculty,
      totalFacultyFinal,
      facultyUsersNoFilter,
      facultyUsers,
      facultyUsersFinal
    });

    // Use the higher count between Faculty model and User model
    const actualFacultyCount = Math.max(totalFacultyFinal, facultyUsersFinal);

    console.log('📊 Final department statistics:', {
      department,
      totalStudentsFinal,
      totalFacultyFinal,
      facultyUsersFinal,
      actualFacultyCount
    });

    res.json({
      success: true,
      data: {
        department: department,
        totalStudents: totalStudentsFinal,
        totalFaculty: actualFacultyCount,
        debug: {
          totalStudentsNoFilter,
          totalFacultyNoFilter,
          facultyUsersNoFilter,
          totalStudents,
          totalFaculty,
          facultyUsers
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching department statistics:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to fetch department statistics'
    });
  }
});

// @desc    Get daily department attendance percentage
// @route   GET /api/admin/daily-attendance
// @access  HOD and above
router.get('/daily-attendance', hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    const department = currentUser.department;

    console.log('📊 Fetching daily attendance for department:', department);

    // Import Attendance model
    const Attendance = (await import('../models/Attendance.js')).default;

    // Get all students in the department (matching the logic from department-stats)
    // Try active students first
    let studentsToUse = await Student.find({ 
      department: department,
      status: 'active'
    }).populate('userId', '_id');
    
    console.log('📊 Active students in department:', studentsToUse.length);
    
    // If no active students, fallback to all students in department
    if (studentsToUse.length === 0) {
      console.log('📊 No active students found, using all students in department');
      studentsToUse = await Student.find({ 
        department: department
      }).populate('userId', '_id');
      
      console.log('📊 All students in department (no status filter):', studentsToUse.length);
      
      if (studentsToUse.length === 0) {
        return res.json({
          success: true,
          data: {
            department: department,
            attendancePercentage: 0,
            totalStudents: 0,
            presentStudents: 0,
            absentStudents: 0,
            notMarkedStudents: 0,
            date: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString(),
            debug: 'No students found in department'
          }
        });
      }
    }
    
    console.log('📊 Total students for attendance calculation:', studentsToUse.length);
    
    // Filter out students without valid userId
    const validStudents = studentsToUse.filter(student => student.userId && student.userId._id);
    console.log('📊 Valid students (with userId):', validStudents.length);

    // Get today's attendance records for department students
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendanceRecords = await Attendance.find({
      studentId: { $in: validStudents.map(student => student.userId._id) },
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    console.log('📊 Today\'s attendance records found:', todayAttendanceRecords.length);
    console.log('📊 Sample attendance records:', todayAttendanceRecords.slice(0, 3).map(r => ({
      studentId: r.studentId,
      status: r.status,
      date: r.date
    })));

    // Calculate today's attendance statistics
    // OD students are considered present for attendance percentage
    const presentCount = todayAttendanceRecords.filter(r => r.status === 'Present' || r.status === 'OD').length;
    const odCount = todayAttendanceRecords.filter(r => r.status === 'OD').length;
    const absentCount = todayAttendanceRecords.filter(r => r.status === 'Absent').length;
    const notMarkedCount = validStudents.length - (presentCount + absentCount);

    console.log('📊 Attendance breakdown:', {
      presentCount: presentCount - odCount, // Actual present (excluding OD)
      odCount,
      absentCount,
      notMarkedCount,
      totalStudents: validStudents.length,
      effectivePresent: presentCount // Includes OD
    });
    
    // Calculate attendance percentage based on total valid students
    // OD students are counted as present for percentage calculation
    const attendancePercentage = validStudents.length > 0 
      ? Math.round((presentCount / validStudents.length) * 100) 
      : 0;

    console.log('📊 Daily attendance calculation:', {
      department,
      totalStudents: validStudents.length,
      presentStudents: presentCount,
      absentStudents: absentCount,
      notMarkedStudents: notMarkedCount,
      attendancePercentage: attendancePercentage
    });

    res.json({
      success: true,
      data: {
        department: department,
        attendancePercentage: attendancePercentage,
        totalStudents: validStudents.length,
        presentStudents: presentCount - odCount, // Actual present (excluding OD)
        odStudents: odCount,
        absentStudents: absentCount,
        notMarkedStudents: notMarkedCount,
        date: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching daily attendance:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to fetch daily attendance'
    });
  }
});

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

// @desc    Get total HOD count (active by default)
// @route   GET /api/admin/hod-count
// @access  Principal and above
router.get('/hod-count', principalAndAbove, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = { role: 'hod' };
    if (!includeInactive) {
      filter.status = 'active';
    }

    const totalHODs = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: { totalHODs, filter }
    });
  } catch (error) {
    console.error('HOD count error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get student counts grouped by department
// @route   GET /api/admin/student-counts-by-department
// @access  Principal and above
router.get('/student-counts-by-department', principalAndAbove, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const matchStage = includeInactive ? {} : { status: 'active' };

    const pipeline = [
      { $match: matchStage },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];

    const results = await Student.aggregate(pipeline);
    const formatted = results.map(r => ({ department: r._id || 'Unknown', count: r.count }));

    res.status(200).json({ success: true, data: { departments: formatted, total: formatted.reduce((a,b)=>a+b.count,0) } });
  } catch (error) {
    console.error('Student counts by department error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get faculty counts by department
// @route   GET /api/admin/faculty-counts-by-department
// @access  Principal and above
router.get('/faculty-counts-by-department', principalAndAbove, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const matchStage = includeInactive ? {} : { status: 'active' };

    // Aggregate from Faculty model
    const facultyPipeline = [
      { $match: matchStage },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];

    const facultyResults = await Faculty.aggregate(facultyPipeline);
    
    // Also get from User model with role='faculty' for completeness
    const userPipeline = [
      { $match: { role: 'faculty', ...matchStage } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];

    const userResults = await User.aggregate(userPipeline);

    // Merge results, taking the maximum count from either source for each department
    const departmentMap = new Map();
    
    facultyResults.forEach(r => {
      const dept = r._id || 'Unknown';
      departmentMap.set(dept, Math.max(departmentMap.get(dept) || 0, r.count));
    });
    
    userResults.forEach(r => {
      const dept = r._id || 'Unknown';
      departmentMap.set(dept, Math.max(departmentMap.get(dept) || 0, r.count));
    });

    const formatted = Array.from(departmentMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => a.department.localeCompare(b.department));

    const total = formatted.reduce((a, b) => a + b.count, 0);

    res.status(200).json({ 
      success: true, 
      data: { 
        departments: formatted, 
        total 
      } 
    });
  } catch (error) {
    console.error('Faculty counts by department error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get faculties grouped by department
// @route   GET /api/admin/faculties-by-department
// @access  Principal and above
router.get('/faculties-by-department', principalAndAbove, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const matchStage = includeInactive ? {} : { status: 'active' };

    // Get all faculties from Faculty model with populated userId to get department if needed
    const faculties = await Faculty.find(matchStage)
      .select('-password')
      .populate('userId', 'department name email')
      .sort({ department: 1, name: 1 })
      .lean();

    // Also get from User model with role='faculty'
    const facultyUsers = await User.find({ role: 'faculty', ...matchStage })
      .select('-password')
      .sort({ department: 1, name: 1 })
      .lean();

    // Combine and deduplicate (prefer Faculty model data if exists)
    const facultyMap = new Map();
    
    // Add faculties from Faculty model
    faculties.forEach(faculty => {
      // Get department from faculty record or populated userId
      const department = faculty.department || faculty.userId?.department;
      
      if (!department) {
        console.warn(`Faculty ${faculty.email || faculty._id} has no department, skipping`);
        return;
      }

      const key = faculty.email || faculty.userId?._id?.toString() || faculty._id.toString();
      if (key) {
        facultyMap.set(key.toLowerCase(), {
          id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          department: department,
          position: faculty.position || 'Faculty',
          phone: faculty.phone || faculty.mobile,
          status: faculty.status
        });
      }
    });

    // Add faculty users, only if not already in map
    facultyUsers.forEach(user => {
      if (!user.department) {
        console.warn(`Faculty user ${user.email || user._id} has no department, skipping`);
        return;
      }

      const key = user.email || user._id.toString();
      const normalizedKey = key.toLowerCase();
      
      if (!facultyMap.has(normalizedKey)) {
        facultyMap.set(normalizedKey, {
          id: user._id,
          name: user.name,
          email: user.email,
          department: user.department,
          position: user.position || 'Faculty',
          phone: user.phone || user.mobile,
          status: user.status
        });
      } else {
        // Update existing entry if department is missing
        const existing = facultyMap.get(normalizedKey);
        if (!existing.department && user.department) {
          existing.department = user.department;
        }
      }
    });

    // Group by department
    const groupedByDepartment = {};
    facultyMap.forEach(faculty => {
      const dept = faculty.department || 'Unknown';
      if (!groupedByDepartment[dept]) {
        groupedByDepartment[dept] = [];
      }
      groupedByDepartment[dept].push(faculty);
    });

    // Sort faculties within each department by name
    Object.keys(groupedByDepartment).forEach(dept => {
      groupedByDepartment[dept].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Convert to array format sorted by department name
    const departments = Object.keys(groupedByDepartment)
      .sort()
      .map(department => ({
        department,
        faculties: groupedByDepartment[department],
        count: groupedByDepartment[department].length
      }));

    const total = Array.from(facultyMap.values()).length;

    res.status(200).json({
      success: true,
      data: {
        departments,
        total
      }
    });
  } catch (error) {
    console.error('Faculties by department error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get students grouped by department
// @route   GET /api/admin/students-by-department
// @access  Principal and above
router.get('/students-by-department', principalAndAbove, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const matchStage = includeInactive ? {} : { status: 'active' };

    // Get all students from Student model
    const students = await Student.find(matchStage)
      .select('-password')
      .populate('userId', 'name email department')
      .sort({ department: 1, batch: 1, year: 1, rollNumber: 1 })
      .lean();

    // Import ClassAssignment model
    const ClassAssignment = (await import('../models/ClassAssignment.js')).default;

    // Build a map of class assignments for efficient lookup
    // Create unique class keys from students: batch_year_semester_section
    const classKeys = new Set();
    students.forEach(student => {
      if (student.batch && student.year && student.semester && student.section) {
        let semesterNumber = student.semester;
        if (typeof semesterNumber === 'string' && semesterNumber.startsWith('Sem ')) {
          semesterNumber = parseInt(semesterNumber.replace('Sem ', ''));
        } else if (typeof semesterNumber === 'string') {
          semesterNumber = parseInt(semesterNumber);
        }
        if (!isNaN(semesterNumber)) {
          const classKey = `${student.batch}_${student.year}_${semesterNumber}_${student.section}`;
          classKeys.add(classKey);
        }
      }
    });

    // Fetch all active class assignments for these classes
    const classAssignmentsArray = Array.from(classKeys).map(key => {
      const [batch, year, semester, section] = key.split('_');
      return { batch, year, semester: parseInt(semester), section };
    });

    const classAssignments = await ClassAssignment.find({
      $or: classAssignmentsArray,
      active: true
    })
      .populate('facultyId', 'name email position')
      .lean();

    // Create a map: classKey -> classAssignment
    const assignmentMap = new Map();
    classAssignments.forEach(assignment => {
      const classKey = `${assignment.batch}_${assignment.year}_${assignment.semester}_${assignment.section}`;
      assignmentMap.set(classKey, assignment);
    });

    // Get all unique faculty user IDs to fetch their Faculty records
    const facultyUserIds = [...new Set(classAssignments
      .filter(ca => ca.facultyId?._id)
      .map(ca => ca.facultyId._id.toString())
    )];

    const facultyRecords = await Faculty.find({
      userId: { $in: facultyUserIds }
    })
      .select('name position email department userId')
      .lean();

    // Create a map: userId -> Faculty record
    const facultyMap = new Map();
    facultyRecords.forEach(faculty => {
      const userId = faculty.userId?.toString();
      if (userId) {
        facultyMap.set(userId, faculty);
      }
    });

    // Fetch today's attendance records for all students
    const Attendance = (await import('../models/Attendance.js')).default;
    // Use IST date string for reliable matching (YYYY-MM-DD format)
    const todayIST = new Date();
    const todayISTString = todayIST.toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    const studentUserIds = students.map(s => s.userId?._id || s.userId).filter(id => id);
    const todayAttendanceRecords = await Attendance.find({
      studentId: { $in: studentUserIds },
      localDate: todayISTString // Use localDate for exact date matching
    }).lean();

    // Create a map: studentId (userId) -> attendance status
    const attendanceMap = new Map();
    todayAttendanceRecords.forEach(record => {
      const studentId = record.studentId?.toString();
      if (studentId) {
        attendanceMap.set(studentId, record.status || 'Not Marked');
      }
    });

    // Group by department and format students with class teacher info
    const groupedByDepartment = {};
    
    students.forEach(student => {
      // Get department from student record or populated userId
      const department = student.department || student.userId?.department || 'Unknown';
      
      if (!groupedByDepartment[department]) {
        groupedByDepartment[department] = [];
      }

      // Get the current class advisor for this student's class
      let classTeacher = null;
      
      if (student.batch && student.year && student.semester && student.section) {
        // Normalize semester - handle both "Sem X" format and numeric
        let semesterNumber = student.semester;
        if (typeof semesterNumber === 'string' && semesterNumber.startsWith('Sem ')) {
          semesterNumber = parseInt(semesterNumber.replace('Sem ', ''));
        } else if (typeof semesterNumber === 'string') {
          semesterNumber = parseInt(semesterNumber);
        }

        if (!isNaN(semesterNumber)) {
          const classKey = `${student.batch}_${student.year}_${semesterNumber}_${student.section}`;
          const classAssignment = assignmentMap.get(classKey);

          if (classAssignment && classAssignment.facultyId) {
            const facultyUserId = classAssignment.facultyId._id?.toString();
            const advisorFaculty = facultyUserId ? facultyMap.get(facultyUserId) : null;

            if (advisorFaculty) {
              classTeacher = {
                id: advisorFaculty._id,
                name: advisorFaculty.name,
                position: advisorFaculty.position || 'Faculty',
                email: advisorFaculty.email || classAssignment.facultyId.email
              };
            } else if (classAssignment.facultyId) {
              // Fallback to User info if Faculty record not found
              classTeacher = {
                name: classAssignment.facultyId.name || 'Unknown',
                position: classAssignment.facultyId.position || 'Faculty',
                email: classAssignment.facultyId.email
              };
            }
          }
        }
      }

      // Get today's attendance status for this student
      const studentUserId = student.userId?._id?.toString() || student.userId?.toString();
      const todayAttendanceStatus = attendanceMap.get(studentUserId) || 'Not Marked';

      groupedByDepartment[department].push({
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email || student.userId?.email,
        batch: student.batch,
        year: student.year,
        semester: student.semester,
        section: student.section,
        department: department,
        mobile: student.mobile || student.phone,
        parentContact: student.parentContact,
        classTeacher: classTeacher,
        status: student.status,
        todayAttendanceStatus: todayAttendanceStatus
      });
    });

    // Sort students within each department by batch, year, then roll number
    Object.keys(groupedByDepartment).forEach(dept => {
      groupedByDepartment[dept].sort((a, b) => {
        // First by batch
        if (a.batch !== b.batch) {
          return (a.batch || '').localeCompare(b.batch || '');
        }
        // Then by year
        if (a.year !== b.year) {
          return (a.year || '').localeCompare(b.year || '');
        }
        // Finally by roll number
        return (a.rollNumber || '').localeCompare(b.rollNumber || '');
      });
    });

    // Convert to array format sorted by department name
    const departments = Object.keys(groupedByDepartment)
      .sort()
      .map(department => ({
        department,
        students: groupedByDepartment[department],
        count: groupedByDepartment[department].length
      }));

    const total = students.length;

    res.status(200).json({
      success: true,
      data: {
        departments,
        total
      }
    });
  } catch (error) {
    console.error('Students by department error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    List HOD users
// @route   GET /api/admin/hods
// @access  Principal and above
router.get('/hods', principalAndAbove, async (req, res) => {
  try {
    const { department, includeInactive } = req.query;
    const filter = { role: 'hod' };
    if (department) filter.department = department;
    if (includeInactive !== 'true') filter.status = 'active';

    const hods = await User.find(filter).select('-password').sort({ createdAt: -1 });
    const total = await User.countDocuments(filter);

    res.status(200).json({ success: true, data: { hods, total } });
  } catch (error) {
    console.error('List HODs error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Create a HOD user
// @route   POST /api/admin/hods
// @access  Principal and above
router.post('/hods', principalAndAbove, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().isLength({ min: 2 }).withMessage('Department is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, msg: 'Validation failed', errors: errors.array() });
    }

    const { name, email, password, department } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, msg: 'User with this email already exists' });
    }

    // Check if a HOD already exists for this department
    const existingHod = await User.findOne({ role: 'hod', department });
    if (existingHod) {
      return res.status(400).json({ success: false, msg: 'A HOD already exists for this department' });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'hod',
      department,
      status: 'active',
      createdBy: req.user._id
    });

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ success: true, msg: 'HOD created successfully', data: userObj });
  } catch (error) {
    console.error('Create HOD error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Remove a HOD user
// @route   DELETE /api/admin/hods/:id
// @access  Principal and above
router.delete('/hods/:id', principalAndAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found' });
    }
    if (user.role !== 'hod') {
      return res.status(400).json({ success: false, msg: 'User is not a HOD' });
    }

    await User.findByIdAndDelete(user._id);
    res.status(200).json({ success: true, msg: 'HOD removed successfully' });
  } catch (error) {
    console.error('Remove HOD error:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get overall (all departments/classes) daily attendance stats
// @route   GET /api/admin/overall-daily-attendance
// @access  Principal and above
router.get('/overall-daily-attendance', principalAndAbove, async (req, res) => {
  try {
    const Student = (await import('../models/Student.js')).default;
    const Attendance = (await import('../models/Attendance.js')).default;
    const today = new Date().toISOString().split('T')[0];
    // Get all active students
    const students = await Student.find({ status: 'active' });
    const userIds = students.map(s => s.userId.toString()); // MATCH ON userId not _id
    // Get today's attendance for all students, match studentId -> User _id
    const attendanceRecords = await Attendance.find({ date: today, studentId: { $in: userIds } });
    // OD students are counted as Present for percentage calculation
    const odStudents = attendanceRecords.filter(r => r.status === 'OD').length;
    const presentStudents = attendanceRecords.filter(r => r.status === 'Present').length;
    const presentStudentsWithOD = presentStudents + odStudents; // Total present including OD
    const absentStudents = attendanceRecords.filter(r => r.status === 'Absent').length;
    const totalStudents = students.length;
    const notMarkedStudents = totalStudents - (presentStudentsWithOD + absentStudents);
    // OD is counted as Present for percentage calculation
    const attendancePercentage = totalStudents > 0 ? Math.round((presentStudentsWithOD / totalStudents) * 100) : 0;
    res.json({
      success: true,
      data: {
        totalStudents,
        presentStudents, // Actual present (excluding OD)
        odStudents,
        absentStudents,
        notMarkedStudents,
        attendancePercentage,
        date: today,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching overall daily attendance:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get attendance percentage by department
// @route   GET /api/admin/attendance-by-department
// @access  Principal and above
router.get('/attendance-by-department', principalAndAbove, async (req, res) => {
  try {
    const Student = (await import('../models/Student.js')).default;
    const Attendance = (await import('../models/Attendance.js')).default;
    const { getCurrentISTDate } = await import('../utils/istTimezone.js');
    const todayISTString = getCurrentISTDate(); // Get today's date in IST timezone

    // Get all departments
    const departments = await Student.distinct('department');
    
    // Get all active students grouped by department
    const studentsByDept = await Student.find({ status: 'active' })
      .select('department userId')
      .lean();

    // Get today's attendance records using localDate for exact date matching
    const userIds = studentsByDept.map(s => s.userId?.toString()).filter(Boolean);
    const attendanceRecords = await Attendance.find({ 
      localDate: todayISTString, // Use localDate for exact date matching
      studentId: { $in: userIds } 
    }).lean();

    // Create a map of studentId to attendance status
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      attendanceMap.set(record.studentId?.toString(), record.status);
    });

    // Calculate stats for each department
    const departmentStats = [];
    
    for (const dept of departments) {
      if (!dept) continue;

      const deptStudents = studentsByDept.filter(s => s.department === dept);
      const deptStudentIds = deptStudents.map(s => s.userId?.toString()).filter(Boolean);
      
      let presentCount = 0;
      let odCount = 0;
      let absentCount = 0;
      let notMarkedCount = 0;

      deptStudentIds.forEach(studentId => {
        const status = attendanceMap.get(studentId);
        if (status === 'Present') {
          presentCount++;
        } else if (status === 'OD') {
          odCount++;
        } else if (status === 'Absent') {
          absentCount++;
        } else {
          notMarkedCount++;
        }
      });

      const totalStudents = deptStudents.length;
      // OD students are considered present for attendance percentage
      const presentWithOD = presentCount + odCount;
      const attendancePercentage = totalStudents > 0 
        ? Math.round((presentWithOD / totalStudents) * 100) 
        : 0;

      departmentStats.push({
        department: dept,
        totalStudents,
        presentStudents: presentCount,
        odStudents: odCount,
        absentStudents: absentCount,
        notMarkedStudents: notMarkedCount,
        attendancePercentage,
        date: todayISTString
      });
    }

    // Sort by attendance percentage (descending)
    departmentStats.sort((a, b) => b.attendancePercentage - a.attendancePercentage);

    res.status(200).json({
      success: true,
      data: {
        departments: departmentStats,
        date: todayISTString,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching attendance by department:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

// @desc    Get students in HOD's department
// @route   GET /api/admin/department-students
// @access  HOD and above
router.get('/department-students', hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    const department = currentUser.department;
    const includeInactive = req.query.includeInactive === 'true';
    const matchStage = includeInactive ? {} : { status: 'active' };

    // Get all students from HOD's department
    const students = await Student.find({ 
      department: department,
      ...matchStage 
    })
      .select('-password')
      .populate('userId', 'name email department')
      .sort({ batch: 1, year: 1, rollNumber: 1 })
      .lean();

    // Import ClassAssignment model
    const ClassAssignment = (await import('../models/ClassAssignment.js')).default;

    // Build a map of class assignments for efficient lookup
    // Create unique class keys from students: batch_year_semester_section
    const classKeys = new Set();
    students.forEach(student => {
      if (student.batch && student.year && student.semester && student.section) {
        let semesterNumber = student.semester;
        if (typeof semesterNumber === 'string' && semesterNumber.startsWith('Sem ')) {
          semesterNumber = parseInt(semesterNumber.replace('Sem ', ''));
        } else if (typeof semesterNumber === 'string') {
          semesterNumber = parseInt(semesterNumber);
        }
        if (!isNaN(semesterNumber)) {
          const classKey = `${student.batch}_${student.year}_${semesterNumber}_${student.section}`;
          classKeys.add(classKey);
        }
      }
    });

    // Fetch all active class assignments for these classes
    const classAssignmentsArray = Array.from(classKeys).map(key => {
      const [batch, year, semester, section] = key.split('_');
      return { batch, year, semester: parseInt(semester), section };
    });

    // Filter class assignments by department to prevent cross-department matches
    // Only get assignments for the HOD's department (using departmentId)
    const classAssignments = await ClassAssignment.find({
      $or: classAssignmentsArray,
      departmentId: currentUser._id, // Only get assignments for HOD's department
      active: true
    })
      .populate('facultyId', 'name email position department')
      .lean();

    // Create a map: classKey -> classAssignment
    const assignmentMap = new Map();
    classAssignments.forEach(assignment => {
      const classKey = `${assignment.batch}_${assignment.year}_${assignment.semester}_${assignment.section}`;
      assignmentMap.set(classKey, assignment);
    });

    // Get all unique faculty user IDs to fetch their Faculty records
    const facultyUserIds = [...new Set(classAssignments
      .filter(ca => ca.facultyId?._id)
      .map(ca => ca.facultyId._id.toString())
    )];

    // Filter faculty records by department to ensure only faculty from HOD's department
    const facultyRecords = await Faculty.find({
      userId: { $in: facultyUserIds },
      department: department // Only get faculty from HOD's department
    })
      .select('name position email department userId')
      .lean();

    // Create a map: userId -> Faculty record
    const facultyMap = new Map();
    facultyRecords.forEach(faculty => {
      const userId = faculty.userId?.toString();
      if (userId) {
        facultyMap.set(userId, faculty);
      }
    });

    // Fetch today's attendance records for all students
    const Attendance = (await import('../models/Attendance.js')).default;
    // Use IST date string for reliable matching (YYYY-MM-DD format)
    const todayIST = new Date();
    const todayISTString = todayIST.toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    const studentUserIds = students.map(s => s.userId?._id || s.userId).filter(id => id);
    const todayAttendanceRecords = await Attendance.find({
      studentId: { $in: studentUserIds },
      localDate: todayISTString // Use localDate for exact date matching
    }).lean();

    // Create a map: studentId (userId) -> attendance status
    const attendanceMap = new Map();
    todayAttendanceRecords.forEach(record => {
      const studentId = record.studentId?.toString();
      if (studentId) {
        attendanceMap.set(studentId, record.status || 'Not Marked');
      }
    });

    // Format students with class teacher info (current class advisor)
    const formattedStudents = students.map(student => {
      // Get the current class advisor for this student's class
      let classTeacher = null;
      
      if (student.batch && student.year && student.semester && student.section) {
        // Normalize semester - handle both "Sem X" format and numeric
        let semesterNumber = student.semester;
        if (typeof semesterNumber === 'string' && semesterNumber.startsWith('Sem ')) {
          semesterNumber = parseInt(semesterNumber.replace('Sem ', ''));
        } else if (typeof semesterNumber === 'string') {
          semesterNumber = parseInt(semesterNumber);
        }

        if (!isNaN(semesterNumber)) {
          const classKey = `${student.batch}_${student.year}_${semesterNumber}_${student.section}`;
          const classAssignment = assignmentMap.get(classKey);

          if (classAssignment && classAssignment.facultyId) {
            const facultyUserId = classAssignment.facultyId._id?.toString();
            const advisorFaculty = facultyUserId ? facultyMap.get(facultyUserId) : null;

            // Only use faculty if they belong to the same department
            if (advisorFaculty && advisorFaculty.department === department) {
              classTeacher = {
                id: advisorFaculty._id,
                name: advisorFaculty.name,
                position: advisorFaculty.position || 'Faculty',
                email: advisorFaculty.email || classAssignment.facultyId.email
              };
            } else if (classAssignment.facultyId && classAssignment.facultyId.department === department) {
              // Fallback to User info if Faculty record not found, but verify department matches
              classTeacher = {
                name: classAssignment.facultyId.name || 'Unknown',
                position: classAssignment.facultyId.position || 'Faculty',
                email: classAssignment.facultyId.email
              };
            }
            // If faculty doesn't belong to department, classTeacher remains null
          }
        }
      }

      // Get today's attendance status for this student
      const studentUserId = student.userId?._id?.toString() || student.userId?.toString();
      const todayAttendanceStatus = attendanceMap.get(studentUserId) || 'Not Marked';

      return {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email || student.userId?.email,
        batch: student.batch,
        year: student.year,
        semester: student.semester,
        section: student.section,
        department: department,
        mobile: student.mobile || student.phone,
        parentContact: student.parentContact,
        classTeacher: classTeacher,
        status: student.status,
        todayAttendanceStatus: todayAttendanceStatus
      };
    });

    const total = formattedStudents.length;

    res.status(200).json({
      success: true,
      data: {
        department,
        students: formattedStudents,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching department students:', error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

export default router;
