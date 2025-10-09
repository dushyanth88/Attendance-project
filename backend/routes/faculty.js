import express from 'express';
import { body, validationResult } from 'express-validator';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import { authenticate, hodAndAbove } from '../middleware/auth.js';

const router = express.Router();

// Profile route for individual faculty (less restrictive)
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Faculty can view their own profile, or admins/HODs can view any profile
    if (req.user.role !== 'admin' && req.user.role !== 'hod' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. You can only view your own profile.'
      });
    }

    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId }).populate('userId', 'name email department role');
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        msg: 'Faculty profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: faculty._id,
        name: faculty.name,
        email: faculty.email,
        position: faculty.position,
        assignedClass: faculty.assignedClass,
        department: faculty.department,
        phone: faculty.phone,
        is_class_advisor: faculty.is_class_advisor,
        batch: faculty.batch,
        year: faculty.year,
        semester: faculty.semester,
        status: faculty.status,
        advisorAssignment: faculty.getAdvisorAssignment()
      }
    });
  } catch (error) {
    console.error('Error fetching faculty profile:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// All other faculty routes require authentication and HOD or above role
router.use(authenticate);
router.use(hodAndAbove);

// @desc    Test HOD authentication
// @route   GET /api/faculty/test-auth
// @access  HOD and above
router.get('/test-auth', (req, res) => {
  res.json({
    status: 'success',
    message: 'HOD authentication working',
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department
    }
  });
});

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

// @desc    Get available batch ranges for HOD
// @route   GET /api/faculty/batch-ranges
// @access  HOD and above
router.get('/batch-ranges', (req, res) => {
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

// @desc    Check if class advisor position is available for HOD
// @route   POST /api/faculty/check-advisor-availability
// @access  HOD and above
router.post('/check-advisor-availability', async (req, res) => {
  try {
    const { batch, year, semester, section, department } = req.body;

    if (!batch || !year || !semester || !section || !department) {
      return res.status(400).json({
        success: false,
        msg: 'Batch, year, semester, section, and department are required'
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

    // Check if another faculty is already assigned to this batch/year/semester/section in this department
    const existingAdvisor = await Faculty.findOne({
      is_class_advisor: true,
      batch,
      year,
      semester,
      section, // ✅ Include section in uniqueness check
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

// @desc    Create new faculty
// @route   POST /api/faculty/create
// @access  HOD and above
router.post('/create', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('position').isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('assignedClass').optional().trim(),
  // Class advisor fields
  body('is_class_advisor').optional().isBoolean().withMessage('is_class_advisor must be boolean'),
  body('batch').optional().matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').optional().isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8'),
  body('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C')
], async (req, res) => {
  try {
    console.log('🔍 Faculty creation request received');
    console.log('User:', req.user ? { id: req.user._id, role: req.user.role, department: req.user.department } : 'No user');
    console.log('Request body:', req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      name, 
      email, 
      password, 
      position, 
      assignedClass,
      is_class_advisor,
      batch,
      year,
      semester,
      section
    } = req.body;
    const currentUser = req.user;

    // Validate year-semester combination for class advisors
    if (is_class_advisor && year && semester) {
      const validSemesters = {
        "1st Year": [1, 2],
        "2nd Year": [3, 4],
        "3rd Year": [5, 6],
        "4th Year": [7, 8]
      };
      
      if (!validSemesters[year] || !validSemesters[year].includes(parseInt(semester))) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid year-semester combination. Please select valid semester for the chosen year.'
        });
      }
    }

    console.log('🔍 Faculty creation data received:', {
      is_class_advisor,
      batch,
      year,
      semester,
      section,
      batchType: typeof batch,
      yearType: typeof year,
      semesterType: typeof semester,
      sectionType: typeof section
    });

    // Class advisor validations
    if (is_class_advisor) {
      if (!batch || !year || !semester || !section) {
        console.log('❌ Missing required fields:', {
          batch: !!batch,
          year: !!year,
          semester: !!semester,
          section: !!section
        });
        return res.status(400).json({
          status: 'error',
          message: 'Batch, year, semester, and section are required for class advisors'
        });
      }

      // Validate batch format
      if (!batch.match(/^\d{4}-\d{4}$/)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid batch format. Expected format: YYYY-YYYY (e.g., 2022-2026)'
        });
      }

      // Check if another faculty is already assigned to this batch/year/semester/section
      const existingAdvisor = await Faculty.findOne({
        is_class_advisor: true,
        batch,
        year,
        semester,
        section, // ✅ Include section in uniqueness check
        department: currentUser.department, // Use HOD's department
        status: 'active'
      });

      if (existingAdvisor) {
        return res.status(400).json({
          status: 'error',
          message: `Another faculty is already assigned as class advisor for Batch ${batch}, ${year}, Semester ${semester}, Section ${section}`,
          existingAdvisor: {
            name: existingAdvisor.name,
            email: existingAdvisor.email
          }
        });
      }
    }

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

    // Generate assignedClass string for class advisors
    let finalAssignedClass = assignedClass || 'None';
    if (is_class_advisor && batch && year && semester && section) {
      finalAssignedClass = `${batch}, ${year}, Sem ${semester}, Section ${section}`;
    }

    // Create faculty details and link to userId
    const faculty = new Faculty({
      userId: user._id,
      name,
      email: email.toLowerCase(),
      position,
      assignedClass: finalAssignedClass,
      department: currentUser.department,
      createdBy: currentUser._id,
      is_class_advisor: is_class_advisor || false,
      batch: is_class_advisor ? batch : undefined,
      year: is_class_advisor ? year : undefined,
      semester: is_class_advisor ? semester : undefined,
      section: is_class_advisor ? section : undefined
    });
    await faculty.save();

    const facultyResponse = faculty.toObject();

    let advisorMessage = '';
    if (is_class_advisor) {
      advisorMessage = ` and assigned as Class Advisor for Batch ${batch}, ${year}, Semester ${semester}, Section ${section}`;
    }

    res.status(201).json({
      status: 'success',
      message: `Faculty created successfully${advisorMessage}`,
      data: {
        ...facultyResponse,
        advisorAssignment: faculty.getAdvisorAssignment()
      }
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
    const filter = {};
    
    // HODs can only see faculty in their department, Admins can see all
    if (currentUser.role === 'hod') {
      filter.department = currentUser.department;
    }
    
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
  body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('position').optional().isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('assignedClass').optional().trim(),
  // Class advisor fields
  body('is_class_advisor').optional().isBoolean().withMessage('is_class_advisor must be boolean'),
  body('batch').optional().matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').optional().isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8'),
  body('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C')
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

    // Handle class advisor assignment
    if (updateData.is_class_advisor && updateData.batch && updateData.year && updateData.semester && updateData.section) {
      updateData.assignedClass = `${updateData.batch}, ${updateData.year}, Sem ${updateData.semester}, Section ${updateData.section}`;
    } else if (updateData.is_class_advisor === false) {
      // If removing class advisor status, clear related fields
      updateData.assignedClass = 'None';
      updateData.batch = undefined;
      updateData.year = undefined;
      updateData.semester = undefined;
      updateData.section = undefined;
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

// @desc    Get students by batch, year, and semester for class advisor
// @route   GET /api/faculty/students?batch=2022-2026&year=2nd Year&semester=3&department=CSE
// @access  Faculty and above (Class Advisor)
router.get('/students', authenticate, async (req, res) => {
  try {
    const { batch, year, semester, department } = req.query;
    const currentUser = req.user;

    console.log('🔍 Students request:', { batch, year, semester, department, userId: currentUser._id });

    if (!batch || !year || !semester || !department) {
      return res.status(400).json({
        success: false,
        message: 'Batch, year, semester, and department are required'
      });
    }

    // Check if faculty is class advisor for this batch/year/semester
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year,
      semester: parseInt(semester),
      department,
      status: 'active'
    });

    if (!faculty) {
      console.log('❌ Faculty not authorized for this class:', { batch, year, semester, department });
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage students for this class'
      });
    }

    console.log('✅ Faculty authorized, fetching students for:', { batch, year, semester, department });

    // Find students for this batch/year/semester in the specified department
    const students = await Student.find({
      batch,
      year,
      semester: `Sem ${semester}`,
      department,
      status: 'active'
    }).populate('userId', 'name email mobile').sort({ rollNumber: 1 });

    console.log('📊 Found students:', students.length);
    console.log('📊 Student data structure:', students.map(s => ({
      _id: s._id,
      rollNumber: s.rollNumber,
      name: s.name,
      email: s.email,
      mobile: s.mobile,
      userId: s.userId
    })));

    res.json({
      success: true,
      data: {
        students,
        total: students.length
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create student for class advisor
// @route   POST /api/faculty/students
// @access  HOD and above (Class Advisor)
router.post('/students', [
  body('rollNumber').trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('department').isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Invalid department')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rollNumber, name, email, mobile, password, batch, year, department } = req.body;
    const currentUser = req.user;

    // Check if faculty is class advisor for this batch/year
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      is_class_advisor: true,
      batch,
      year,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create students for this batch and year'
      });
    }

    // Check if department matches faculty's department
    if (department !== currentUser.department) {
      return res.status(403).json({
        success: false,
        message: 'You can only create students in your own department'
      });
    }

    // Check for existing user with same email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Student already exists with this email'
      });
    }

    // Check for existing student with same roll number in the same batch/year
    const existingStudent = await Student.findOne({ 
      rollNumber, 
      batch, 
      year,
      department 
    });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student already exists with this roll number in the same batch and year'
      });
    }

    // Check for existing mobile number
    const existingMobile = await Student.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: 'Student already exists with this mobile number'
      });
    }

    // Create user account
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'student',
      department,
      createdBy: currentUser._id
    });
    await user.save();

    // Create student profile
    const student = new Student({
      userId: user._id,
      rollNumber,
      name,
      email: email.toLowerCase(),
      mobile,
      batch,
      year,
      semester: 'Sem 1', // Default semester
      classAssigned: '1A', // Default class assignment
      facultyId: faculty._id,
      department,
      createdBy: currentUser._id
    });
    await student.save();

    res.status(201).json({
      success: true,
      message: `Student created successfully for ${batch}, ${year}`,
      data: student
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update student for class advisor
// @route   PUT /api/faculty/students/:id
// @access  HOD and above (Class Advisor)
router.put('/students/:id', [
  body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, email, mobile, password } = req.body;
    const currentUser = req.user;

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if faculty is class advisor for this student's batch/year
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      is_class_advisor: true,
      batch: student.batch,
      year: student.year,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this student'
      });
    }

    // Check for email conflicts (if email is being changed)
    if (email && email !== student.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: student.userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Another user already exists with this email'
        });
      }
    }

    // Check for mobile conflicts (if mobile is being changed)
    if (mobile && mobile !== student.mobile) {
      const existingMobile = await Student.findOne({ 
        mobile,
        _id: { $ne: id }
      });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: 'Another student already exists with this mobile number'
        });
      }
    }

    // Update student
    if (name) student.name = name;
    if (email) student.email = email.toLowerCase();
    if (mobile) student.mobile = mobile;
    await student.save();

    // Update user account
    const user = await User.findById(student.userId);
    if (user) {
      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      if (password) user.password = password; // Will be hashed by pre-save middleware
      await user.save();
    }

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete student for class advisor
// @route   DELETE /api/faculty/students/:id
// @access  HOD and above (Class Advisor)
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if faculty is class advisor for this student's batch/year
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      is_class_advisor: true,
      batch: student.batch,
      year: student.year,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this student'
      });
    }

    // Delete user account
    await User.findByIdAndDelete(student.userId);
    
    // Delete student profile
    await Student.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get assigned classes for class advisor
// @route   GET /api/faculty/assigned-classes
// @access  Faculty and above (Class Advisor)
router.get('/assigned-classes', authenticate, async (req, res) => {
  try {
    console.log('🔍 Assigned classes request from user:', req.user?.id);
    
    // Find faculty profile
    const faculty = await Faculty.findOne({
      userId: req.user._id,
      is_class_advisor: true,
      status: 'active'
    });

    if (!faculty) {
      console.log('❌ No class advisor profile found for user:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'You are not assigned as a class advisor'
      });
    }

    console.log('✅ Found class advisor profile:', {
      id: faculty._id,
      batch: faculty.batch,
      year: faculty.year,
      semester: faculty.semester,
      department: faculty.department
    });

    // Get student count for this batch
    const studentCount = await Student.countDocuments({
      batch: faculty.batch,
      year: faculty.year,
      semester: `Sem ${faculty.semester}`,
      department: faculty.department,
      status: 'active'
    });

    console.log('📊 Student count for batch:', studentCount);

    // Return assigned class information
    const assignedClass = {
      batch: faculty.batch,
      year: faculty.year,
      semester: faculty.semester,
      department: faculty.department,
      studentCount: studentCount
    };

    res.json({
      success: true,
      data: [assignedClass], // Return as array for consistency
      message: 'Assigned classes retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching assigned classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assigned classes'
    });
  }
});

export default router;
