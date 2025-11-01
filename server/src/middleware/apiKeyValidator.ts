/**
 * Middleware to validate API key on all routes
 * This acts as a gatekeeper to ensure the API key is valid before allowing any requests
 */

const { validateApiKey, getApiKeyFromSettings } = require('../utils/apiKeyValidator');

// Cache for API key validation (30 seconds) to avoid excessive external API calls
let apiKeyValidationCache: {
  isValid: boolean;
  timestamp: number;
} | null = null;

const API_KEY_CACHE_TTL = 30000; // 30 seconds

/**
 * Middleware to validate API key before processing requests
 * Skips validation for public endpoints
 */
async function apiKeyValidatorMiddleware(req: any, res: any, next: any) {
  // Skip API key validation for public endpoints
  const publicPaths = [
    '/',
    '/health',
    '/auth',
    '/maintenance/settings/public'
  ];

  const isPublicPath = publicPaths.some(path => 
    req.path === path || req.path.startsWith(path)
  );

  if (isPublicPath) {
    return next();
  }

  // API key validation is always enabled by default
  try {
    // Get API key from database (not environment variables)
    const apiKey = await getApiKeyFromSettings();
    
    // If no API key is set in database, block access
    if (!apiKey) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'API key not configured. Please contact the administrator.',
        isUnderMaintenance: true
      });
    }
    
    // Check cache first
    const now = Date.now();
    let isValid = false;

    if (apiKeyValidationCache && (now - apiKeyValidationCache.timestamp) < API_KEY_CACHE_TTL) {
      // Use cached value
      isValid = apiKeyValidationCache.isValid;
    } else {
      // Cache miss or expired, validate API key
      isValid = await validateApiKey(apiKey);

      // Update cache
      apiKeyValidationCache = {
        isValid,
        timestamp: now
      };
    }

    if (!isValid) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Invalid or missing API key. Please contact the administrator.',
        isUnderMaintenance: true
      });
    }

    return next();
  } catch (error: any) {
    console.error('API key validation middleware error:', error);
    // On error, be conservative and block access
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'API key validation failed. Please contact the administrator.',
      isUnderMaintenance: true
    });
  }
}

module.exports = { apiKeyValidatorMiddleware };

