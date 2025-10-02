import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  status: {
    type: String,
    enum: ['Present', 'Absent'],
    required: true,
    default: 'Present'
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: ''
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

// Unique attendance record per student per day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
