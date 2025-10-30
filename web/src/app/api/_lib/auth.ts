import { cookies } from 'next/headers'
import { decryptToken } from '@/utils/tokenCrypto'

export async function getRawToken(): Promise<string | null> {
  try {
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
      console.error('[AUTH] Failed to decrypt token:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  } catch (error) {
    console.error('[AUTH] Failed to get cookies:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}


