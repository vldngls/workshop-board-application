import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { connectToMongo } from '../config/mongo.js'
import { User } from '../models/User.js'

const router = Router()

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
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        name: user.name,
      },
      jwtSecret,
      { expiresIn: '8h' }
    )

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
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
})

export default router


