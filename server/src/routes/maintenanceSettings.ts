const { Router } = require('express');
const { z } = require('zod');
const { connectToMongo } = require('../config/mongo');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

// Simple in-memory storage for maintenance settings
// In production, this should be stored in a database
let maintenanceSettings = {
  isUnderMaintenance: false,
  maintenanceMessage: 'The system is currently under maintenance. Please try again later.'
};

const updateSettingsSchema = z.object({
  isUnderMaintenance: z.boolean(),
  maintenanceMessage: z.string()
});

// Get maintenance settings
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    return res.json(maintenanceSettings);
  } catch (error) {
    console.error('Error fetching maintenance settings:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update maintenance settings
router.put('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        details: parsed.error.issues 
      });
    }
    
    maintenanceSettings = parsed.data;
    
    return res.json({ 
      message: 'Maintenance settings updated successfully',
      settings: maintenanceSettings
    });
  } catch (error) {
    console.error('Error updating maintenance settings:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
