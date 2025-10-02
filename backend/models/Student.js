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
  classAssigned: {
    type: String,
    required: [true, 'Class assignment is required'],
    enum: {
      values: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'],
      message: 'Class must be one of: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B'
    }
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Class teacher assignment is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
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

// Compound unique index to enforce roll number unique within class
studentSchema.index({ classAssigned: 1, rollNumber: 1 }, { unique: true });

// Remove password from JSON output (legacy safety if present)
studentSchema.methods.toJSON = function() {
  const studentObject = this.toObject();
  if (studentObject.password) delete studentObject.password;
  return studentObject;
};

export default mongoose.model('Student', studentSchema);
