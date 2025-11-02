import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: String,
    required: true,
    trim: true
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  localDate: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Local date must be in YYYY-MM-DD format']
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'OD', 'Not Marked'],
    required: true,
    default: 'Not Marked'
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: ''
  },
  actionTaken: {
    type: String,
    trim: true,
    maxlength: [500, 'Action taken cannot exceed 500 characters'],
    default: ''
  },
  updatedBy: {
    type: String,
    enum: ['faculty', 'student', 'admin'],
    default: 'faculty'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure date has no time component (normalize to midnight)
attendanceSchema.pre('save', function(next) {
  if (this.date instanceof Date) {
    this.date.setHours(0, 0, 0, 0);
  }
  next();
});

// Unique attendance record per student per class per day
attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
