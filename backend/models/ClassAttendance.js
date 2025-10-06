import mongoose from 'mongoose';

const classAttendanceSchema = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
    enum: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']
  },
  date: {
    type: Date,
    required: true
  },
  absentRollNumbers: [{
    type: Number,
    required: true
  }],
  presentRollNumbers: [{
    type: Number,
    required: true
  }],
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Normalize date to midnight before save
classAttendanceSchema.pre('save', function(next) {
  if (this.date instanceof Date) {
    this.date.setHours(0, 0, 0, 0);
  }
  next();
});

// Unique per class and date
classAttendanceSchema.index({ classId: 1, date: 1 }, { unique: true });

export default mongoose.model('ClassAttendance', classAttendanceSchema);




