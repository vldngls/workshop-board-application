/**
 * JWT Security Enhancements
 * Adds additional security layers to prevent token theft and unauthorized access
 */

const { AuditLog } = require('../models/AuditLog')
const logger = require('../utils/logger')

// Store for active sessions (in production, use Redis or similar)
interface Session {
  userId: string
  tokenId: string
  ip: string
  userAgent: string
  createdAt: number
  lastActivity: number
}

class SessionStore {
  private sessions: Map<string, Session> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const maxAge = 8 * 60 * 60 * 1000 // 8 hours (token expiry)
      for (const [tokenId, session] of this.sessions.entries()) {
        if (now - session.lastActivity > maxAge) {
          this.sessions.delete(tokenId)
        }
      }
    }, 10 * 60 * 1000)
  }

  createSession(tokenId: string, userId: string, ip: string, userAgent: string): void {
    this.sessions.set(tokenId, {
      userId,
      tokenId,
      ip,
      userAgent,
      createdAt: Date.now(),
      lastActivity: Date.now()
    })
  }

  getSession(tokenId: string): Session | null {
    return this.sessions.get(tokenId) || null
  }

  updateActivity(tokenId: string): void {
    const session = this.sessions.get(tokenId)
    if (session) {
      session.lastActivity = Date.now()
    }
  }

  removeSession(tokenId: string): void {
    this.sessions.delete(tokenId)
  }

  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId)
  }
}

const sessionStore = new SessionStore()

/**
 * Generate a unique token ID (JTI - JWT ID) for tracking
 */
function generateTokenId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Enhanced JWT verification with IP and session validation
 */
function verifyTokenWithSecurity(req: any, tokenPayload: any, tokenId: string): { valid: boolean; reason?: string } {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
             req.socket?.remoteAddress || 
             'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'

  // Check if token has a session
  const session = sessionStore.getSession(tokenId)
  
  if (!session) {
    // First time seeing this token, create session
    sessionStore.createSession(tokenId, tokenPayload.sub, ip, userAgent)
    return { valid: true }
  }

  // Validate session matches current request
  if (session.ip !== ip) {
    // Different IP - potential token theft or user moved networks
    // Log as suspicious but allow (user might be on mobile/VPN)
    logger.warn('Token used from different IP', {
      userId: tokenPayload.sub,
      originalIp: session.ip,
      newIp: ip,
      tokenId
    })
    
    // For enterprise security, you might want to invalidate here
    // For now, we'll allow but log heavily
    sessionStore.updateActivity(tokenId)
    
    // Log as audit event
    AuditLog.create({
      action: 'login',
      entityType: 'System',
      entityId: 'security',
      userId: tokenPayload.sub,
      ip,
      userAgent,
      isSuspicious: true,
      suspiciousReason: `Token used from different IP. Original: ${session.ip}, Current: ${ip}`,
      severity: 'high',
      description: 'Potential token theft or account sharing detected'
    }).catch(() => {})
    
    return { valid: true } // Allow but logged
  }

  // Update activity
  sessionStore.updateActivity(tokenId)
  return { valid: true }
}

/**
 * Validate JWT token and check for suspicious activity
 */
export function validateJWTToken(req: any, decodedToken: any): { valid: boolean; reason?: string; tokenId?: string } {
  try {
    // Extract token ID (JTI) from token if present
    // If not present, generate one (for backward compatibility)
    const tokenId = (decodedToken as any).jti || generateTokenId()
    
    // Verify with security checks
    const verification = verifyTokenWithSecurity(req, decodedToken, tokenId)
    
    if (!verification.valid) {
      // Log security violation
      AuditLog.create({
        action: 'permission_denied',
        entityType: 'System',
        entityId: 'security',
        userId: decodedToken.sub || 'unknown',
        ip: req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        isSuspicious: true,
        suspiciousReason: verification.reason,
        severity: 'critical',
        description: 'JWT validation failed with security check'
      }).catch(() => {})
    }
    
    return { ...verification, tokenId }
  } catch (err) {
    return { 
      valid: false, 
      reason: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

/**
 * Add token ID (JTI) to JWT payload when creating tokens
 */
export function addTokenIdToPayload(payload: any): any {
  return {
    ...payload,
    jti: generateTokenId(),
    iat: Math.floor(Date.now() / 1000) // Issued at
  }
}

/**
 * Invalidate a token session (for logout or suspicious activity)
 */
export function invalidateTokenSession(tokenId: string): void {
  sessionStore.removeSession(tokenId)
}

/**
 * Get active sessions for a user (for security monitoring)
 */
export function getUserActiveSessions(userId: string): Session[] {
  return sessionStore.getUserSessions(userId)
}

/**
 * Check if user has too many active sessions (potential account sharing)
 */
export function checkConcurrentSessions(userId: string, maxSessions: number = 3): boolean {
  const sessions = sessionStore.getUserSessions(userId)
  if (sessions.length > maxSessions) {
    logger.warn('Too many concurrent sessions detected', {
      userId,
      sessionCount: sessions.length,
      maxAllowed: maxSessions
    })
    
    AuditLog.create({
      action: 'permission_denied',
      entityType: 'System',
      entityId: 'security',
      userId,
      isSuspicious: true,
      suspiciousReason: `Too many concurrent sessions: ${sessions.length} (max: ${maxSessions})`,
      severity: 'high',
      description: 'Potential account sharing or unauthorized access'
    }).catch(() => {})
    
    return false
  }
  return true
}

module.exports = {
  validateJWTToken,
  addTokenIdToPayload,
  invalidateTokenSession,
  getUserActiveSessions,
  checkConcurrentSessions
}

