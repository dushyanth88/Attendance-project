import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  holidayDate: {
    type: Date,
    required: [true, 'Holiday date is required'],
    index: true
  },
  reason: {
    type: String,
    required: [true, 'Holiday reason is required'],
    trim: true,
    maxlength: [255, 'Reason cannot exceed 255 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
      message: 'Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure holiday date has no time component (normalize to midnight)
holidaySchema.pre('save', function(next) {
  if (this.holidayDate instanceof Date) {
    this.holidayDate.setHours(0, 0, 0, 0);
  }
  next();
});

// Index for efficient querying by date range
holidaySchema.index({ holidayDate: 1, department: 1, isActive: 1 });

// Compound unique index to ensure holiday date is unique within each department
holidaySchema.index({ holidayDate: 1, department: 1 }, { unique: true });

export default mongoose.model('Holiday', holidaySchema);
