import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import attendanceRoutes from './routes/attendance.js';
import facultyRoutes from './routes/faculty.js';
import studentRoutes from './routes/student.js';
import reportRoutes from './routes/report.js';
import holidayRoutes from './routes/holiday.js';
import bulkUploadRoutes from './routes/bulkUpload.js';
import studentBulkUploadRoutes from './routes/studentBulkUpload.js';
import classAssignmentRoutes from './routes/classAssignment.js';
import config from './config/config.js';
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import Holiday from './models/Holiday.js';
import Faculty from './models/Faculty.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Ensure indexes are in sync with schema (drops obsolete indexes like rollNumber_1)
try {
  Student.syncIndexes()
    .then(() => console.log('✅ Student indexes synced'))
    .catch(err => console.error('⚠️  Student index sync error:', err?.message || err));
  Attendance.syncIndexes()
    .then(() => console.log('✅ Attendance indexes synced'))
    .catch(err => console.error('⚠️  Attendance index sync error:', err?.message || err));
  Holiday.syncIndexes()
    .then(() => console.log('✅ Holiday indexes synced'))
    .catch(err => console.error('⚠️  Holiday index sync error:', err?.message || err));
  Faculty.syncIndexes()
    .then(() => console.log('✅ Faculty indexes synced'))
    .catch(err => console.error('⚠️  Faculty index sync error:', err?.message || err));
} catch (e) {
  console.error('⚠️  Index sync init error:', e?.message || e);
}

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', studentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/students', studentBulkUploadRoutes);
app.use('/api/class-assignment', classAssignmentRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Attendance Tracker API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation route
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Attendance Tracker API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout'
      },
      admin: {
        users: 'GET /api/admin/users',
        createUser: 'POST /api/admin/users',
        updateUser: 'PUT /api/admin/users/:id',
        deleteUser: 'DELETE /api/admin/users/:id',
        dashboard: 'GET /api/admin/dashboard'
      },
      attendance: {
        mark: 'POST /api/attendance/mark',
        student: 'GET /api/attendance/student/:studentId',
        class: 'GET /api/attendance/class/:className',
        department: 'GET /api/attendance/department/:department',
        update: 'PUT /api/attendance/:id'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    msg: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false,
    msg: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Attendance Tracker API Server`);
  console.log(`📡 Running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`🔐 Admin login: admin@attendance.com / password123`);
});
