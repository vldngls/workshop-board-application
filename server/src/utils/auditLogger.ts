const { AuditLog } = require('../models/AuditLog')
const { SystemLog } = require('../models/SystemLog')

/**
 * Enhanced Audit Logger for Enterprise Security
 * Provides detailed change tracking with before/after states
 */

interface ChangeDetail {
  field: string
  oldValue: any
  newValue: any
  fieldType: 'financial' | 'assignment' | 'status' | 'metadata' | 'other'
}

interface AuditContext {
  req?: any
  userId?: string
  userEmail?: string
  userRole?: string
  userName?: string
  ip?: string
  userAgent?: string
  method?: string
  path?: string
  requestBody?: any
}

/**
 * Classify field types for better security tracking
 */
function classifyFieldType(field: string): ChangeDetail['fieldType'] {
  const financialFields = [
    'timeRange', 'actualEndTime', 'date', 'assignedTechnician',
    'jobList', 'parts', 'status', 'qiStatus'
  ]
  
  const assignmentFields = [
    'assignedTechnician', 'serviceAdvisor', 'assignedTo'
  ]
  
  const statusFields = [
    'status', 'qiStatus', 'carriedOver', 'isImportant'
  ]
  
  if (financialFields.includes(field)) return 'financial'
  if (assignmentFields.includes(field)) return 'assignment'
  if (statusFields.includes(field)) return 'status'
  if (field.startsWith('_') || field === 'updatedAt' || field === 'createdAt') return 'metadata'
  
  return 'other'
}

/**
 * Check if changes are suspicious
 */
function detectSuspiciousActivity(
  changes: ChangeDetail[],
  entityType: string,
  beforeState: any,
  afterState: any
): { isSuspicious: boolean; reason: string | null } {
  // Check for completed job modifications
  if (entityType === 'JobOrder') {
    if (beforeState?.status === 'CP' || beforeState?.status === 'FR') {
      const hasFinancialChanges = changes.some(c => 
        c.fieldType === 'financial' && 
        ['timeRange', 'date', 'assignedTechnician'].includes(c.field)
      )
      if (hasFinancialChanges) {
        return {
          isSuspicious: true,
          reason: 'Attempted to modify financial fields of completed job order'
        }
      }
    }
    
    // Check for modification of old jobs (>30 days)
    if (beforeState?.date) {
      const jobDate = new Date(beforeState.date)
      const daysOld = (Date.now() - jobDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysOld > 30) {
        const hasFinancialChanges = changes.some(c => 
          c.fieldType === 'financial'
        )
        if (hasFinancialChanges) {
          return {
            isSuspicious: true,
            reason: `Attempted to modify financial fields of job order older than ${Math.floor(daysOld)} days`
          }
        }
      }
    }
    
    // Check for rapid status changes that might indicate fraud
    if (changes.some(c => c.field === 'status')) {
      const statusChange = changes.find(c => c.field === 'status')
      if (statusChange?.oldValue === 'OG' && statusChange?.newValue === 'CP') {
        return {
          isSuspicious: true,
          reason: 'Rapid status change from Ongoing to Complete (potential fraud)'
        }
      }
    }
    
    // Check for unusual time modifications
    const timeRangeChange = changes.find(c => c.field === 'timeRange')
    if (timeRangeChange) {
      const oldDuration = calculateTimeDuration(timeRangeChange.oldValue)
      const newDuration = calculateTimeDuration(timeRangeChange.newValue)
      const difference = Math.abs(newDuration - oldDuration)
      if (difference > 2) { // More than 2 hours difference
        return {
          isSuspicious: true,
          reason: `Unusual time range modification: ${oldDuration}h -> ${newDuration}h (${difference}h difference)`
        }
      }
    }
  }
  
  return { isSuspicious: false, reason: null }
}

function calculateTimeDuration(timeRange: any): number {
  if (!timeRange || !timeRange.start || !timeRange.end) return 0
  const [startHour, startMin] = timeRange.start.split(':').map(Number)
  const [endHour, endMin] = timeRange.end.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  return (endMinutes - startMinutes) / 60
}

/**
 * Determine severity level
 */
function determineSeverity(
  action: string,
  entityType: string,
  changes: ChangeDetail[],
  isSuspicious: boolean
): 'low' | 'medium' | 'high' | 'critical' {
  if (isSuspicious) return 'critical'
  if (action === 'delete' && entityType === 'JobOrder') return 'high'
  if (changes.some(c => c.fieldType === 'financial')) return 'high'
  if (action === 'status_change' && entityType === 'JobOrder') return 'medium'
  if (action === 'assignment_change') return 'medium'
  return 'low'
}

/**
 * Determine if approval is required
 * NOTE: Dual approval removed - single job controller scenario
 * All changes are logged but none require approval workflow
 */
function requiresApproval(
  action: string,
  entityType: string,
  changes: ChangeDetail[],
  beforeState: any
): boolean {
  // Dual approval removed - single job controller
  // All changes are logged with full audit trail for review
  return false
}

/**
 * Extract changes between two states
 */
function extractChanges(
  beforeState: any,
  afterState: any,
  excludeFields: string[] = ['updatedAt', '_id', '__v']
): ChangeDetail[] {
  if (!beforeState || !afterState) return []
  
  const changes: ChangeDetail[] = []
  const allKeys = new Set([
    ...Object.keys(beforeState || {}),
    ...Object.keys(afterState || {})
  ])
  
  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue
    
    const oldVal = beforeState?.[key]
    const newVal = afterState?.[key]
    
    // Deep comparison for objects/arrays
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        fieldType: classifyFieldType(key)
      })
    }
  }
  
  return changes
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return null
  
  const sanitized = { ...body }
  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'authorization']
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  })
  
  return sanitized
}

/**
 * Log audit event
 */
async function audit(
  action: string,
  entityType: 'JobOrder' | 'User' | 'Appointment' | 'System',
  entityId: string,
  context: AuditContext,
  beforeState?: any,
  afterState?: any
): Promise<void> {
  try {
    const changes = beforeState && afterState 
      ? extractChanges(beforeState, afterState)
      : []
    
    const suspicious = beforeState && afterState
      ? detectSuspiciousActivity(changes, entityType, beforeState, afterState)
      : { isSuspicious: false, reason: null }
    
    const severity = determineSeverity(action, entityType, changes, suspicious.isSuspicious)
    const needsApproval = requiresApproval(action, entityType, changes, beforeState)
    
    const auditLog = {
      action,
      entityType,
      entityId: String(entityId),
      userId: context.userId || context.req?.user?.sub || 'system',
      userEmail: context.userEmail || context.req?.user?.email,
      userRole: context.userRole || context.req?.user?.role,
      userName: context.userName,
      changes,
      beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
      afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
      ip: context.ip || 
          context.req?.headers['x-forwarded-for']?.toString().split(',')[0] || 
          context.req?.socket?.remoteAddress || 
          'unknown',
      userAgent: context.userAgent || context.req?.headers['user-agent'],
      method: context.method || context.req?.method,
      path: context.path || context.req?.path,
      requestBody: sanitizeRequestBody(context.requestBody || context.req?.body),
      isSuspicious: suspicious.isSuspicious,
      suspiciousReason: suspicious.reason,
      requiresApproval: needsApproval,
      severity,
      description: `${action} ${entityType} ${entityId}`
    }
    
    await AuditLog.create(auditLog)
    
    // Also log to system log for immediate visibility
    if (suspicious.isSuspicious || severity === 'critical' || severity === 'high') {
      await SystemLog.create({
        level: suspicious.isSuspicious ? 'error' : 'warn',
        message: `[SECURITY] ${auditLog.description}`,
        context: {
          action,
          entityType,
          entityId,
          suspicious: suspicious.isSuspicious,
          reason: suspicious.reason,
          severity
        },
        userId: auditLog.userId,
        userEmail: auditLog.userEmail,
        userRole: auditLog.userRole,
        ip: auditLog.ip,
        method: auditLog.method,
        path: auditLog.path
      })
    }
  } catch (err) {
    console.error('[AUDIT LOGGER] Failed to write audit log:', err)
    // Don't throw - audit logging failure shouldn't break the request
  }
}

module.exports = {
  audit,
  extractChanges,
  detectSuspiciousActivity,
  classifyFieldType
}

