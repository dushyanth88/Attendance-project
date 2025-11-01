import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import ClassAssignment from '../models/ClassAssignment.js';
import Student from '../models/Student.js';
import { authenticate, hodAndAbove, facultyAndAbove } from '../middleware/auth.js';
import { createStudentWithStandardizedData } from '../services/studentCreationService.js';

const router = express.Router();

// Configure multer for profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for profile pictures
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }
});

// @desc    Migrate students from an old class to a newly assigned class
// @route   POST /api/faculty/:id/migrate-students
// @access  HOD and above (triggered post-reassignment) or Faculty (self-service if allowed)
router.post('/:id/migrate-students', authenticate, async (req, res) => {
  try {
    const { id } = req.params; // Faculty model id
    const { from, to, importOldStudents } = req.body;

    // Authorization: HOD/Admin can migrate any; faculty can migrate self
    const requester = req.user;
    if (!['admin', 'hod'].includes(requester.role)) {
      const facultyDoc = await Faculty.findById(id);
      if (!facultyDoc || facultyDoc.userId.toString() !== requester._id.toString()) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({ status: 'error', message: 'Faculty not found' });
    }

    if (!to || !to.batch || !to.year || !to.semester || !to.section) {
      return res.status(400).json({ status: 'error', message: 'Target class (to) is required' });
    }

    const Student = (await import('../models/Student.js')).default;

    let updatedCount = 0;
    if (importOldStudents && from && from.batch && from.year && from.semester && from.section) {
      const legacySem = typeof from.semester === 'number' ? `Sem ${from.semester}` : from.semester;
      const students = await Student.find({
        batch: from.batch,
        year: from.year,
        semester: legacySem,
        section: from.section,
        department: faculty.department,
        status: 'active',
        facultyId: faculty._id
      });

      const targetSem = typeof to.semester === 'number' ? `Sem ${to.semester}` : to.semester;
      const classId = `${to.batch}_${to.year}_${targetSem}_${to.section}`;

      const bulk = Student.collection.initializeUnorderedBulkOp();
      for (const s of students) {
        bulk.find({ _id: s._id }).update({
          $set: {
            batch: to.batch,
            year: to.year,
            semester: targetSem,
            section: to.section,
            classAssigned: to.section, // legacy
            classId,
            facultyId: faculty._id
          }
        });
      }
      if (students.length > 0) {
        const result = await bulk.execute();
        updatedCount = result.nModified || students.length;
      }
    }

    return res.status(200).json({
      status: 'success',
      message: importOldStudents ? `Migrated ${updatedCount} students to the new class` : 'No migration performed',
      data: { migrated: updatedCount }
    });
  } catch (error) {
    console.error('Error migrating students:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to migrate students' });
  }
});

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
    const faculty = await Faculty.findOne({ userId }).populate('userId', 'name email department role profileImage');
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        msg: 'Faculty profile not found'
      });
    }

    console.log('🖼️ Faculty profile response - profileImage:', faculty.userId.profileImage);
    
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
        profileImage: faculty.userId.profileImage,
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

// @desc    Upload profile picture
// @route   POST /api/faculty/profile-picture
// @access  Faculty and above
router.post('/profile-picture', authenticate, facultyAndAbove, (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({
        success: false,
        msg: err.message || 'File upload error'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📸 Profile picture upload request received');
    console.log('🔐 User:', req.user ? 'Authenticated' : 'Not authenticated');
    console.log('📁 File:', req.file ? 'Present' : 'Missing');
    console.log('📋 Body:', req.body);
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        msg: 'No profile picture uploaded'
      });
    }

    console.log('📁 File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const currentUser = req.user;
    
    // Convert image to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Update user's profile image
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      { profileImage: base64Image },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    console.log('✅ Profile image saved successfully:', {
      userId: updatedUser._id,
      profileImageLength: updatedUser.profileImage ? updatedUser.profileImage.length : 0,
      profileImagePreview: updatedUser.profileImage ? updatedUser.profileImage.substring(0, 50) + '...' : 'null'
    });

    res.json({
      success: true,
      msg: 'Profile picture uploaded successfully',
      data: {
        profileImage: updatedUser.profileImage
      }
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Remove profile picture
// @route   DELETE /api/faculty/profile-picture
// @access  Faculty and above
router.delete('/profile-picture', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Remove profile image
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      { profileImage: null },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        msg: 'User not found'
      });
    }

    res.json({
      success: true,
      msg: 'Profile picture removed successfully'
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Upload student profile picture (Class Advisor only)
// @route   POST /api/faculty/student-profile-picture/:studentId
// @access  Faculty and above (Class Advisor only)
router.post('/student-profile-picture/:studentId', authenticate, facultyAndAbove, (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({
        success: false,
        msg: err.message || 'File upload error'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.user;
    
    console.log('📸 Student profile picture upload request received');
    console.log('🔐 User:', req.user ? 'Authenticated' : 'Not authenticated');
    console.log('👨‍🎓 Student ID:', studentId);
    console.log('📁 File:', req.file ? 'Present' : 'Missing');
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        msg: 'No profile picture uploaded'
      });
    }

    console.log('📁 File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Find the student
    const student = await Student.findById(studentId).populate('userId', 'name email');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        msg: 'Student not found'
      });
    }

    // Check if current user is the class advisor for this student
    // Convert semester from "Sem 7" format to number 7
    const semesterNumber = typeof student.semester === 'string' && student.semester.startsWith('Sem ') 
      ? parseInt(student.semester.replace('Sem ', '')) 
      : student.semester;
    
    const classAssignment = await ClassAssignment.findOne({
      facultyId: currentUser._id,
      batch: student.batch,
      year: student.year,
      semester: semesterNumber,
      section: student.section,
      active: true
    });

    if (!classAssignment) {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. You are not the class advisor for this student.'
      });
    }

    console.log('✅ Class advisor verification passed for student:', student.userId.name);

    // Convert image to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Update student's profile image
    const updatedUser = await User.findByIdAndUpdate(
      student.userId._id,
      { profileImage: base64Image },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        msg: 'Student user not found'
      });
    }

    console.log('✅ Student profile image saved successfully:', {
      studentId: student._id,
      studentName: student.userId.name,
      userId: updatedUser._id,
      profileImageLength: updatedUser.profileImage ? updatedUser.profileImage.length : 0,
      profileImagePreview: updatedUser.profileImage ? updatedUser.profileImage.substring(0, 50) + '...' : 'null'
    });

    res.json({
      success: true,
      msg: 'Student profile picture uploaded successfully',
      data: {
        studentId: student._id,
        studentName: student.userId.name,
        profileImage: updatedUser.profileImage
      }
    });
  } catch (error) {
    console.error('Error uploading student profile picture:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// @desc    Remove student profile picture (Class Advisor only)
// @route   DELETE /api/faculty/student-profile-picture/:studentId
// @access  Faculty and above (Class Advisor only)
router.delete('/student-profile-picture/:studentId', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.user;
    
    console.log('🗑️ Student profile picture removal request received');
    console.log('👨‍🎓 Student ID:', studentId);

    // Find the student
    const student = await Student.findById(studentId).populate('userId', 'name email');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        msg: 'Student not found'
      });
    }

    // Check if current user is the class advisor for this student
    // Convert semester from "Sem 7" format to number 7
    const semesterNumber = typeof student.semester === 'string' && student.semester.startsWith('Sem ') 
      ? parseInt(student.semester.replace('Sem ', '')) 
      : student.semester;
    
    const classAssignment = await ClassAssignment.findOne({
      facultyId: currentUser._id,
      batch: student.batch,
      year: student.year,
      semester: semesterNumber,
      section: student.section,
      active: true
    });

    if (!classAssignment) {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. You are not the class advisor for this student.'
      });
    }

    console.log('✅ Class advisor verification passed for student:', student.userId.name);

    // Remove profile image
    const updatedUser = await User.findByIdAndUpdate(
      student.userId._id,
      { profileImage: null },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        msg: 'Student user not found'
      });
    }

    console.log('✅ Student profile image removed successfully:', {
      studentId: student._id,
      studentName: student.userId.name,
      userId: updatedUser._id
    });

    res.json({
      success: true,
      msg: 'Student profile picture removed successfully',
      data: {
        studentId: student._id,
        studentName: student.userId.name
      }
    });
  } catch (error) {
    console.error('Error removing student profile picture:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// All other faculty routes require authentication and HOD or above role
router.use(authenticate);
// Note: Individual routes will specify their own authorization requirements

// @desc    Test HOD authentication
// @route   GET /api/faculty/test-auth
// @access  HOD and above
router.get('/test-auth', hodAndAbove, (req, res) => {
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

// @desc    Get available batch ranges for HOD
// @route   GET /api/faculty/batch-ranges
// @access  Faculty and above
router.get('/batch-ranges', facultyAndAbove, (req, res) => {
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
router.post('/check-advisor-availability', hodAndAbove, async (req, res) => {
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
router.post('/create', hodAndAbove, [
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
      section: is_class_advisor ? section : undefined,
      // Initialize assignedClasses array
      assignedClasses: []
    });
    await faculty.save();

    // If faculty is assigned as class advisor, add to assignedClasses array
    if (is_class_advisor && batch && year && semester && section) {
      console.log('Adding class assignment to faculty during creation:', {
        batch,
        year,
        semester,
        section,
        assignedBy: currentUser._id
      });
      
      faculty.assignedClasses.push({
        batch,
        year,
        semester,
        section,
        assignedDate: new Date(),
        assignedBy: currentUser._id,
        active: true
      });
      await faculty.save();
      console.log('Faculty assignedClasses updated:', faculty.assignedClasses);

      // Also create a ClassAssignment record
      try {
        const classAssignment = await ClassAssignment.assignAdvisor({
          facultyId: user._id,
          batch,
          year,
          semester,
          section,
          departmentId: currentUser._id,
          assignedBy: currentUser._id,
          notes: `Assigned during faculty creation by HOD ${currentUser.name}`
        });
        console.log('ClassAssignment record created during faculty creation:', classAssignment._id);
      } catch (classAssignmentError) {
        console.error('Error creating ClassAssignment record during faculty creation:', classAssignmentError);
        // Don't fail the faculty creation, just log the error
      }
    }

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
router.get('/list', hodAndAbove, async (req, res) => {
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
      .limit(limit)
      .lean(); // Use lean() to avoid schema validation issues

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
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get faculty assigned classes
// @route   GET /api/faculty/:facultyId/classes
// @access  Faculty and above
router.get('/:facultyId/classes', facultyAndAbove, async (req, res) => {
  try {
    const { facultyId } = req.params;
    const currentUser = req.user;

    // Verify the faculty is accessing their own classes or is HOD/admin
    if (currentUser._id.toString() !== facultyId && !['hod', 'admin', 'principal'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own assigned classes'
      });
    }

    console.log('🔍 Fetching assigned classes for faculty:', facultyId);

    // Get assigned classes from ClassAssignment model
    const classAssignments = await ClassAssignment.find({
      facultyId: facultyId,
      active: true
    }).populate('facultyId', 'name email');

    console.log('📋 Found class assignments:', classAssignments.length, classAssignments);

    // Format assigned classes
    const assignedClasses = classAssignments.map(assignment => ({
      classId: assignment._id,
      batch: assignment.batch,
      year: assignment.year,
      semester: assignment.semester,
      section: assignment.section,
      department: assignment.departmentId,
      assignedDate: assignment.assignedDate,
      notes: assignment.notes
    }));

    console.log('✅ Formatted assigned classes:', assignedClasses);

    res.json({
      success: true,
      data: assignedClasses,
      message: 'Assigned classes retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching faculty assigned classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assigned classes'
    });
  }
});

// @desc    Get faculty dashboard data
// @route   GET /api/faculty/:facultyId/dashboard
// @access  Faculty and above
router.get('/:facultyId/dashboard', facultyAndAbove, async (req, res) => {
  try {
    const { facultyId } = req.params;
    const currentUser = req.user;

    // Verify the faculty is accessing their own dashboard or is HOD/admin
    if (currentUser._id.toString() !== facultyId && !['hod', 'admin', 'principal'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own dashboard'
      });
    }

    // Get faculty profile
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    }).populate('userId', 'name email department');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Get assigned classes from ClassAssignment model
    const classAssignments = await ClassAssignment.find({
      facultyId: facultyId,
      active: true
    }).populate('facultyId', 'name email');

    // Format assigned classes
    const assignedClasses = classAssignments.map(assignment => ({
      id: assignment._id,
      batch: assignment.batch,
      year: assignment.year,
      sem: assignment.semester,
      section: assignment.section,
      department: assignment.departmentId,
      assignedDate: assignment.assignedDate
    }));

    res.json({
      success: true,
      faculty: {
        name: faculty.userId.name,
        email: faculty.userId.email,
        department: faculty.userId.department,
        position: faculty.position,
        isClassAdvisor: faculty.is_class_advisor
      },
      assignedClasses: assignedClasses
    });

  } catch (error) {
    console.error('Error fetching faculty dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching faculty dashboard'
    });
  }
});

// @desc    Get students by batch, year, and semester for class advisor
// @route   GET /api/faculty/students?batch=2022-2026&year=2nd Year&semester=3&department=CSE
// @access  Faculty and above (Class Advisor)
router.get('/students', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, department, section } = req.query;
    const currentUser = req.user;

    console.log('🔍 Students request:', { batch, year, semester, department, section, userId: currentUser._id });

    if (!batch || !year || !semester || !department || !section) {
      return res.status(400).json({
        success: false,
        message: 'Batch, year, semester, section, and department are required'
      });
    }

    // Check if faculty is class advisor for this batch/year/semester
    // First check ClassAssignment model
    const classAssignment = await ClassAssignment.findOne({
      facultyId: currentUser._id,
      batch,
      year,
      semester: parseInt(semester),
      section: section,
      active: true
    });

    // If not found in ClassAssignment, check Faculty model
    let faculty = null;
    if (!classAssignment) {
      // Check if faculty is assigned to this specific class through assignedClasses array
      faculty = await Faculty.findOne({ 
        userId: currentUser._id,
        'assignedClasses.batch': batch,
        'assignedClasses.year': year,
        'assignedClasses.semester': parseInt(semester),
        'assignedClasses.section': section,
        'assignedClasses.active': true,
        department,
        status: 'active'
      });
    }

    // Verify authorization - faculty must be assigned as class advisor
    if (!classAssignment && !faculty) {
      console.log('❌ Faculty not authorized for this class:', { batch, year, semester, department });
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage students for this class. You are not assigned as the class advisor.'
      });
    }

    console.log('✅ Faculty authorized, fetching students for:', { batch, year, semester, department });

    // Build classId for querying - same format as stored in bulk upload
    // Format: batch_year_semester_section (e.g., "2024-2028_1st Year_Sem 1_A")
    const normalizedYear = year; // Already in correct format from request
    const normalizedSemester = `Sem ${semester}`; // Convert to "Sem X" format
    const classId = `${batch}_${normalizedYear}_${normalizedSemester}_${section}`;
    
    console.log('🔍 Querying students with classId:', classId);
    console.log('📝 Note: Fetching students by class details (not by facultyId) to support class advisor reassignment');
    
    // Fetch students by class details, not by facultyId
    // This allows new class advisors to see existing students when they're assigned to the class
    // First try with classId for precise matching
    let students = await Student.find({
      classId: classId,
      department: department,
      status: 'active' // Exclude soft-deleted students
    }).populate('userId', 'name email mobile profileImage').sort({ rollNumber: 1 });
    
    // If no students found with classId, try without classId (backward compatibility)
    if (students.length === 0) {
      console.log('⚠️ No students found with classId, trying without classId filter...');
      students = await Student.find({
        batch,
        year: normalizedYear,
        semester: normalizedSemester,
        section: section,
        department: department,
        status: 'active' // Exclude soft-deleted students
      }).populate('userId', 'name email mobile profileImage').sort({ rollNumber: 1 });
    }
    
    console.log(`📊 Found ${students.length} students for class ${classId} (fetched by class assignment, not facultyId)`);

    // Do not fall back to the User model. If no Student records match, return empty list to avoid
    // cross-class leakage when classes are reassigned.

    console.log('📊 Found students:', students.length);
    console.log('📊 Student data structure:', students.map(s => ({
      _id: s._id,
      rollNumber: s.rollNumber,
      name: s.name,
      email: s.email,
      mobile: s.mobile,
      userId: s.userId,
      classId: s.classId,
      facultyId: s.facultyId
    })));
    
    // Additional debugging for classId
    if (students.length > 0) {
      console.log('🔍 Sample student classId:', students[0].classId);
      console.log('🔍 Expected classId format:', classId);
      console.log('🔍 ClassId match:', students[0].classId === classId);
    }

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

// @route   GET /api/faculty/:id
// @access  HOD and above
router.get('/:id', hodAndAbove, async (req, res) => {
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
router.put('/:id', hodAndAbove, [
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
router.delete('/:id', hodAndAbove, async (req, res) => {
  try {
    console.log('🗑️ Delete faculty route hit:', req.params.id, 'URL:', req.url);
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    console.log('Deleting faculty:', faculty.name, 'with userId:', faculty.userId);

    const deletionResults = {
      classAssignments: 0,
      user: false,
      faculty: false
    };

    // Delete all ClassAssignment records for this faculty
    try {
      const classAssignments = await ClassAssignment.find({
        facultyId: faculty.userId
      });
      
      console.log('Found ClassAssignment records to delete:', classAssignments.length);
      for (const assignment of classAssignments) {
        await assignment.completeRemoval();
        deletionResults.classAssignments++;
        console.log('✅ Completely removed assignment:', assignment._id);
      }
    } catch (error) {
      console.error('Error deleting ClassAssignment records:', error);
    }

    // Delete the associated User record
    try {
      const user = await User.findById(faculty.userId);
      if (user) {
        await User.findByIdAndDelete(faculty.userId);
        deletionResults.user = true;
        console.log('Deleted User record:', faculty.userId);
      }
    } catch (error) {
      console.error('Error deleting User record:', error);
    }

    // Delete the Faculty record
    try {
      await Faculty.findByIdAndDelete(req.params.id);
      deletionResults.faculty = true;
      console.log('Deleted Faculty record:', req.params.id);
    } catch (error) {
      console.error('Error deleting Faculty record:', error);
    }

    console.log('Deletion results:', deletionResults);

    res.status(200).json({
      status: 'success',
      message: `Faculty deleted successfully. Removed ${deletionResults.classAssignments} class assignments, user account, and faculty record.`,
      deletionResults
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

// @desc    Create student for class advisor
// @route   POST /api/faculty/students
// @access  Faculty and above (Class Advisor)
router.post('/students', authenticate, facultyAndAbove, [
  body('rollNumber').trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('parentContact').optional().matches(/^[0-9]{10}$/).withMessage('Parent contact must be exactly 10 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').optional().isIn(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']).withMessage('Invalid semester'),
  body('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be A, B, or C'),
  body('department').isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Invalid department')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Student creation validation errors:', errors.array());
      console.log('❌ Request body:', req.body);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rollNumber, name, email, mobile, parentContact, password, batch, year, semester, section, department } = req.body;
    const currentUser = req.user;

    // Use standardized student creation service
    const result = await createStudentWithStandardizedData({
      currentUser,
      studentData: {
        rollNumber,
        name,
        email,
        mobile,
        parentContact,
        password
      },
      classContext: {
        batch,
        year,
        semester: semester || 'Sem 1',
        section: section || 'A',
        department
      }
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.message,
        details: result.error.details
      });
    }

    res.status(201).json({
      success: true,
      message: `Student created successfully for ${batch}, ${year}`,
      data: result.student
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
// @access  Faculty and above (Class Advisor)
router.put('/students/:id', authenticate, facultyAndAbove, [
  body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('parentContact').optional().matches(/^[0-9]{10}$/).withMessage('Parent contact must be exactly 10 digits'),
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
    const { name, email, mobile, parentContact, password } = req.body;
    const currentUser = req.user;

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if faculty is class advisor for this student's batch/year/semester/section
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      'assignedClasses.batch': student.batch,
      'assignedClasses.year': student.year,
      'assignedClasses.semester': semesterNumber,
      'assignedClasses.section': student.section || 'A',
      'assignedClasses.active': true,
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
    if (parentContact) student.parentContact = parentContact;
    await student.save();

    // Update user account
    const user = await User.findById(student.userId);
    if (user) {
      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      if (password) user.password = password; // Will be hashed by pre-save middleware
      await user.save();
    }

    // Return complete updated student data in the expected format
    const updatedStudent = {
      id: student._id,
      _id: student._id,
      userId: student.userId,
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email,
      mobile: student.mobile || '',
      parentContact: student.parentContact || '',
      department: student.department,
      batch: student.batch,
      year: student.year,
      semester: student.semester,
      section: faculty?.section || 'A'
    };

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Error updating student:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value. Please check email or mobile number.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @desc    Delete student for class advisor
// @route   DELETE /api/faculty/students/:id
// @access  Faculty and above (Class Advisor)
router.delete('/students/:id', authenticate, facultyAndAbove, async (req, res) => {
  try {
    console.log('🗑️ Delete student route hit:', req.params.id);
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

    // Check if faculty is class advisor for this student's batch/year/semester/section
    const semesterNumber = typeof student.semester === 'string' && student.semester.startsWith('Sem ') 
      ? parseInt(student.semester.replace('Sem ', '')) 
      : student.semester;
    
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      'assignedClasses.batch': student.batch,
      'assignedClasses.year': student.year,
      'assignedClasses.semester': semesterNumber,
      'assignedClasses.section': student.section || 'A',
      'assignedClasses.active': true,
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

// @desc    Delete student for class advisor (alternative route)
// @route   DELETE /api/faculty/delete-student/:id
// @access  Faculty and above (Class Advisor)
router.delete('/delete-student/:id', authenticate, facultyAndAbove, async (req, res) => {
  try {
    console.log('🗑️ Delete student (alt route) hit:', req.params.id);
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

    // Check if faculty is class advisor for this student's batch/year/semester/section
    const semesterNumber = typeof student.semester === 'string' && student.semester.startsWith('Sem ') 
      ? parseInt(student.semester.replace('Sem ', '')) 
      : student.semester;
    
    const faculty = await Faculty.findOne({ 
      userId: currentUser._id,
      'assignedClasses.batch': student.batch,
      'assignedClasses.year': student.year,
      'assignedClasses.semester': semesterNumber,
      'assignedClasses.section': student.section || 'A',
      'assignedClasses.active': true,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this student'
      });
    }

    // Soft delete: Mark student as inactive instead of hard delete
    await Student.findByIdAndUpdate(id, { 
      status: 'inactive',
      deletedAt: new Date(),
      deletedBy: currentUser._id
    });

    // Also mark user as inactive
    await User.findByIdAndUpdate(student.userId, { 
      status: 'inactive',
      deletedAt: new Date(),
      deletedBy: currentUser._id
    });

    // Cascade updates: Mark attendance records as inactive
    try {
      const Attendance = (await import('../models/Attendance.js')).default;
      await Attendance.updateMany(
        { studentId: id },
        { 
          status: 'inactive',
          deletedAt: new Date(),
          deletedBy: currentUser._id
        }
      );
      console.log('✅ Attendance records marked as inactive for student:', id);
    } catch (attendanceError) {
      console.error('⚠️ Error updating attendance records:', attendanceError.message);
    }

    // Cascade updates: Mark class attendance records as inactive
    try {
      const ClassAttendance = (await import('../models/ClassAttendance.js')).default;
      await ClassAttendance.updateMany(
        { 'students.studentId': id },
        { 
          $set: { 
            'students.$.status': 'inactive',
            'students.$.deletedAt': new Date(),
            'students.$.deletedBy': currentUser._id
          }
        }
      );
      console.log('✅ Class attendance records updated for student:', id);
    } catch (classAttendanceError) {
      console.error('⚠️ Error updating class attendance records:', classAttendanceError.message);
    }

    res.json({
      success: true,
      message: 'Student deleted successfully',
      data: {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @desc    Get assigned classes for class advisor
// @route   GET /api/faculty/assigned-classes
// @access  Faculty and above (Class Advisor)
router.get('/assigned-classes', facultyAndAbove, async (req, res) => {
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

// @desc    Add class assignment to faculty
// @route   POST /api/faculty/:id/assign-class
// @access  HOD and above
router.post('/:id/assign-class', hodAndAbove, [
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8'),
  body('section').isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C')
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
    const { batch, year, semester, section } = req.body;
    const currentUser = req.user;
    
    console.log('Class assignment validation:', { batch, year, semester, section });

    // Validate semester based on year
    const validSemesters = {
      "1st Year": [1, 2],
      "2nd Year": [3, 4],
      "3rd Year": [5, 6],
      "4th Year": [7, 8]
    };

    if (!validSemesters[year] || !validSemesters[year].includes(parseInt(semester))) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid semester for ${year}. Valid semesters are: ${validSemesters[year].join(', ')}`
      });
    }

    // Check if class is open for assignment (check if students exist for this batch/year/semester)
    const Student = require('../models/Student.js');
    const studentCount = await Student.countDocuments({
      batch,
      year,
      semester: `Sem ${semester}`,
      department: currentUser.department,
      status: 'active'
    });

    if (studentCount === 0) {
      return res.status(400).json({
        status: 'error',
        message: `No students found for ${year} | Semester ${semester} | Section ${section}. Class is not open for assignment.`
      });
    }

    console.log(`Class validation passed: ${studentCount} students found for ${year} | Semester ${semester}`);

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    // Check if faculty is in the same department
    if (faculty.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only assign faculty from your own department'
      });
    }

    // Check if another faculty is already assigned to this specific class
    // (This prevents multiple faculty per class, but allows one faculty to have multiple classes)
    const existingFaculty = await Faculty.findOne({
      _id: { $ne: id },
      department: currentUser.department,
      'assignedClasses.batch': batch,
      'assignedClasses.year': year,
      'assignedClasses.semester': semester,
      'assignedClasses.section': section,
      'assignedClasses.active': true,
      status: 'active'
    });

    if (existingFaculty) {
      return res.status(400).json({
        status: 'error',
        message: `Another faculty is already assigned as class advisor for ${year} | Semester ${semester} | Section ${section}`,
        existingFaculty: {
          name: existingFaculty.name,
          email: existingFaculty.email
        }
      });
    }

    // Check if this faculty is already assigned to this specific class
    const facultyAlreadyAssigned = await Faculty.findOne({
      _id: id,
      'assignedClasses.batch': batch,
      'assignedClasses.year': year,
      'assignedClasses.semester': semester,
      'assignedClasses.section': section,
      'assignedClasses.active': true
    });

    if (facultyAlreadyAssigned) {
      return res.status(400).json({
        status: 'error',
        message: `This faculty is already assigned as class advisor for ${year} | Semester ${semester} | Section ${section}`
      });
    }

    // Deactivate any currently active advisor assignment(s) for this faculty (old class)
    const ClassAssignment = (await import('../models/ClassAssignment.js')).default;
    const activeAssignmentsForFaculty = await ClassAssignment.find({ facultyId: faculty.userId, active: true });

    let oldAssignmentPayload = null;
    if (activeAssignmentsForFaculty.length > 0) {
      for (const a of activeAssignmentsForFaculty) {
        await a.deactivate(currentUser._id);
      }
      const a = activeAssignmentsForFaculty[0];
      oldAssignmentPayload = {
        batch: a.batch,
        year: a.year,
        semester: a.semester,
        section: a.section
      };
    }

    // Add the class assignment to Faculty model (active)
    await faculty.addClassAssignment({
      batch,
      year,
      semester,
      section,
      assignedBy: currentUser._id
    });

    // Also create a ClassAssignment record
    const classAssignment = await ClassAssignment.assignAdvisor({
      facultyId: faculty.userId, // Use the User ID, not Faculty ID
      batch,
      year,
      semester,
      section,
      departmentId: currentUser._id,
      assignedBy: currentUser._id,
      notes: `Assigned by HOD ${currentUser.name}`
    });

    // Update students' facultyId to point to the new class advisor's Faculty record
    // This ensures students are properly associated with the new advisor
    try {
      // Build classId to match students
      const normalizedYear = year;
      const normalizedSemester = `Sem ${semester}`;
      const classId = `${batch}_${normalizedYear}_${normalizedSemester}_${section}`;
      
      // Update students' facultyId for this class
      const updateResult = await Student.updateMany(
        {
          $or: [
            { classId: classId },
            {
              batch: batch,
              year: normalizedYear,
              semester: normalizedSemester,
              section: section,
              department: currentUser.department
            }
          ],
          status: 'active'
        },
        {
          $set: { facultyId: faculty._id }
        }
      );
      
      console.log(`✅ Updated ${updateResult.modifiedCount} students' facultyId to new class advisor`);
    } catch (error) {
      console.error('⚠️ Error updating students facultyId (non-critical):', error);
      // Don't fail the request if student update fails - assignment is still created
    }

    res.status(200).json({
      status: 'success',
      message: `Class advisor assigned successfully for ${year} | Semester ${semester} | Section ${section}`,
      data: {
        faculty: faculty,
        classAssignment: classAssignment,
        assignment: {
          batch,
          year,
          semester,
          section,
          assignedDate: new Date()
        },
        oldAssignment: oldAssignmentPayload
      }
    });
  } catch (error) {
    console.error('Error assigning class:', error);
    if (error.message === 'Faculty is already assigned to this class') {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while assigning class'
    });
  }
});

// @desc    Remove class assignment from faculty
// @route   DELETE /api/faculty/:id/class/:classId
// @access  HOD and above
router.delete('/:id/class/:classId', hodAndAbove, async (req, res) => {
  try {
    const { id, classId } = req.params;
    const currentUser = req.user;

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    // Check if faculty is in the same department
    if (faculty.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only manage faculty from your own department'
      });
    }

    // Find the specific class assignment
    const assignment = (faculty.assignedClasses || []).find(cls => cls._id.toString() === classId);
    if (!assignment || !assignment.active) {
      return res.status(404).json({
        status: 'error',
        message: 'Class assignment not found'
      });
    }
    
    console.log('Found assignment to remove:', assignment);

    // Remove the assignment from Faculty model
    await faculty.removeClassAssignment(
      assignment.batch,
      assignment.year,
      assignment.semester,
      assignment.section
    );

    // Also delete the ClassAssignment record completely
    const classAssignment = await ClassAssignment.findOne({
      facultyId: faculty.userId,
      batch: assignment.batch,
      year: assignment.year,
      semester: assignment.semester,
      section: assignment.section,
      active: true
    });

    if (classAssignment) {
      console.log('🔄 Completely removing ClassAssignment record:', classAssignment._id);
      await classAssignment.completeRemoval();
      console.log('✅ ClassAssignment record completely removed from all models');
    } else {
      console.log('⚠️ No active ClassAssignment record found to delete');
    }

    res.status(200).json({
      status: 'success',
      message: `Class advisor assignment completely removed from all models for ${assignment.year} | Semester ${assignment.semester} | Section ${assignment.section}`,
      data: {
        removedAssignment: {
          batch: assignment.batch,
          year: assignment.year,
          semester: assignment.semester,
          section: assignment.section
        },
        deletionResults: {
          facultyModel: 'Assignment removed from assignedClasses array',
          classAssignmentModel: classAssignment ? 'Record deleted' : 'No record found'
        }
      }
    });
  } catch (error) {
    console.error('Error removing class assignment:', error);
    if (error.message === 'Assignment not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while removing class assignment'
    });
  }
});

// @desc    Get faculty with detailed class assignments
// @route   GET /api/faculty/:id/assignments
// @access  HOD and above
router.get('/:id/assignments', hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    const faculty = await Faculty.findById(id)
      .populate('assignedClasses.assignedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    // Check if faculty is in the same department
    if (faculty.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only view faculty from your own department'
      });
    }

    const activeAssignments = faculty.getActiveAssignments();

    // Also get ClassAssignment records for this faculty
    const classAssignments = await ClassAssignment.find({
      facultyId: faculty.userId,
      active: true
    }).populate('facultyId', 'name email position');

    res.status(200).json({
      status: 'success',
      data: {
        faculty: {
          id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          position: faculty.position,
          department: faculty.department,
          status: faculty.status,
          phone: faculty.phone
        },
        assignments: activeAssignments,
        classAssignments: classAssignments,
        totalAssignments: activeAssignments.length,
        advisorStatus: faculty.getAdvisorAssignment()
      }
    });
  } catch (error) {
    console.error('Error fetching faculty assignments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching faculty assignments'
    });
  }
});

export default router;
