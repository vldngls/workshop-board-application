const { Router } = require('express')
const { connectToMongo } = require('../config/mongo.ts')
const { verifyToken, requireRole } = require('../middleware/auth.ts')
const SystemLog = require('../models/SystemLog.ts')

const router = Router()

// List logs with basic filters and pagination
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    const { level, userEmail, path, page = '1', limit = '50' } = req.query
    const query = {}
    if (level) query.level = level
    if (userEmail) query.userEmail = userEmail
    if (path) query.path = path
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))
    const [items, total] = await Promise.all([
      SystemLog.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * pageSize).limit(pageSize).lean(),
      SystemLog.countDocuments(query)
    ])
    res.json({ items, page: pageNum, limit: pageSize, total })
  } catch (err) {
    console.error('Failed to fetch system logs:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete all logs (optionally with filters)
router.delete('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    const { level, userEmail, path } = req.query
    const query = {}
    if (level) query.level = level
    if (userEmail) query.userEmail = userEmail
    if (path) query.path = path
    const result = await SystemLog.deleteMany(query)
    res.json({ ok: true, deleted: result.deletedCount || 0 })
  } catch (err) {
    console.error('Failed to delete system logs:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router


