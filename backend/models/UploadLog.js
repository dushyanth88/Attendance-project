import mongoose from 'mongoose';

const uploadLogSchema = new mongoose.Schema({
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  classId: {
    type: String,
    required: true
  },
  batch: {
    type: String,
    required: true
  },
  year: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  totalRecords: {
    type: Number,
    required: true,
    default: 0
  },
  addedCount: {
    type: Number,
    required: true,
    default: 0
  },
  skippedCount: {
    type: Number,
    required: true,
    default: 0
  },
  errorCount: {
    type: Number,
    required: true,
    default: 0
  },
  addedStudents: [{
    rollNumber: String,
    name: String,
    email: String
  }],
  skippedStudents: [{
    rollNumber: String,
    name: String,
    email: String,
    reason: String
  }],
  errorStudents: [{
    rollNumber: String,
    name: String,
    email: String,
    error: String
  }],
  uploadStatus: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    required: true
  },
  processingTime: {
    type: Number, // in milliseconds
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
uploadLogSchema.index({ facultyId: 1, createdAt: -1 });
uploadLogSchema.index({ classId: 1, createdAt: -1 });

const UploadLog = mongoose.model('UploadLog', uploadLogSchema);

export default UploadLog;
