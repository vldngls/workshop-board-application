import { Router } from 'express'
import { connectToMongo } from '../config/mongo.js'
import { User } from '../models/User.js'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

// Get current user info (any authenticated user)
router.get('/me', verifyToken, async (req, res) => {
  try {
    // User info is already in req.user from JWT verification
    res.json({
      user: {
        id: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        name: req.user?.name
      }
    })
  } catch (error) {
    console.error('Error fetching current user:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', verifyToken, requireRole(['administrator']), async (_req, res) => {
  await connectToMongo()
  const users = await User.find({}, { name: 1, email: 1, role: 1, level: 1, pictureUrl: 1 }).sort({ createdAt: -1 }).lean()
  res.json({ users })
})

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['administrator', 'job-controller', 'technician']),
  level: z.enum(['Junior', 'Senior', 'Master', 'Lead']).optional(),
  pictureUrl: z.string().url().optional().or(z.literal('')),
})

router.post('/', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const { name, email, password, role, level, pictureUrl } = parsed.data
  const exists = await User.findOne({ email })
  if (exists) return res.status(409).json({ error: 'Email already exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ 
    name, 
    email, 
    passwordHash, 
    role, 
    level: role === 'technician' ? (level || 'Junior') : undefined,
    pictureUrl: pictureUrl || undefined 
  })
  res.status(201).json({ id: user._id })
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['administrator', 'job-controller', 'technician']).optional(),
  level: z.enum(['Junior', 'Senior', 'Master', 'Lead']).optional(),
  pictureUrl: z.string().url().optional().or(z.literal('')).optional(),
})

router.put('/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const { id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const update: any = {}
  if (parsed.data.name) update.name = parsed.data.name
  if (parsed.data.email) update.email = parsed.data.email
  if (parsed.data.role) update.role = parsed.data.role
  if (parsed.data.level !== undefined) update.level = parsed.data.level
  if (parsed.data.pictureUrl !== undefined) update.pictureUrl = parsed.data.pictureUrl || undefined
  if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10)
  const result = await User.findByIdAndUpdate(id, update, { new: true })
  if (!result) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

router.delete('/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  await connectToMongo()
  const { id } = req.params
  const result = await User.findByIdAndDelete(id)
  if (!result) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

export default router


