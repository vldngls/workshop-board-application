const { Router } = require('express');
const { z } = require('zod');
const { connectToMongo } = require('../config/mongo');
const { MaintenanceSettings } = require('../models/MaintenanceSettings');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = Router();

const updateSettingsSchema = z.object({
  isUnderMaintenance: z.boolean(),
  maintenanceMessage: z.string()
});

// Public endpoint to check maintenance status (no auth required)
router.get('/public', async (req, res) => {
  try {
    await connectToMongo();
    
    // Get maintenance settings document
    const settings = await MaintenanceSettings.findOne();
    
    if (!settings) {
      // If no settings exist, assume not under maintenance
      return res.json({
        isUnderMaintenance: false,
        maintenanceMessage: 'The system is currently under maintenance. Please try again later.'
      });
    }
    
    return res.json({
      isUnderMaintenance: settings.isUnderMaintenance,
      maintenanceMessage: settings.maintenanceMessage
    });
  } catch (error) {
    console.error('Error fetching public maintenance status:', error);
    // If there's an error, assume not under maintenance to avoid blocking users
    return res.json({
      isUnderMaintenance: false,
      maintenanceMessage: 'The system is currently under maintenance. Please try again later.'
    });
  }
});

// Get maintenance settings
router.get('/', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    await connectToMongo();
    
    // Get or create maintenance settings document
    let settings = await MaintenanceSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new MaintenanceSettings({
        isUnderMaintenance: false,
        maintenanceMessage: 'The system is currently under maintenance. Please try again later.'
      });
      await settings.save();
    }
    
    return res.json({
      isUnderMaintenance: settings.isUnderMaintenance,
      maintenanceMessage: settings.maintenanceMessage
    });
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
    
    const { isUnderMaintenance, maintenanceMessage } = parsed.data;
    
    // Get or create maintenance settings document
    let settings = await MaintenanceSettings.findOne();
    
    if (!settings) {
      settings = new MaintenanceSettings();
    }
    
    // Update settings
    const previousState = settings.isUnderMaintenance;
    settings.isUnderMaintenance = isUnderMaintenance;
    settings.maintenanceMessage = maintenanceMessage;
    
    // Track who enabled/disabled maintenance
    if (isUnderMaintenance && !previousState) {
      // Maintenance was just enabled
      settings.enabledBy = req.user?.sub;
      settings.enabledByName = undefined;
      settings.enabledByEmail = undefined;
      settings.enabledAt = new Date();
      // Clear disabled fields
      settings.disabledBy = undefined;
      settings.disabledByName = undefined;
      settings.disabledByEmail = undefined;
      settings.disabledAt = undefined;
    } else if (!isUnderMaintenance && previousState) {
      // Maintenance was just disabled
      settings.disabledBy = req.user?.sub;
      settings.disabledByName = undefined;
      settings.disabledByEmail = undefined;
      settings.disabledAt = new Date();
      // Clear enabled fields
      settings.enabledBy = undefined;
      settings.enabledByName = undefined;
      settings.enabledByEmail = undefined;
      settings.enabledAt = undefined;
    }
    
    await settings.save();
    
    return res.json({ 
      message: 'Maintenance settings updated successfully',
      settings: {
        isUnderMaintenance: settings.isUnderMaintenance,
        maintenanceMessage: settings.maintenanceMessage
      }
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
