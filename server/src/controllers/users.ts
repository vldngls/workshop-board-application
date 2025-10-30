const { Router } = require('express')
const { connectToMongo } = require('../config/mongo')
const { User } = require('../models/User')
const { z } = require('zod')
const bcrypt = require('bcryptjs')
const { verifyToken, requireRole } = require('../middleware/auth')

const router = Router()
const logger = require('../utils/logger')

// Get current user info (any authenticated user)
router.get('/me', verifyToken, async (req, res) => {
  try {
    // User info is already in req.user from JWT verification
    return res.json({
      user: {
        id: req.user?.sub,
        email: undefined,
        role: req.user?.role,
        name: undefined
      }
    })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', verifyToken, async (req, res) => {
  await connectToMongo()
  
  // Build filter based on query parameters
  const filter: Record<string, any> = {}
  if (req.query.role) {
    filter.role = req.query.role
  }
  
  const users = await User.find(filter, { name: 1, email: 1, role: 1, level: 1, pictureUrl: 1, breakTimes: 1 }).sort({ createdAt: -1 }).lean()
  return res.json({ users })
})

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  password: z.string().min(6),
  role: z.enum(['administrator', 'job-controller', 'technician', 'service-advisor']),
  level: z.enum(['untrained', 'level-0', 'level-1', 'level-2', 'level-3']).optional(),
  pictureUrl: z.string().url().optional().or(z.literal('')),
})

router.post('/', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const { name, username, email, phone, password, role, level, pictureUrl } = parsed.data
  const exists = await User.findOne({ email })
  if (exists) return res.status(409).json({ error: 'Email already exists' })
  
  // Check if username is provided and unique
  if (username) {
    const usernameExists = await User.findOne({ username })
    if (usernameExists) return res.status(409).json({ error: 'Username already exists' })
  }
  
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ 
    name, 
    username: username || undefined,
    email, 
    phone: phone || undefined,
    passwordHash, 
    role, 
    level: role === 'technician' ? (level || 'untrained') : undefined,
    pictureUrl: pictureUrl || undefined 
  })
  try {
    await logger.audit('User created', { userId: req.user?.sub, userEmail: undefined, userRole: req.user?.role, context: { createdUserId: String(user._id), email } })
  } catch {}
  return res.status(201).json({ id: user._id })
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['administrator', 'job-controller', 'technician']).optional(),
  level: z.enum(['Junior', 'Senior', 'Master', 'Lead']).optional(),
  pictureUrl: z.string().url().optional().or(z.literal('')).optional(),
  breakTimes: z.array(z.object({
    description: z.string().min(1),
    startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  })).optional(),
})

router.put('/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const { id } = req.params
  console.log('Updating user:', id, 'with data:', req.body)
  
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    console.error('Validation failed:', parsed.error)
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
  }
  
  const update: Record<string, any> = {}
  if (parsed.data.name) update.name = parsed.data.name
  if (parsed.data.email) update.email = parsed.data.email
  if (parsed.data.role) update.role = parsed.data.role
  if (parsed.data.level !== undefined) update.level = parsed.data.level
  if (parsed.data.pictureUrl !== undefined) update.pictureUrl = parsed.data.pictureUrl || undefined
  if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10)
  if (parsed.data.breakTimes !== undefined) {
    console.log('Setting break times:', parsed.data.breakTimes)
    update.breakTimes = parsed.data.breakTimes
  }
  
  console.log('Update object:', update)
  const result = await User.findByIdAndUpdate(id, update, { new: true })
  if (!result) return res.status(404).json({ error: 'Not found' })
  
  console.log('Updated user:', result)
  try {
    await logger.audit('User updated', { userId: req.user?.sub, userEmail: undefined, userRole: req.user?.role, context: { targetUserId: id, update } })
  } catch {}
  
  // Return the updated user data
  return res.json({ 
    ok: true, 
    user: {
      _id: result._id,
      name: result.name,
      email: result.email,
      username: result.username,
      role: result.role,
      level: result.level,
      breakTimes: result.breakTimes,
      pictureUrl: result.pictureUrl
    }
  })
})

router.delete('/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const { id } = req.params
  const result = await User.findByIdAndDelete(id)
  if (!result) return res.status(404).json({ error: 'Not found' })
  try { await logger.audit('User deleted', { userId: req.user?.sub, userEmail: undefined, userRole: req.user?.role, context: { targetUserId: id } }) } catch {}
  return res.json({ ok: true })
})

module.exports = router


