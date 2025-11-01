/**
 * Utility to validate API keys against the external API key manager service
 */

const API_KEY_VALIDATOR_URL = process.env.API_KEY_VALIDATOR_URL || 'https://api-key-manager-one.vercel.app/api/validate'

interface ValidationResponse {
  valid: boolean
  message?: string
}

/**
 * Validates an API key against the external validation service
 * @param apiKey - The API key to validate
 * @returns Promise<boolean> - true if valid, false otherwise
 */
export async function validateApiKey(apiKey: string | undefined): Promise<boolean> {
  // API key is required by default - if missing, block access
  if (!apiKey) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

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
      return false
    }

    const data = await response.json() as ValidationResponse | { valid?: boolean; message?: string }
    return data.valid === true
  } catch (error: any) {
    // If it's an abort (timeout), fail validation
    if (error.name === 'AbortError') {
      console.error('API key validation timeout')
      return false
    }
    
    // Network errors - be conservative and fail validation
    console.error('API key validation error:', error.message)
    return false
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

