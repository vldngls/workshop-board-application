const { Router } = require('express');
const { z } = require('zod');
const { connectToMongo } = require('../config/mongo');
const { MaintenanceSettings } = require('../models/MaintenanceSettings');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateApiKey } = require('../utils/apiKeyValidator');

const router = Router();

// Cache for API key validation (60 seconds) to avoid excessive external API calls
let publicApiKeyValidationCache: {
  isValid: boolean;
  timestamp: number;
} | null = null;

const PUBLIC_API_KEY_CACHE_TTL = 60000; // 60 seconds

const updateSettingsSchema = z.object({
  isUnderMaintenance: z.boolean(),
  maintenanceMessage: z.string(),
  apiKey: z.string().optional() // API key is optional - can be updated separately
});

// Public endpoint to check maintenance status (no auth required)
router.get('/public', async (req, res) => {
  try {
    await connectToMongo();
    
    // Get maintenance settings document
    const settings = await MaintenanceSettings.findOne();
    
    // Check API key validation first (from database, not env)
    if (settings && settings.apiKey) {
      // Use cache to avoid repeated validation calls
      const now = Date.now();
      let isValid = false;
      
      if (publicApiKeyValidationCache && (now - publicApiKeyValidationCache.timestamp) < PUBLIC_API_KEY_CACHE_TTL) {
        // Use cached value
        isValid = publicApiKeyValidationCache.isValid;
      } else {
        // Cache miss or expired, validate API key (with shorter timeout)
        try {
          isValid = await validateApiKey(settings.apiKey);
          // Update cache
          publicApiKeyValidationCache = {
            isValid,
            timestamp: now
          };
        } catch (error) {
          // If validation fails (timeout, network error), use cached value if available
          if (publicApiKeyValidationCache) {
            isValid = publicApiKeyValidationCache.isValid;
          } else {
            // No cache available, fail validation
            isValid = false;
          }
        }
      }
      
      if (!isValid) {
        return res.json({
          isUnderMaintenance: true,
          maintenanceMessage: 'Invalid or missing API key. Please contact the administrator.'
        });
      }
    } else {
      // If no API key is set in database, block access (required by default)
      return res.json({
        isUnderMaintenance: true,
        maintenanceMessage: 'API key not configured. Please contact the administrator.'
      });
    }
    
    // API key is valid, now check maintenance status
    return res.json({
      isUnderMaintenance: settings?.isUnderMaintenance || false,
      maintenanceMessage: settings?.maintenanceMessage || ''
    });
  } catch (error) {
    // If there's an error, assume not under maintenance to avoid blocking users
    return res.json({
      isUnderMaintenance: false,
      maintenanceMessage: ''
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
    
    // Validate API key if it exists
    let apiKeyStatus = {
      isSet: false,
      isValid: false,
      lastValidated: null as Date | null
    };
    
    if (settings.apiKey) {
      apiKeyStatus.isSet = true;
      try {
        apiKeyStatus.isValid = await validateApiKey(settings.apiKey);
        if (apiKeyStatus.isValid) {
          apiKeyStatus.lastValidated = new Date();
        }
      } catch (error) {
        apiKeyStatus.isValid = false;
      }
    }
    
    return res.json({
      isUnderMaintenance: settings.isUnderMaintenance,
      maintenanceMessage: settings.maintenanceMessage,
      apiKey: settings.apiKey ? '***' : null, // Return masked value to show if it's set
      apiKeyStatus // Include validation status
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
    
    const { isUnderMaintenance, maintenanceMessage, apiKey } = parsed.data;
    
    // Get or create maintenance settings document
    let settings = await MaintenanceSettings.findOne();
    
    if (!settings) {
      settings = new MaintenanceSettings();
    }
    
    // Update settings
    const previousState = settings.isUnderMaintenance;
    settings.isUnderMaintenance = isUnderMaintenance;
    settings.maintenanceMessage = maintenanceMessage;
    
    // Update API key if provided (allow clearing by sending empty string)
    if (apiKey !== undefined) {
      settings.apiKey = apiKey || null;
    }
    
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
    
    // Validate API key status after saving
    let apiKeyStatus = {
      isSet: false,
      isValid: false,
      lastValidated: null as Date | null
    };
    
    if (settings.apiKey) {
      apiKeyStatus.isSet = true;
      try {
        apiKeyStatus.isValid = await validateApiKey(settings.apiKey);
        if (apiKeyStatus.isValid) {
          apiKeyStatus.lastValidated = new Date();
        }
      } catch (error) {
        apiKeyStatus.isValid = false;
      }
    }
    
    return res.json({ 
      message: 'Maintenance settings updated successfully',
      settings: {
        isUnderMaintenance: settings.isUnderMaintenance,
        maintenanceMessage: settings.maintenanceMessage,
        apiKey: settings.apiKey ? '***' : null, // Don't return actual API key
        apiKeyStatus // Include validation status
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
