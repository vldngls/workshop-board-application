/**
 * Frontend utility to validate API keys (for client-side checks if needed)
 * Note: This should primarily be used on the server side for security
 */

const API_KEY_VALIDATOR_URL = process.env.NEXT_PUBLIC_API_KEY_VALIDATOR_URL || 
  'https://api-key-manager-one.vercel.app/api/validate'

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

    const data: ValidationResponse = await response.json()
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

