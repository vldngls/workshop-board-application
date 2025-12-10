/**
 * Utility to validate API keys against the external API key manager service
 */

const API_KEY_VALIDATOR_URL = process.env.API_KEY_VALIDATOR_URL || 'https://api-key-manager-one.vercel.app/api/validate'
const API_KEY_VALIDATION_TTL = 30 * 60 * 1000 // 30 minutes
const API_KEY_VALIDATION_GRACE_PERIOD = 60 * 60 * 1000 // 60 minutes grace period for cold starts (increased from 5 minutes)
const API_KEY_VALIDATION_TIMEOUT = 10000 // 10 seconds timeout for cold starts (increased from 2 seconds)

let validationCache: {
  apiKey: string
  isValid: boolean
  timestamp: number
} | null = null

interface ValidationResponse {
  valid: boolean
  message?: string
}

/**
 * Validates an API key against the external validation service
 * Uses both in-memory cache and database-backed grace period for cold starts
 * @param apiKey - The API key to validate
 * @returns Promise<boolean> - true if valid, false otherwise
 */
export async function validateApiKey(apiKey: string | undefined): Promise<boolean> {
  // API key is required by default - if missing, block access
  if (!apiKey) {
    return false
  }

  const now = Date.now()

  // Check in-memory cache first (fast path)
  if (
    validationCache &&
    validationCache.apiKey === apiKey &&
    now - validationCache.timestamp < API_KEY_VALIDATION_TTL
  ) {
    return validationCache.isValid
  }

  const previousCache = validationCache

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_KEY_VALIDATION_TIMEOUT)

    const response = await fetch(API_KEY_VALIDATOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`API key validation failed: ${response.status} ${response.statusText}`)
      // Check database for last successful validation before failing
      return await checkDatabaseGracePeriod(apiKey, now)
    }

    const data = await response.json() as ValidationResponse | { valid?: boolean; message?: string }
    const isValid = data.valid === true

    // Update in-memory cache
    validationCache = {
      apiKey,
      isValid,
      timestamp: now
    }

    // Update database with successful validation
    if (isValid) {
      await updateDatabaseValidationStatus(apiKey, true, new Date(now))
    }

    return isValid
  } catch (error: any) {
    // First check in-memory grace period cache
    const hasGraceCache =
      previousCache &&
      previousCache.apiKey === apiKey &&
      previousCache.isValid &&
      now - previousCache.timestamp < API_KEY_VALIDATION_TTL + API_KEY_VALIDATION_GRACE_PERIOD

    if (hasGraceCache) {
      validationCache = previousCache

      if (error.name === 'AbortError') {
        console.warn('API key validation timeout, using cached result within grace period')
      } else {
        console.warn('API key validation error, using cached result within grace period:', error.message)
      }

      return true
    }

    // If no in-memory cache, check database for last successful validation
    const dbGraceResult = await checkDatabaseGracePeriod(apiKey, now)
    if (dbGraceResult) {
      // Update in-memory cache from database
      validationCache = {
        apiKey,
        isValid: true,
        timestamp: now
      }
      return true
    }

    // No cache available, update cache and database with failure
    validationCache = {
      apiKey,
      isValid: false,
      timestamp: now
    }

    await updateDatabaseValidationStatus(apiKey, false, new Date(now))

    if (error.name === 'AbortError') {
      console.error('API key validation timeout with no cached result')
      return false
    }

    console.error('API key validation error with no cached result:', error.message)
    return false
  }
}

/**
 * Checks database for last successful validation within grace period
 * Used as fallback when external validation fails (e.g., cold starts)
 * @param apiKey - The API key to check
 * @param now - Current timestamp
 * @returns Promise<boolean> - true if last validation was successful and within grace period
 */
async function checkDatabaseGracePeriod(apiKey: string, now: number): Promise<boolean> {
  try {
    const { connectToMongo } = require('../config/mongo');
    const { MaintenanceSettings } = require('../models/MaintenanceSettings');
    
    await connectToMongo();
    const settings = await MaintenanceSettings.findOne();
    
    // Check if API key matches and last validation was successful
    if (
      settings?.apiKey === apiKey &&
      settings?.lastApiKeyValidationSuccess === true &&
      settings?.lastApiKeyValidationAt
    ) {
      const lastValidationTime = new Date(settings.lastApiKeyValidationAt).getTime();
      const timeSinceValidation = now - lastValidationTime;
      
      // If last successful validation was within grace period, allow access
      if (timeSinceValidation < API_KEY_VALIDATION_TTL + API_KEY_VALIDATION_GRACE_PERIOD) {
        console.warn(`Using database-backed grace period for API key validation (last validated ${Math.round(timeSinceValidation / 1000 / 60)} minutes ago)`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking database grace period:', error);
    return false;
  }
}

/**
 * Updates database with API key validation status
 * @param apiKey - The API key that was validated
 * @param isValid - Whether the validation was successful
 * @param timestamp - When the validation occurred
 */
async function updateDatabaseValidationStatus(apiKey: string, isValid: boolean, timestamp: Date): Promise<void> {
  try {
    const { connectToMongo } = require('../config/mongo');
    const { MaintenanceSettings } = require('../models/MaintenanceSettings');
    
    await connectToMongo();
    const settings = await MaintenanceSettings.findOne();
    
    if (settings && settings.apiKey === apiKey) {
      settings.lastApiKeyValidationAt = timestamp;
      settings.lastApiKeyValidationSuccess = isValid;
      await settings.save();
    }
  } catch (error) {
    // Don't throw - this is a non-critical update
    console.error('Error updating database validation status:', error);
  }
}

/**
 * Gets the API key from maintenance settings (database)
 * This is used by middleware to fetch the current API key
 * @returns Promise<string | null> - API key from database or null
 */
export async function getApiKeyFromSettings(): Promise<string | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { connectToMongo } = require('../config/mongo');
    const { MaintenanceSettings } = require('../models/MaintenanceSettings');
    
    await connectToMongo();
    const settings = await MaintenanceSettings.findOne();
    return settings?.apiKey || null;
  } catch (error) {
    console.error('Error fetching API key from settings:', error);
    return null;
  }
}

/**
 * Checks if API key validation should be enabled
 * API key validation is always enabled by default if API key is set in database
 * @returns Promise<boolean> - true if API key exists in database
 */
export async function isApiKeyValidationEnabled(): Promise<boolean> {
  const apiKey = await getApiKeyFromSettings();
  // If API key is set in database, validation is required
  // If no API key in database, still require it (will show maintenance mode)
  return true; // Always enabled - checks will be done at validation time
}

// Export as CommonJS for compatibility with routes
module.exports = {
  validateApiKey,
  isApiKeyValidationEnabled,
  getApiKeyFromSettings
}

