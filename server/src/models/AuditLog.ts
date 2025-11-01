const mongoose = require('mongoose')

/**
 * Enhanced Audit Log Model for Enterprise Security
 * Tracks all changes with before/after states for forensic analysis
 * This model should be immutable - logs should never be deleted or modified
 */
const AuditLogSchema = new mongoose.Schema({
  // Action metadata
  action: { 
    type: String, 
    required: true,
    enum: ['create', 'update', 'delete', 'status_change', 'assignment_change', 'financial_change', 'login', 'logout', 'permission_denied']
  },
  entityType: { 
    type: String, 
    required: true,
    enum: ['JobOrder', 'User', 'Appointment', 'System']
  },
  entityId: { 
    type: String, 
    required: true,
    index: true 
  },
  
  // User information
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  userEmail: { type: String },
  userRole: { type: String },
  userName: { type: String },
  
  // Change tracking (before/after for updates)
  changes: [{
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    fieldType: { type: String } // 'financial', 'assignment', 'status', 'metadata', 'other'
  }],
  beforeState: { type: Object }, // Full document state before change
  afterState: { type: Object },   // Full document state after change
  
  // Request context
  ip: { type: String, index: true },
  userAgent: { type: String },
  method: { type: String },
  path: { type: String },
  requestBody: { type: Object }, // Sanitized request body
  
  // Security flags
  isSuspicious: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  suspiciousReason: { type: String },
  requiresApproval: { type: Boolean, default: false },
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: null 
  },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  
  // Additional context
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true 
  },
  description: { type: String },
  context: { type: Object, default: {} },
  
  // Timestamps
  timestamp: { type: Date, default: Date.now, index: true },
}, { 
  timestamps: true,
  // Prevent updates and deletes at schema level
  strict: true
})

// Indexes for efficient querying
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 })
AuditLogSchema.index({ userId: 1, timestamp: -1 })
AuditLogSchema.index({ severity: 1, timestamp: -1 })
AuditLogSchema.index({ isSuspicious: 1, timestamp: -1 })

// Prevent updates - make logs immutable
AuditLogSchema.pre('updateOne', function() {
  throw new Error('Audit logs are immutable and cannot be updated')
})

AuditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Audit logs are immutable and cannot be updated')
})

AuditLogSchema.pre('deleteOne', function() {
  throw new Error('Audit logs are immutable and cannot be deleted')
})

AuditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('Audit logs are immutable and cannot be deleted')
})

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)

module.exports = { AuditLog }

