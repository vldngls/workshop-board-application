const jwt = require('jsonwebtoken')

let lastLoggedUserId: string | null = null
let lastLoggedRole: string | null = null
let lastLogTimestamp = 0
const LOG_SILENCE_WINDOW = 5 * 60 * 1000 // 5 minutes

interface JWTPayload {
  sub: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    console.error('[AUTH] No token provided in Authorization header')
    return res.status(401).json({ error: 'Access token required' })
  }

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    console.error('[AUTH] JWT_SECRET not configured')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload & { jti?: string }
    req.user = decoded
    
    // Enhanced security: validate token with IP and session tracking
    try {
      const { validateJWTToken, checkConcurrentSessions } = require('./jwtSecurity')
      const validation = validateJWTToken(req, decoded)
      
      if (!validation.valid) {
        console.error(`[AUTH] Security validation failed: ${validation.reason}`)
        return res.status(403).json({ error: 'Security validation failed' })
      }
      
      // Check for too many concurrent sessions (potential account sharing)
      // Only check occasionally to avoid excessive logging (every 100th request or so)
      // Use a simple hash of userId + timestamp to create a pseudo-random check
      const shouldCheck = (parseInt(decoded.sub.slice(-2), 16) + Math.floor(Date.now() / 60000)) % 100 === 0
      if (shouldCheck && !checkConcurrentSessions(decoded.sub, 5)) {
        console.warn(`[AUTH] Too many concurrent sessions for user ${decoded.sub}`)
        // Log but don't block - allow access but flag for review
      }
    } catch (securityErr) {
      // If security module fails, log but continue (backward compatibility)
      console.warn('[AUTH] Security validation error:', securityErr)
    }
    
    const now = Date.now()
    const shouldLog =
      decoded.sub !== lastLoggedUserId ||
      decoded.role !== lastLoggedRole ||
      now - lastLogTimestamp > LOG_SILENCE_WINDOW

    if (shouldLog) {
      console.log(`[AUTH] Token verified for userId: ${decoded.sub} (${decoded.role})`)
      lastLoggedUserId = decoded.sub
      lastLoggedRole = decoded.role
      lastLogTimestamp = now
    }

    next()
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err instanceof Error ? err.message : 'Unknown error')
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}

function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

module.exports = { verifyToken, requireRole }
