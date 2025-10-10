/**
 * Faculty Audit Log Model
 * Tracks all faculty ID resolution and student creation operations
 */

import mongoose from 'mongoose';

const facultyAuditLogSchema = new mongoose.Schema({
  operation: {
    type: String,
    enum: ['manual_create', 'bulk_upload', 'auto_repair', 'faculty_resolution'],
    required: true
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  classId: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    enum: ['user_session', 'class_mapping', 'batch_lookup', 'department_fallback', 'created_by_lookup', 'auto_repair'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentCount: {
    type: Number,
    default: 0
  },
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  details: {
    batch: String,
    year: String,
    semester: String,
    section: String,
    department: String,
    facultyName: String,
    resolutionTime: Number, // in milliseconds
    validationPassed: Boolean
  },
  status: {
    type: String,
    enum: ['success', 'partial_success', 'failed'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
facultyAuditLogSchema.index({ facultyId: 1, resolvedAt: -1 });
facultyAuditLogSchema.index({ classId: 1, resolvedAt: -1 });
facultyAuditLogSchema.index({ operation: 1, resolvedAt: -1 });
facultyAuditLogSchema.index({ userId: 1, resolvedAt: -1 });

export default mongoose.model('FacultyAuditLog', facultyAuditLogSchema);

