import mongoose from 'mongoose';

const classAssignmentSchema = new mongoose.Schema({
  departmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  facultyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
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
  assignedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedDate: { 
    type: Date, 
    default: Date.now 
  },
  active: { 
    type: Boolean, 
    default: true 
  },
  // Additional metadata
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Track when assignment was deactivated
  deactivatedDate: {
    type: Date
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Attendance date range
  attendanceStartDate: {
    type: Date,
    default: null
  },
  attendanceEndDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to ensure only one active assignment per batch-year-semester-section
classAssignmentSchema.index({
  batch: 1,
  year: 1,
  semester: 1,
  section: 1,
  departmentId: 1
}, {
  unique: true,
  partialFilterExpression: { active: true },
  name: 'unique_active_assignment_per_section'
});

// Index for efficient faculty queries
classAssignmentSchema.index({
  facultyId: 1,
  active: 1
});

// Index for department queries
classAssignmentSchema.index({
  departmentId: 1,
  active: 1
});

// Virtual for formatted class display
classAssignmentSchema.virtual('classDisplay').get(function() {
  return `${this.year} | Semester ${this.semester} | Section ${this.section}`;
});

// Virtual for batch-year-semester-section key
classAssignmentSchema.virtual('classKey').get(function() {
  return `${this.batch}-${this.year}-${this.semester}-${this.section}`;
});

// Method to deactivate assignment
classAssignmentSchema.methods.deactivate = async function(deactivatedBy) {
  this.active = false;
  this.deactivatedDate = new Date();
  this.deactivatedBy = deactivatedBy;
  
  // Also remove from Faculty model
  const Faculty = (await import('./Faculty.js')).default;
  const faculty = await Faculty.findOne({ userId: this.facultyId });
  
  if (faculty) {
    faculty.assignedClasses = faculty.assignedClasses.filter(assignment => 
      !(assignment.batch === this.batch && 
        assignment.year === this.year && 
        assignment.semester === this.semester && 
        assignment.section === this.section)
    );
    await faculty.save();
  }
  
  return this.save();
};

// Method to completely remove assignment from both models
classAssignmentSchema.methods.completeRemoval = async function() {
  // Remove from Faculty model
  const Faculty = (await import('./Faculty.js')).default;
  const faculty = await Faculty.findOne({ userId: this.facultyId });
  
  if (faculty) {
    console.log('🔄 Removing assignment from Faculty model:', { 
      batch: this.batch, 
      year: this.year, 
      semester: this.semester, 
      section: this.section 
    });
    
    faculty.assignedClasses = faculty.assignedClasses.filter(assignment => 
      !(assignment.batch === this.batch && 
        assignment.year === this.year && 
        assignment.semester === this.semester && 
        assignment.section === this.section)
    );
    
    await faculty.save();
    console.log('✅ Assignment removed from Faculty model. Remaining assignments:', faculty.assignedClasses.length);
  }
  
  // Delete the ClassAssignment record completely
  await this.deleteOne();
  console.log('✅ ClassAssignment record deleted completely');
};

// Static method to get active assignments for a faculty
classAssignmentSchema.statics.getActiveAssignments = function(facultyId) {
  return this.find({ facultyId, active: true })
    .populate('assignedBy', 'name email')
    .sort({ assignedDate: -1 });
};

// Static method to get current advisor for a class
classAssignmentSchema.statics.getCurrentAdvisor = function(batch, year, semester, section, departmentId) {
  return this.findOne({
    batch,
    year,
    semester,
    section,
    departmentId,
    active: true
  }).populate('facultyId', 'name email position');
};

// Static method to assign new advisor (handles replacement)
classAssignmentSchema.statics.assignAdvisor = async function(assignmentData) {
  const { facultyId, batch, year, semester, section, departmentId, assignedBy, notes } = assignmentData;
  
  // Check if there's an existing active assignment
  const existingAssignment = await this.findOne({
    batch,
    year,
    semester,
    section,
    departmentId,
    active: true
  });

  // If exists, deactivate it
  if (existingAssignment) {
    await existingAssignment.deactivate(assignedBy);
  }

  // Create new assignment
  const newAssignment = new this({
    facultyId,
    batch,
    year,
    semester,
    section,
    departmentId,
    assignedBy,
    notes
  });

  const savedAssignment = await newAssignment.save();

  // Also update the Faculty model to keep both models in sync
  const Faculty = (await import('./Faculty.js')).default;
  const faculty = await Faculty.findOne({ userId: facultyId });
  
  if (faculty) {
    console.log('🔄 Updating Faculty model for assignment:', { batch, year, semester, section });
    
    // Remove any existing assignment for this class from Faculty model
    faculty.assignedClasses = faculty.assignedClasses.filter(assignment => 
      !(assignment.batch === batch && 
        assignment.year === year && 
        assignment.semester === semester && 
        assignment.section === section)
    );
    
    // Add new assignment to Faculty model
    faculty.assignedClasses.push({
      batch,
      year,
      semester,
      section,
      assignedBy,
      assignedDate: new Date(),
      active: true
    });
    
    await faculty.save();
    console.log('✅ Faculty model updated successfully. Total assignments:', faculty.assignedClasses.length);
  } else {
    console.log('⚠️ Faculty not found for userId:', facultyId);
  }

  return savedAssignment;
};

// Ensure virtual fields are included in JSON output
classAssignmentSchema.set('toJSON', { virtuals: true });
classAssignmentSchema.set('toObject', { virtuals: true });

export default mongoose.model('ClassAssignment', classAssignmentSchema);
