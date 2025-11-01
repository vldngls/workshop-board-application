import { cookies } from 'next/headers'
import { decryptToken } from '@/utils/tokenCrypto'

export async function getRawToken(): Promise<string | null> {
  try {
    // Check if encryption secret is configured
    const encSecret = process.env.NEXT_JWT_ENC_SECRET || process.env.JWT_SECRET
    if (!encSecret) {
      console.error('[AUTH] Missing NEXT_JWT_ENC_SECRET or JWT_SECRET environment variable')
      return null
    }

    const store = await cookies()
    const enc = store.get('token')?.value
    if (!enc) {
      console.error('[AUTH] No token found in cookies')
      return null
    }
    try {
      const raw = await decryptToken(enc)
      return raw
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AUTH] Failed to decrypt token:', errorMessage)
      // Check if this is a secret mismatch error
      if (errorMessage.includes('decryption') || errorMessage.includes('unable to decrypt')) {
        console.error('[AUTH] Possible secret mismatch - ensure NEXT_JWT_ENC_SECRET matches the value used during login')
      }
      return null
    }
  } catch (error) {
    console.error('[AUTH] Failed to get cookies:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}


