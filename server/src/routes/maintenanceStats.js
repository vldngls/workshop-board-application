const { Router } = require('express')
const { connectToMongo } = require('../config/mongo.ts')
const { User } = require('../models/User.ts')
const { JobOrder } = require('../models/JobOrder.ts')
const { Appointment } = require('../models/Appointment.ts')
const { BugReport } = require('../models/BugReport.ts')
const { verifyToken, requireRole } = require('../middleware/auth.ts')

const router = Router()

// Get system statistics
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    
    const [
      totalUsers,
      totalJobOrders,
      totalAppointments,
      totalBugReports,
      openBugReports,
      resolvedBugReports
    ] = await Promise.all([
      User.countDocuments(),
      JobOrder.countDocuments(),
      Appointment.countDocuments(),
      BugReport.countDocuments(),
      BugReport.countDocuments({ status: 'open' }),
      BugReport.countDocuments({ status: 'resolved' })
    ])
    
    const stats = {
      totalUsers,
      totalJobOrders,
      totalAppointments,
      totalBugReports,
      openBugReports,
      resolvedBugReports,
      systemUptime: '99.9%', // This would be calculated from actual uptime data
      lastBackup: new Date().toISOString() // This would be from actual backup logs
    }
    
    return res.json(stats)
  } catch (error) {
    console.error('Error fetching system stats:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

module.exports = router
