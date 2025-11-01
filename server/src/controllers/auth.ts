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
    
    // Minimal claims: subject and role only; short-lived access token
    const token = jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '15m' }
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

module.exports = router


