import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    enum: {
      values: ['Assistant Professor', 'Associate Professor', 'Professor'],
      message: 'Position must be one of: Assistant Professor, Associate Professor, Professor'
    }
  },
  assignedClass: {
    type: String,
    required: [true, 'Assigned class is required'],
    trim: true,
    default: 'None'
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
  // Class Advisor fields
  is_class_advisor: {
    type: Boolean,
    default: false
  },
  batch: {
    type: String,
    required: function() { return this.is_class_advisor; },
    match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  year: {
    type: String,
    required: function() { return this.is_class_advisor; },
    enum: {
      values: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  semester: {
    type: Number,
    required: function() { return this.is_class_advisor; },
    min: [1, 'Semester must be between 1 and 8'],
    max: [8, 'Semester must be between 1 and 8']
  },
  section: {
    type: String,
    required: function() { return this.is_class_advisor; },
    enum: {
      values: ['A', 'B', 'C'],
      message: 'Section must be one of: A, B, C'
    },
    trim: true
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

// Method to get advisor assignment display string
facultySchema.methods.getAdvisorAssignment = function() {
  if (this.is_class_advisor) {
    return `Class Advisor for Batch ${this.batch}, ${this.year}, Semester ${this.semester}, Section ${this.section}`;
  }
  return 'Not a Class Advisor';
};

// Method to check if faculty can be assigned as advisor
facultySchema.methods.canBeAssignedAsAdvisor = function() {
  return this.status === 'active';
};

// Remove password from JSON output (legacy safety if present)
facultySchema.methods.toJSON = function() {
  const facultyObject = this.toObject();
  if (facultyObject.password) delete facultyObject.password;
  return facultyObject;
};

export default mongoose.model('Faculty', facultySchema);
