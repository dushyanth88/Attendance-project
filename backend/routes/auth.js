import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authenticate, generateTokens, verifyToken } from '../middleware/auth.js';
import config from '../config/config.js';

const router = express.Router();

// Generate JWT Token (legacy function for compatibility)
const generateToken = (id) => {
  const tokens = generateTokens(id);
  return tokens.accessToken;
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'principal', 'hod', 'faculty', 'student']).withMessage('Invalid role')
], async (req, res) => {
  try {
    console.log('\n🔐 LOGIN ATTEMPT STARTED');
    console.log('📧 Request body:', { 
      email: req.body.email, 
      role: req.body.role, 
      passwordLength: req.body.password?.length 
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ 
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, role } = req.body;
    const normalizedRole = role.toLowerCase().trim();
    
    console.log('🔍 Searching for user with:', { 
      email: email.toLowerCase(), 
      role: normalizedRole 
    });

    // Step 1: Check if user exists by email only
    const userByEmail = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      status: 'active' 
    });
    
    console.log('👤 User found by email:', userByEmail ? 'Yes' : 'No');
    console.log('🔍 Database query:', { email: email.toLowerCase().trim(), status: 'active' });
    
    if (!userByEmail) {
      console.log('❌ User not found with email:', email);
      console.log('🔍 Available users in database:');
      const allUsers = await User.find({}, 'email role status');
      allUsers.forEach(u => console.log(`   - ${u.email} (${u.role}, status: ${u.status})`));
      return res.status(401).json({ 
        success: false,
        msg: 'User not found' 
      });
    }

    // Step 2: Check role match
    console.log('🎭 Checking role match:');
    console.log('   - Requested role:', normalizedRole);
    console.log('   - User role:', userByEmail.role);
    console.log('   - Role match:', userByEmail.role === normalizedRole);

    if (userByEmail.role !== normalizedRole) {
      console.log('❌ Role mismatch');
      return res.status(401).json({ 
        success: false,
        msg: 'Role mismatch' 
      });
    }

    // Step 3: Check password
    console.log('🔑 Checking password...');
    const isPasswordMatch = await userByEmail.comparePassword(password);
    console.log('🔑 Password match:', isPasswordMatch);

    if (!isPasswordMatch) {
      console.log('❌ Incorrect password');
      return res.status(401).json({ 
        success: false,
        msg: 'Incorrect password' 
      });
    }

    // Step 4: Generate tokens
    console.log('🎫 Generating JWT tokens...');
    const { accessToken, refreshToken } = generateTokens(userByEmail._id);
    console.log('✅ Tokens generated successfully');

    const responseData = {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: userByEmail._id,
        name: userByEmail.name,
        email: userByEmail.email,
        role: userByEmail.role,
        department: userByEmail.department,
        class: userByEmail.class,
        assignedClass: userByEmail.assignedClasses && userByEmail.assignedClasses.length > 0 ? userByEmail.assignedClasses[0] : undefined,
        subjects: userByEmail.subjects,
        assignedClasses: userByEmail.assignedClasses,
        status: userByEmail.status,
        lastLogin: userByEmail.lastLogin
      }
    };

    console.log('✅ LOGIN SUCCESSFUL for user:', userByEmail.email);
    console.log('📤 Sending response with user data');
    
    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 LOGIN ERROR:', error);
    res.status(500).json({ 
      success: false,
      msg: 'Server error' 
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    let assignedClass = req.user.assignedClasses && req.user.assignedClasses.length > 0 ? req.user.assignedClasses[0] : undefined;
    
    // If user is faculty and no assignedClass found in user object, check Faculty model
    if (req.user.role === 'faculty' && !assignedClass) {
      const Faculty = (await import('../models/Faculty.js')).default;
      const facultyDoc = await Faculty.findOne({ userId: req.user._id });
      if (facultyDoc && facultyDoc.assignedClass && facultyDoc.assignedClass !== 'None') {
        assignedClass = facultyDoc.assignedClass;
      }
    }

    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
        class: req.user.class,
        assignedClass: assignedClass,
        subjects: req.user.subjects,
        assignedClasses: req.user.assignedClasses,
        status: req.user.status,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
        profileImage: req.user.profileImage
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      msg: 'Server error' 
    });
  }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        msg: 'Refresh token required' 
      });
    }

    const decoded = verifyToken(refreshToken);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.status !== 'active') {
      return res.status(401).json({ 
        success: false,
        msg: 'Invalid refresh token' 
      });
    }

    const { accessToken } = generateTokens(user._id);

    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      msg: 'Invalid refresh token' 
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a more sophisticated system, you would blacklist the token
    // For now, we'll just return success
    res.status(200).json({
      success: true,
      msg: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      msg: 'Server error' 
    });
  }
});

// @desc    Create sample users (for development)
// @route   POST /api/auth/seed
// @access  Public (remove in production)
router.post('/seed', async (req, res) => {
  try {
    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return res.status(400).json({ msg: 'Users already exist' });
    }

    const sampleUsers = [
      {
        name: 'System Admin',
        email: 'admin@attendance.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        name: 'Dr. Sarah Johnson',
        email: 'principal@attendance.com',
        password: 'principal123',
        role: 'principal'
      },
      {
        name: 'Prof. Michael Chen',
        email: 'hod@attendance.com',
        password: 'hod123',
        role: 'hod',
        department: 'Computer Science'
      },
      {
        name: 'Dr. Emily Davis',
        email: 'faculty@attendance.com',
        password: 'faculty123',
        role: 'faculty',
        department: 'Computer Science'
      },
      {
        name: 'John Smith',
        email: 'student@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Computer Science'
      }
    ];

    const users = await User.insertMany(sampleUsers);

    res.status(201).json({
      msg: 'Sample users created successfully',
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }))
    });

  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @desc    Create new user (Admin can create any user, HOD can create faculty)
// @route   POST /api/auth/users/create
// @access  Private (Admin or HOD)
router.post('/users/create', authenticate, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['principal', 'hod', 'faculty']).withMessage('Invalid role'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters')
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

    const { name, email, password, role, department } = req.body;
    const currentUser = req.user;

    // Check authorization based on role
    if (currentUser.role === 'hod') {
      // HOD can only create faculty in their own department
      if (role !== 'faculty') {
        return res.status(403).json({
          success: false,
          msg: 'HOD can only create faculty members'
        });
      }
      if (!department || department !== currentUser.department) {
        return res.status(403).json({
          success: false,
          msg: 'HOD can only create faculty in their own department'
        });
      }
    } else if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        msg: 'Only Admin and HOD can create users'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: 'User with this email already exists'
      });
    }

    // Validate role-specific requirements
    if (['hod', 'faculty'].includes(role) && !department) {
      return res.status(400).json({
        success: false,
        msg: 'Department is required for this role'
      });
    }

    // Create user
    const userData = {
      name,
      email: email.toLowerCase(),
      password,
      role,
      department: role === 'principal' ? null : department,
      createdBy: currentUser._id
    };

    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      msg: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

export default router;
