import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true,
    unique: false
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  classId: {
    type: String,
    required: false, // Made optional for migration compatibility
    trim: true
  },
  classAssigned: {
    type: String,
    required: [true, 'Class assignment is required'],
    enum: {
      values: ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '4C'],
      message: 'Class must be one of: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C, 4A, 4B, 4C'
    }
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    enum: {
      values: ['1st', '2nd', '3rd', '4th', '1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st, 2nd, 3rd, 4th, 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  batch: {
    type: String,
    required: [true, 'Batch is required'],
    match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  semester: {
    type: String,
    required: [true, 'Semester is required'],
    enum: {
      values: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
      message: 'Semester must be one of: Sem 1 ... Sem 8'
    }
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    enum: {
      values: ['A', 'B', 'C'],
      message: 'Section must be one of: A, B, C'
    },
    default: 'A'
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Class teacher assignment is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
      message: 'Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  phone: {
    type: String,
    trim: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Mobile number must be exactly 10 digits'
    }
  },
  parentContact: {
    type: String,
    required: [true, 'Parent contact is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Parent contact must be exactly 10 digits'
    }
  },
  address: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, {
  timestamps: true
});

// Pre-save middleware to auto-generate classId
studentSchema.pre('save', function(next) {
  if (!this.classId && this.batch && this.year && this.semester) {
    this.classId = `${this.batch}_${this.year}_${this.semester}_${this.section || 'A'}`;
  }
  next();
});

// Enforce that a student belongs to only one class and each roll number is unique within a class
studentSchema.index(
  { classId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { classId: { $exists: true, $ne: null }, status: 'active' },
    name: 'unique_student_per_class'
  }
);

studentSchema.index(
  { classId: 1, rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { classId: { $exists: true, $ne: null }, status: 'active' },
    name: 'unique_rollnumber_per_class'
  }
);

// Index for efficient querying by class
studentSchema.index({ classId: 1, status: 1 });

// Index for faculty queries
studentSchema.index({ facultyId: 1, status: 1 });

// Index for department queries
studentSchema.index({ department: 1, status: 1 });

// Legacy index for batch-based queries (for backward compatibility)
// Temporarily commented out to avoid index conflicts during migration
// studentSchema.index({ batch: 1, rollNumber: 1 }, { 
//   unique: true,
//   partialFilterExpression: { classId: { $exists: false } }
// });

// Remove password from JSON output (legacy safety if present)
studentSchema.methods.toJSON = function() {
  const studentObject = this.toObject();
  if (studentObject.password) delete studentObject.password;
  return studentObject;
};

export default mongoose.model('Student', studentSchema);
