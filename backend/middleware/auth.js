import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/config.js';

// Generate JWT tokens
export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '15m'
  });
  
  const refreshToken = jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '7d'
  });
  
  return { accessToken, refreshToken };
};

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        msg: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        msg: 'Token is not valid. User not found.' 
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ 
        success: false,
        msg: 'Account is inactive or suspended.' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        msg: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        msg: 'Token expired.' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      msg: 'Server error during authentication.' 
    });
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        msg: 'Authentication required.' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        msg: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    next();
  };
};

// Admin only middleware
export const adminOnly = authorize('admin');

// Faculty and above middleware
export const facultyAndAbove = authorize('admin', 'principal', 'hod', 'faculty');

// HOD and above middleware
export const hodAndAbove = authorize('admin', 'principal', 'hod');

// Principal and above middleware
export const principalAndAbove = authorize('admin', 'principal');

// Department access middleware
export const departmentAccess = (req, res, next) => {
  const userDepartment = req.user.department;
  const requestedDepartment = req.params.department || req.body.department;

  if (req.user.role === 'admin' || req.user.role === 'principal') {
    return next(); // Admin and Principal can access all departments
  }

  if (userDepartment && requestedDepartment && userDepartment !== requestedDepartment) {
    return res.status(403).json({ 
      success: false,
      msg: 'Access denied. You can only access your department data.' 
    });
  }

  next();
};

// Self or admin access middleware
export const selfOrAdmin = (req, res, next) => {
  const userId = req.params.id || req.params.userId;
  
  if (req.user.role === 'admin' || req.user._id.toString() === userId) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false,
    msg: 'Access denied. You can only access your own data.' 
  });
};
