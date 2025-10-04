import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { connectToMongo } from '../config/mongo.js'
import { User } from '../models/User.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/login', async (req, res) => {
  try {
    await connectToMongo()
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    const { email, password } = parsed.data
    const user = await User.findOne({ email }).lean()
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    return res.json({
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        pictureUrl: user.pictureUrl ?? null,
      },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router


