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
  // Class Advisor fields - Legacy support
  is_class_advisor: {
    type: Boolean,
    default: false
  },
  batch: {
    type: String,
    required: function() { return this.is_class_advisor && this.assignedClasses.length === 0; },
    match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  year: {
    type: String,
    required: function() { return this.is_class_advisor && this.assignedClasses.length === 0; },
    enum: {
      values: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  semester: {
    type: Number,
    required: function() { return this.is_class_advisor && this.assignedClasses.length === 0; },
    min: [1, 'Semester must be between 1 and 8'],
    max: [8, 'Semester must be between 1 and 8']
  },
  section: {
    type: String,
    required: function() { return this.is_class_advisor && this.assignedClasses.length === 0; },
    enum: {
      values: ['A', 'B', 'C'],
      message: 'Section must be one of: A, B, C'
    },
    trim: true
  },
  // New multiple class advisor assignments
  assignedClasses: {
    type: [{
    batch: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
      trim: true
    },
    year: {
      type: String,
      required: true,
      enum: {
        values: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
        message: 'Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year'
      }
    },
    semester: {
      type: Number,
      required: true,
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8']
    },
    section: {
      type: String,
      required: true,
      enum: {
        values: ['A', 'B', 'C'],
        message: 'Section must be one of: A, B, C'
      },
      trim: true
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  }],
  default: []
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
  const activeAssignments = (this.assignedClasses || []).filter(cls => cls.active);
  
  if (activeAssignments.length > 0) {
    if (activeAssignments.length === 1) {
      const cls = activeAssignments[0];
      return `Class Advisor for Batch ${cls.batch}, ${cls.year}, Semester ${cls.semester}, Section ${cls.section}`;
    } else {
      return `Class Advisor for ${activeAssignments.length} classes`;
    }
  } else if (this.is_class_advisor) {
    // Legacy support
    return `Class Advisor for Batch ${this.batch}, ${this.year}, Semester ${this.semester}, Section ${this.section}`;
  }
  return 'Not a Class Advisor';
};

// Method to check if faculty can be assigned as advisor
facultySchema.methods.canBeAssignedAsAdvisor = function() {
  return this.status === 'active';
};

// Method to get active assigned classes
facultySchema.methods.getActiveAssignments = function() {
  return (this.assignedClasses || []).filter(cls => cls.active);
};

// Method to add a new class assignment
facultySchema.methods.addClassAssignment = function(assignmentData) {
  const { batch, year, semester, section, assignedBy } = assignmentData;
  
  
  // Check if already assigned to this class
  const existingAssignment = (this.assignedClasses || []).find(cls => 
    cls.batch === batch && 
    cls.year === year && 
    cls.semester === semester && 
    cls.section === section && 
    cls.active
  );
  
  if (existingAssignment) {
    throw new Error('Faculty is already assigned to this class');
  }
  
  // Initialize assignedClasses if it doesn't exist
  if (!this.assignedClasses) {
    this.assignedClasses = [];
  }
  
  this.assignedClasses.push({
    batch,
    year,
    semester,
    section,
    assignedBy,
    assignedDate: new Date(),
    active: true
  });
  
  // Update legacy fields for backward compatibility
  if (this.assignedClasses.length === 1) {
    this.is_class_advisor = true;
    this.batch = batch;
    this.year = year;
    this.semester = semester;
    this.section = section;
  }
  
  return this.save();
};

// Method to remove a class assignment
facultySchema.methods.removeClassAssignment = function(batch, year, semester, section) {
  console.log('Removing class assignment from Faculty model:', { batch, year, semester, section });
  console.log('Current assignedClasses:', this.assignedClasses);
  
  const assignment = (this.assignedClasses || []).find(cls => 
    cls.batch === batch && 
    cls.year === year && 
    cls.semester === semester && 
    cls.section === section && 
    cls.active
  );
  
  if (!assignment) {
    console.log('Assignment not found in Faculty model');
    throw new Error('Assignment not found');
  }
  
  console.log('Found assignment to remove:', assignment);
  
  // Remove the assignment from the array completely
  this.assignedClasses = (this.assignedClasses || []).filter(cls => 
    !(cls.batch === batch && 
      cls.year === year && 
      cls.semester === semester && 
      cls.section === section && 
      cls.active)
  );
  
  console.log('Assignment removed from assignedClasses array. New length:', this.assignedClasses.length);
  
  // Update legacy fields based on remaining assignments
  const activeAssignments = this.getActiveAssignments();
  if (activeAssignments.length === 0) {
    this.is_class_advisor = false;
    this.batch = undefined;
    this.year = undefined;
    this.semester = undefined;
    this.section = undefined;
  } else if (activeAssignments.length === 1) {
    // Update legacy fields to match the remaining assignment
    const remaining = activeAssignments[0];
    this.batch = remaining.batch;
    this.year = remaining.year;
    this.semester = remaining.semester;
    this.section = remaining.section;
  }
  
  console.log('Saving Faculty model after removing assignment...');
  return this.save();
};

// Remove password from JSON output (legacy safety if present)
facultySchema.methods.toJSON = function() {
  const facultyObject = this.toObject();
  if (facultyObject.password) delete facultyObject.password;
  return facultyObject;
};

// Compound unique index to ensure only one class advisor per batch/year/semester/section/department
facultySchema.index({
  batch: 1,
  year: 1,
  semester: 1,
  section: 1,
  department: 1
}, { 
  unique: true, 
  partialFilterExpression: { is_class_advisor: true, status: 'active' },
  name: 'unique_class_advisor_per_section'
});

// Index for assignedClasses queries
facultySchema.index({
  'assignedClasses.batch': 1,
  'assignedClasses.year': 1,
  'assignedClasses.semester': 1,
  'assignedClasses.section': 1,
  'assignedClasses.active': 1
}, {
  name: 'assigned_classes_index'
});

export default mongoose.model('Faculty', facultySchema);
