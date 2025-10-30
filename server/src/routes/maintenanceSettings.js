const { Router } = require('express')
const { z } = require('zod')
const { connectToMongo } = require('../config/mongo.ts')
const { verifyToken, requireRole } = require('../middleware/auth.ts')

const router = Router()

// Persisted storage using MongoDB
const mongoose = require('mongoose')

const MaintenanceSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  isUnderMaintenance: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'The system is currently under maintenance. Please try again later.' },
}, { timestamps: true })

const MaintenanceSettingsModel = mongoose.models.MaintenanceSettings || mongoose.model('MaintenanceSettings', MaintenanceSettingsSchema)

async function getSettingsDoc() {
  const existing = await MaintenanceSettingsModel.findOne({ key: 'global' }).lean()
  if (existing) return existing
  const created = await MaintenanceSettingsModel.create({ key: 'global' })
  return created.toObject()
}

const updateSettingsSchema = z.object({
  isUnderMaintenance: z.boolean(),
  maintenanceMessage: z.string()
})

// Get maintenance settings
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    const doc = await getSettingsDoc()
    return res.json({
      isUnderMaintenance: !!doc.isUnderMaintenance,
      maintenanceMessage: doc.maintenanceMessage || ''
    })
  } catch (error) {
    console.error('Error fetching maintenance settings:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Public maintenance status (no auth) - exposes only safe fields
router.get('/status', async (req, res) => {
  try {
    await connectToMongo()
    const doc = await getSettingsDoc()
    return res.json({
      isUnderMaintenance: !!doc.isUnderMaintenance,
      maintenanceMessage: doc.maintenanceMessage || ''
    })
  } catch (error) {
    console.error('Error fetching public maintenance status:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update maintenance settings
router.put('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = updateSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        details: parsed.error.errors 
      })
    }
    const update = {
      isUnderMaintenance: parsed.data.isUnderMaintenance,
      maintenanceMessage: parsed.data.maintenanceMessage
    }
    const doc = await MaintenanceSettingsModel.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { upsert: true, new: true }
    ).lean()

    // Audit log
    try {
      const logger = require('../utils/logger.ts')
      await logger.audit('Maintenance settings updated', {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        context: update,
      })
    } catch {}

    return res.json({ 
      message: 'Maintenance settings updated successfully',
      settings: {
        isUnderMaintenance: !!doc.isUnderMaintenance,
        maintenanceMessage: doc.maintenanceMessage || ''
      }
    })
  } catch (error) {
    console.error('Error updating maintenance settings:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

module.exports = router
