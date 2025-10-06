import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  holidayDate: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and Date during migration
    required: [true, 'Holiday date is required'],
    index: true,
    validate: {
      validator: function(v) {
        // Accept both YYYY-MM-DD string format and Date objects
        if (typeof v === 'string') {
          return /^\d{4}-\d{2}-\d{2}$/.test(v);
        }
        if (v instanceof Date) {
          return !isNaN(v.getTime());
        }
        return false;
      },
      message: 'Holiday date must be in YYYY-MM-DD format or a valid Date'
    }
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
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save hook to normalize dates to YYYY-MM-DD strings
holidaySchema.pre('save', function(next) {
  if (this.holidayDate instanceof Date) {
    // Convert Date to YYYY-MM-DD string
    this.holidayDate = this.holidayDate.toISOString().split('T')[0];
  } else if (typeof this.holidayDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(this.holidayDate)) {
    // If it's a string but not in YYYY-MM-DD format, try to convert it
    const date = new Date(this.holidayDate);
    if (!isNaN(date.getTime())) {
      this.holidayDate = date.toISOString().split('T')[0];
    }
  }
  next();
});

// Index for efficient querying by date range
holidaySchema.index({ holidayDate: 1, department: 1, isDeleted: 1 });

// Compound unique index to ensure holiday date is unique within each department (only for non-deleted holidays)
holidaySchema.index({ holidayDate: 1, department: 1 }, { 
  unique: true,
  partialFilterExpression: { isDeleted: false }
});

export default mongoose.model('Holiday', holidaySchema);
