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
    enum: {
      values: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', 'None'],
      message: 'Assigned class must be one of: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B, None'
    }
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

// Remove password from JSON output (legacy safety if present)
facultySchema.methods.toJSON = function() {
  const facultyObject = this.toObject();
  if (facultyObject.password) delete facultyObject.password;
  return facultyObject;
};

export default mongoose.model('Faculty', facultySchema);
