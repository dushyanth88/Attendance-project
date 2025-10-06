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

// Helper: normalize year and semester inputs to stored format
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
  return asString; // fallback
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
  return asString; // fallback
};

const parseYearNumber = (normalizedYear) => {
  if (!normalizedYear) return undefined;
  const m = String(normalizedYear).match(/^(\d)(st|nd|rd|th)\s*Year$/i);
  if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(String(normalizedYear))) return parseInt(normalizedYear, 10);
  return undefined;
};

const parseSemesterNumber = (normalizedSemester) => {
  if (!normalizedSemester) return undefined;
  const m = String(normalizedSemester).match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return undefined;
};

// @desc    Fetch students for assigned class (by batch/year/semester[/section])
// @route   GET /api/students?batch=YYYY-YYYY&year=2nd%20Year|1&semester=3|Sem%203[&section=A]
// @access  Faculty (Class Advisor) and above
router.get('/', async (req, res) => {
  try {
    const { batch, year, semester, section } = req.query;
    if (!batch || !year || !semester) {
      return res.status(400).json({
        success: false,
        message: 'batch, year, and semester are required'
      });
    }

    const normalizedYear = normalizeYear(year);
    const normalizedSemester = normalizeSemester(semester);

    // Verify faculty is class advisor for this class
    const faculty = await Faculty.findOne({
      userId: req.user._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(String(semester), 10) || parseInt(String(normalizedSemester).match(/\d+/)?.[0] || '0', 10),
      ...(section ? { section } : {}),
      department: req.user.department,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view students for this class'
      });
    }

    const students = await Student.find({
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      department: req.user.department,
      status: 'active'
    })
      .select('userId rollNumber name email mobile year semester batch department')
      .sort({ rollNumber: 1 });

    // Map to expected response shape
    const yearNumber = parseYearNumber(normalizedYear);
    const semesterNumber = parseSemesterNumber(normalizedSemester);
    const data = students.map(s => ({
      id: s._id, // Use Student document ID for API consistency
      _id: s._id, // Also include _id for compatibility
      userId: s.userId, // Include userId for reference
      roll_number: s.rollNumber,
      rollNumber: s.rollNumber, // Include both formats
      full_name: s.name,
      name: s.name, // Include both formats
      email: s.email,
      mobile_number: s.mobile || '',
      mobile: s.mobile || '', // Include both formats
      department: s.department,
      batch: s.batch,
      year: yearNumber,
      semester: semesterNumber,
      section: faculty?.section || undefined
    }));

    return res.status(200).json({
      success: true,
      data: {
        students: data,
        total: data.length
      }
    });
  } catch (error) {
    console.error('GET /api/students error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Create new student
// @route   POST /api/students
// @access  Faculty (Class Advisor) and above
router.post('/', [
  body('roll_number').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('rollNumber').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('rollNo').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('full_name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile_number').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be 10 digits'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be 10 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').exists().withMessage('Year is required'),
  body('semester').exists().withMessage('Semester is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const bodyData = req.body;
    const rollNumber = (bodyData.roll_number || bodyData.rollNumber || bodyData.rollNo || '').trim();
    const name = (bodyData.full_name || bodyData.name || '').trim();
    const email = String(bodyData.email).toLowerCase().trim();
    const mobile = (bodyData.mobile_number || bodyData.mobile || '').trim();
    const password = String(bodyData.password);
    const batch = String(bodyData.batch).trim();
    const normalizedYear = normalizeYear(bodyData.year);
    const normalizedSemester = normalizeSemester(bodyData.semester);

    if (!rollNumber) {
      return res.status(400).json({ success: false, message: 'Missing roll_number' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'Missing full_name' });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Missing password' });
    }

    // Validate year-semester combination
    const yearNumber = parseYearNumber(normalizedYear);
    const semesterNumber = parseSemesterNumber(normalizedSemester);
    
    if (yearNumber && semesterNumber) {
      const validSemesters = {
        1: [1, 2],
        2: [3, 4],
        3: [5, 6],
        4: [7, 8]
      };
      
      if (!validSemesters[yearNumber] || !validSemesters[yearNumber].includes(semesterNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year-semester combination. Please select valid semester for the chosen year.'
        });
      }
    }

    // Verify authorization: must be class advisor for this batch/year/semester
    const faculty = await Faculty.findOne({
      userId: req.user._id,
      is_class_advisor: true,
      batch,
      year: normalizedYear,
      semester: parseInt(String(bodyData.semester), 10) || parseInt(String(normalizedSemester).match(/\d+/)?.[0] || '0', 10),
      department: req.user.department,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({ success: false, message: 'You are not authorized to create students for this class' });
    }

    // Check email uniqueness across users
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Check roll number uniqueness within batch
    const existingStudent = await Student.findOne({ rollNumber, batch });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Roll number already exists in this batch' });
    }

    // Optional: ensure mobile uniqueness among students
    if (mobile) {
      const existingMobile = await Student.findOne({ mobile });
      if (existingMobile) {
        return res.status(400).json({ success: false, message: 'Mobile number already in use' });
      }
    }

    // Build class string for User schema (required for students)
    const userClassString = `${batch}, ${normalizedYear}, ${normalizedSemester}`;

    // Create User account (password hashed by pre-save hook)
    const user = new User({
      name,
      email,
      password,
      role: 'student',
      department: req.user.department,
      class: userClassString,
      createdBy: req.user._id
    });
    await user.save();

    // Create Student profile
    const student = new Student({
      userId: user._id,
      rollNumber,
      name,
      email,
      mobile,
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      classAssigned: '1A', // legacy field required by schema; not used in this flow
      facultyId: faculty._id,
      department: req.user.department,
      createdBy: req.user._id
    });
    await student.save();

    const response = {
      id: student._id,
      roll_number: student.rollNumber,
      full_name: student.name,
      email: student.email,
      mobile_number: student.mobile || '',
      department: student.department,
      batch: student.batch,
      year: yearNumber,
      semester: semesterNumber
    };

    return res.status(201).json({ success: true, message: 'Student created successfully', data: response });
  } catch (error) {
    console.error('POST /api/students error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate entry' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete student (removes from both Users & Students)
// @route   DELETE /api/students/:id
// @access  Faculty (Class Advisor) and above
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Verify faculty is authorized for this student's class
    const faculty = await Faculty.findOne({
      userId: req.user._id,
      is_class_advisor: true,
      batch: student.batch,
      year: student.year,
      department: req.user.department,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this student' });
    }

    // Delete linked user
    await User.findByIdAndDelete(student.userId);
    // Delete student
    await Student.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/students/:id error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

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


// @desc    Update student details (comprehensive)
// @route   PUT /api/students/:id
// @access  Faculty and above
router.put('/:id', [
  body('rollNumber').notEmpty().withMessage('Roll number is required'),
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').isLength({ min: 10, max: 10 }).withMessage('Mobile number must be 10 digits'),
  body('batch').notEmpty().withMessage('Batch is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('section').optional().trim()
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

    const { rollNumber, name, email, mobile, batch, year, semester, section } = req.body;
    const currentUser = req.user;

    // Find the student
    const student = await Student.findById(req.params.id).populate('userId');
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Check if roll number is being changed and if it already exists in the same class
    if (rollNumber !== student.rollNumber) {
      const existingStudent = await Student.findOne({
        rollNumber: rollNumber.trim(),
        batch,
        year: normalizeYear(year),
        semester: normalizeSemester(semester),
        department: currentUser.department,
        _id: { $ne: req.params.id }
      });

      if (existingStudent) {
        return res.status(400).json({
          status: 'error',
          message: 'Roll number already exists in this class'
        });
      }
    }

    // Check if email is being changed and if it already exists
    if (email !== student.userId.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: student.userId._id }
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists'
        });
      }
    }

    // Update User model
    const updatedUser = await User.findByIdAndUpdate(
      student.userId._id,
      {
        name: name.trim(),
        email: email.toLowerCase(),
        mobile: mobile.trim()
      },
      { new: true, runValidators: true }
    );

    // Update Student model
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        rollNumber: rollNumber.trim(),
        batch: batch.trim(),
        year: normalizeYear(year),
        semester: normalizeSemester(semester),
        section: section ? section.trim() : undefined,
        mobile: mobile.trim()
      },
      { new: true, runValidators: true }
    ).populate('userId', 'name email mobile');

    console.log('✅ Student updated successfully:', {
      studentId: updatedStudent._id,
      rollNumber: updatedStudent.rollNumber,
      name: updatedUser.name,
      email: updatedUser.email
    });

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: {
        _id: updatedStudent._id,
        rollNumber: updatedStudent.rollNumber,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        batch: updatedStudent.batch,
        year: updatedStudent.year,
        semester: updatedStudent.semester,
        section: updatedStudent.section,
        userId: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          mobile: updatedUser.mobile
        }
      }
    });
  } catch (error) {
    console.error('❌ Update student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Update student (legacy endpoint)
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

// @desc    Get student profile with detailed attendance data
// @route   GET /api/students/:id/profile
// @access  Faculty and above, or student accessing their own data
router.get('/:id/profile', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const currentUser = req.user;

    console.log('👤 Fetching student profile for ID:', id);

    // Authorization: students can only access their own data, faculty+ can access any
    if (currentUser.role === 'student' && currentUser._id.toString() !== id) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    // Get student basic info
    const student = await Student.findOne({ userId: id })
      .populate('userId', 'name email mobile')
      .populate('facultyId', 'name');

    console.log('👤 Student found:', student ? 'Yes' : 'No');

    if (!student) {
      console.log('❌ Student not found for userId:', id);
      return res.status(404).json({ status: 'error', message: 'Student not found' });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // Default to current academic year if no date range provided
      const currentYear = new Date().getFullYear();
      const academicYearStart = new Date(currentYear, 7, 1); // August 1st
      const academicYearEnd = new Date(currentYear + 1, 6, 31); // July 31st next year
      dateFilter = { $gte: academicYearStart, $lte: academicYearEnd };
    }

    // Get attendance records for the student
    const attendanceRecords = await Attendance.find({
      studentId: id,
      date: dateFilter
    }).sort({ date: 1 });

    // Get holidays in the same date range to exclude from working days
    const Holiday = (await import('../models/Holiday.js')).default;
    
    // Convert dateFilter to string format for holiday queries
    let holidayDateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      holidayDateFilter = { $gte: start, $lte: end };
    } else {
      // Default to current academic year if no date range provided
      const currentYear = new Date().getFullYear();
      const academicYearStart = `${currentYear}-08-01`; // August 1st
      const academicYearEnd = `${currentYear + 1}-07-31`; // July 31st next year
      holidayDateFilter = { $gte: academicYearStart, $lte: academicYearEnd };
    }
    
    const holidays = await Holiday.find({
      department: student.department,
      holidayDate: holidayDateFilter,
      isActive: true
    }).select('holidayDate reason');

    // Create a set of holiday dates for quick lookup
    const holidayDates = new Set(holidays.map(h => 
      typeof h.holidayDate === 'string' ? h.holidayDate : h.holidayDate.toISOString().split('T')[0]
    ));

    // Calculate attendance statistics (excluding holidays and "Not Marked" days)
    const workingDaysRecords = attendanceRecords.filter(record => {
      const recordDate = record.date.toISOString().split('T')[0];
      return !holidayDates.has(recordDate) && record.status !== 'Not Marked';
    });

    const totalDays = workingDaysRecords.length;
    const presentDays = workingDaysRecords.filter(record => record.status === 'Present').length;
    const absentDays = workingDaysRecords.filter(record => record.status === 'Absent').length;
    const notMarkedDays = attendanceRecords.filter(record => {
      const recordDate = record.date.toISOString().split('T')[0];
      return !holidayDates.has(recordDate) && record.status === 'Not Marked';
    }).length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Group attendance by month for calendar view (including holidays)
    const monthlyAttendance = {};
    
    // Add attendance records
    attendanceRecords.forEach(record => {
      const monthKey = record.date.toISOString().slice(0, 7); // YYYY-MM format
      if (!monthlyAttendance[monthKey]) {
        monthlyAttendance[monthKey] = [];
      }
      monthlyAttendance[monthKey].push({
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        reason: record.reason || '',
        actionTaken: record.actionTaken || ''
      });
    });

    // Add holidays to monthly attendance
    holidays.forEach(holiday => {
      // Handle both string and Date formats
      const holidayDateStr = typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0];
      const monthKey = holidayDateStr.slice(0, 7); // Extract YYYY-MM
      if (!monthlyAttendance[monthKey]) {
        monthlyAttendance[monthKey] = [];
      }
      monthlyAttendance[monthKey].push({
        date: holidayDateStr,
        status: 'Holiday',
        reason: holiday.reason,
        actionTaken: ''
      });
    });

    // Get recent attendance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAttendance = attendanceRecords.filter(record => record.date >= thirtyDaysAgo);

    res.json({
      status: 'success',
      data: {
        // Student basic info
        student: {
          id: student.userId._id,
          rollNumber: student.rollNumber,
          name: student.userId.name,
          email: student.userId.email,
          mobile: student.mobile || student.userId.mobile || 'N/A',
          department: student.department,
          year: student.year,
          semester: student.semester,
          section: student.section,
          batch: student.batch,
          classAssigned: student.classAssigned,
          facultyName: student.facultyId?.name || 'Not assigned'
        },
        // Attendance statistics
        attendanceStats: {
          totalDays,
          presentDays,
          absentDays,
          notMarkedDays,
          attendancePercentage
        },
        // Monthly attendance data for calendar
        monthlyAttendance,
        // Recent attendance for quick view
        recentAttendance: recentAttendance.map(record => ({
          date: record.date.toISOString().split('T')[0],
          status: record.status,
          reason: record.reason || '',
          actionTaken: record.actionTaken || ''
        }))
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student profile' });
  }
});

export default router;
