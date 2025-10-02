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
  year: {
    type: String,
    required: [true, 'Year is required'],
    enum: {
      values: ['1st', '2nd', '3rd', '4th'],
      message: 'Year must be one of: 1st, 2nd, 3rd, 4th'
    }
  },
  semester: {
    type: String,
    required: [true, 'Semester is required'],
    enum: {
      values: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
      message: 'Semester must be one of: Sem 1 ... Sem 8'
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
