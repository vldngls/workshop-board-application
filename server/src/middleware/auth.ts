const jwt = require('jsonwebtoken')

interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
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
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload
    req.user = decoded
    console.log(`[AUTH] Token verified for user: ${decoded.email} (${decoded.role})`)
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
