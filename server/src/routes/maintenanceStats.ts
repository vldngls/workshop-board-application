const { Router } = require('express');
const { connectToMongo } = require('../config/mongo');
const { User } = require('../models/User');
const { JobOrder } = require('../models/JobOrder');
const { Appointment } = require('../models/Appointment');
const { BugReport } = require('../models/BugReport');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// Get system statistics
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
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
    ]);
    
    const uptimeSeconds = typeof process.uptime === 'function' ? process.uptime() : 0
    const uptimeHours = Math.floor(uptimeSeconds / 3600)

    const stats = {
      totalUsers,
      totalJobOrders,
      totalAppointments,
      totalBugReports,
      openBugReports,
      resolvedBugReports,
      systemUptime: `${uptimeHours}h`,
      lastBackup: new Date().toISOString() // This would be from actual backup logs
    };
    
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
