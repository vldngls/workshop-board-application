const { Router } = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const { connectToMongo } = require('../config/mongo')
const { User } = require('../models/User')

const router = Router()
const logger = require('../utils/logger')

const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(6),
}).refine(data => data.email || data.username, {
  message: 'Either email or username is required',
})

router.post('/login', async (req, res) => {
  try {
    await connectToMongo()
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    const { email, username, password } = parsed.data
    
    // Find user by email or username
    const query = email ? { email } : { username }
    const user = await User.findOne(query).lean()
    if (!user) {
      await logger.audit('Login failed - user not found', { context: { query } })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      await logger.audit('Login failed - bad password', { context: { userId: user._id, email: user.email } })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // Enhanced JWT with token ID for security tracking
    const { addTokenIdToPayload } = require('../middleware/jwtSecurity')
    const payload = addTokenIdToPayload({
      sub: String(user._id),
      role: user.role,
    })
    
    // Access token with reasonable expiration for better UX
    // Extended to 8 hours - users stay logged in during workday
    const token = jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '8h' }
    )

    await logger.audit('Login success', { userId: String(user._id), userEmail: user.email, userRole: user.role })
    return res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        level: user.level,
        pictureUrl: user.pictureUrl ?? null,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ 
      error: 'Internal error',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined
    })
  }
})

// Verify token endpoint - used to check if token is still valid
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret)
    
    // Get user info
    await connectToMongo()
    const user = await User.findById(decoded.sub).lean()
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    return res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    console.error('Verify token error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})

// Refresh token endpoint - issues new token if current token is valid
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // Verify current token (can be expired but not too old)
    let decoded
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (err) {
      // If token is expired, try to decode without verification to get user info
      if (err instanceof jwt.TokenExpiredError) {
        decoded = jwt.decode(token)
        if (!decoded) {
          return res.status(401).json({ error: 'Invalid token' })
        }
        // Check if token expired recently (within last 24 hours)
        const now = Math.floor(Date.now() / 1000)
        if (decoded.exp && (now - decoded.exp) > 24 * 60 * 60) {
          return res.status(401).json({ error: 'Token expired too long ago' })
        }
      } else {
        return res.status(401).json({ error: 'Invalid token' })
      }
    }

    // Get user to ensure they still exist and are active
    await connectToMongo()
    const user = await User.findById(decoded.sub).lean()
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Generate new token
    const { addTokenIdToPayload } = require('../middleware/jwtSecurity')
    const payload = addTokenIdToPayload({
      sub: String(user._id),
      role: user.role,
    })

    const newToken = jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '8h' }
    )

    return res.json({ token: newToken })
  } catch (err) {
    console.error('Refresh token error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
