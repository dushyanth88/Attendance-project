import express from 'express';
import { body, validationResult } from 'express-validator';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All student routes require authentication and faculty or above role
router.use(authenticate);
router.use(facultyAndAbove);

// @desc    Create new student
// @route   POST /api/student/create
// @route   POST /api/students/add (alias)
// @access  Faculty and above
router.post('/create', [
  body('rollNumber').trim().isLength({ min: 1, max: 20 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('classAssigned').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class assignment'),
  body('year').isIn(['1st', '2nd', '3rd', '4th']).withMessage('Invalid year'),
  body('semester').isIn(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']).withMessage('Invalid semester')
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

    const { rollNumber, name, email, password, mobile, classAssigned, year, semester } = req.body;
    const currentUser = req.user;

    // Check if email already exists across system
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
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

    // Create corresponding user for the student
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'student',
      department: currentUser.department,
      class: classAssigned,
      createdBy: currentUser._id
    });
    await user.save();

    // Create student details and link userId
    const student = new Student({
      userId: user._id,
      rollNumber,
      name,
      email: email.toLowerCase(),
      mobile,
      classAssigned,
      year,
      semester,
      facultyId: assignedFaculty._id,
      department: currentUser.department,
      createdBy: currentUser._id
    });
    await student.save();

    const studentResponse = student.toObject();

    res.status(201).json({
      status: 'success',
      message: 'Student added successfully',
      data: studentResponse
    });
  } catch (error) {
    console.error('Create student error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Create new student (alias route)
// @route   POST /api/students/add
// @access  Faculty and above
router.post('/add', [
  body('rollNo').trim().isLength({ min: 1, max: 20 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('classId').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class assignment')
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

    const { rollNo, name, email, mobile, classId } = req.body;
    const currentUser = req.user;

    // Check if email already exists across system
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }

    // Find faculty assigned to this class
    const assignedFaculty = await Faculty.findOne({ 
      assignedClass: classId,
      department: currentUser.department,
      status: 'active'
    });

    if (!assignedFaculty) {
      return res.status(400).json({
        status: 'error',
        message: 'No faculty assigned to this class'
      });
    }

    // Create corresponding user for the student
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: 'defaultPassword123', // Default password for alias route
      role: 'student',
      department: currentUser.department,
      class: classId,
      createdBy: currentUser._id
    });
    await user.save();

    // Create student details and link userId
    const student = new Student({
      userId: user._id,
      rollNumber: rollNo,
      name,
      email: email.toLowerCase(),
      mobile,
      classAssigned: classId,
      year: '1st', // Default values for alias route
      semester: 'Sem 1',
      facultyId: assignedFaculty._id,
      department: currentUser.department,
      createdBy: currentUser._id
    });
    await student.save();

    res.status(201).json({
      message: 'Student added successfully',
      studentId: student._id
    });
  } catch (error) {
    console.error('Create student (alias) error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }
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
        { rollNumber: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
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

// @desc    Get students by class (alt route)
// @route   GET /api/students/class/:classAssigned
// @access  Faculty and above
router.get('/class/:classAssigned', async (req, res) => {
  try {
    const { classAssigned } = req.params;
    const currentUser = req.user;
    const students = await Student.find({ classAssigned, department: currentUser.department, status: 'active' })
      .select('rollNumber name email mobile year semester')
      .sort({ rollNumber: 1 });

    res.status(200).json({
      status: 'success',
      data: { students }
    });
  } catch (error) {
    console.error('Get students (class) error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
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

// @desc    Test route for class management
// @route   GET /api/classes/test
// @access  Faculty and above
router.get('/classes/test', authenticate, facultyAndAbove, (req, res) => {
  res.json({ 
    message: 'Class management route is working', 
    user: req.user.name,
    department: req.user.department,
    timestamp: new Date().toISOString()
  });
});

// @desc    Verify route structure
// @route   GET /api/classes/verify/:classId
// @access  Faculty and above
router.get('/classes/verify/:classId', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUser = req.user;
    
    // Count students without fetching full data
    const studentCount = await Student.countDocuments({ 
      classAssigned: classId, 
      department: currentUser.department, 
      status: 'active' 
    });
    
    res.json({
      message: 'Route verification successful',
      classId,
      department: currentUser.department,
      studentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Route verification failed',
      error: error.message
    });
  }
});

// @desc    Get students by class for class management
// @route   GET /api/classes/:classId/students
// @access  Faculty and above
router.get('/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUser = req.user;

    console.log(`Fetching students for class: ${classId}, department: ${currentUser.department}`);

    // Authorization: Faculty can only view students from their department
    const students = await Student.find({ 
      classAssigned: classId, 
      department: currentUser.department, 
      status: 'active' 
    })
    .select('rollNumber name department mobile semester year')
    .sort({ rollNumber: 1 });

    console.log(`Found ${students.length} students for class ${classId}`);

    // Transform to match expected response format
    const formattedStudents = students.map(student => ({
      id: student._id,
      rollNo: student.rollNumber,
      name: student.name,
      dept: student.department,
      mobile: student.mobile || 'N/A',
      semester: student.semester,
      year: student.year
    }));

    // Return response in the expected format with students array wrapped
    res.status(200).json({
      students: formattedStudents
    });
  } catch (error) {
    console.error('Get students by class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      students: []
    });
  }
});

// @desc    Get student profile by ID
// @route   GET /api/students/:id
// @access  Faculty and above, or student accessing their own data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const student = await Student.findById(id)
      .select('rollNumber name department mobile semester year email classAssigned')
      .populate('facultyId', 'name');

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Authorization: Faculty can view students from their department, students can view their own data
    if (currentUser.role === 'student') {
      if (currentUser._id.toString() !== student.userId.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only view your own profile'
        });
      }
    } else if (currentUser.role === 'faculty' && student.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Transform to match expected response format
    const studentProfile = {
      rollNo: student.rollNumber,
      name: student.name,
      dept: student.department,
      mobile: student.mobile || 'N/A',
      year: student.year,
      semester: student.semester,
      email: student.email,
      classAssigned: student.classAssigned,
      facultyName: student.facultyId?.name || 'N/A'
    };

    res.status(200).json(studentProfile);
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get student attendance history with pagination
// @route   GET /api/students/:id/attendance
// @access  Faculty and above, or student accessing their own data
router.get('/:id/attendance', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Authorization: Faculty can view students from their department, students can view their own data
    if (currentUser.role === 'student') {
      if (currentUser._id.toString() !== student.userId.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only view your own attendance'
        });
      }
    } else if (currentUser.role === 'faculty' && student.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Get all attendance records for statistics
    const allAttendanceRecords = await Attendance.find({ 
      studentId: student.userId 
    })
    .select('date status reason')
    .sort({ date: -1 });

    if (allAttendanceRecords.length === 0) {
      return res.status(200).json({
        presentDays: 0,
        absentDays: 0,
        totalWorkingDays: 0,
        attendancePercentage: 0,
        attendanceHistory: [],
        semesterAbsents: 0,
        pagination: {
          current: page,
          pages: 0,
          total: 0,
          limit
        },
        message: 'No attendance records found'
      });
    }

    // Calculate statistics
    const presentDays = allAttendanceRecords.filter(record => record.status === 'Present').length;
    const absentDays = allAttendanceRecords.filter(record => record.status === 'Absent').length;
    const totalWorkingDays = presentDays + absentDays;
    const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    // Get current semester absents (last 30 days as approximation)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const semesterAbsents = allAttendanceRecords.filter(record => 
      record.status === 'Absent' && record.date >= thirtyDaysAgo
    ).length;

    // Paginate attendance history
    const skip = (page - 1) * limit;
    const paginatedRecords = await Attendance.find({ 
      studentId: student.userId 
    })
    .select('date status reason')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

    // Format attendance history with reasons
    const attendanceHistory = paginatedRecords.map(record => ({
      id: record._id,
      date: record.date.toISOString().split('T')[0],
      status: record.status,
      reason: record.reason || '',
      canEdit: currentUser.role !== 'student' && record.status === 'Absent' // Faculty can edit absent reasons
    }));

    const totalPages = Math.ceil(allAttendanceRecords.length / limit);

    res.status(200).json({
      presentDays,
      absentDays,
      totalWorkingDays,
      attendancePercentage,
      attendanceHistory,
      semesterAbsents,
      pagination: {
        current: page,
        pages: totalPages,
        total: allAttendanceRecords.length,
        limit
      }
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

export default router;
