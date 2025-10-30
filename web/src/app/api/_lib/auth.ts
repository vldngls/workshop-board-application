import { cookies } from 'next/headers'
import { decryptToken } from '@/utils/tokenCrypto'

export async function getRawToken(): Promise<string | null> {
  const store = await cookies()
  const enc = store.get('token')?.value
  if (!enc) return null
  try {
    const raw = await decryptToken(enc)
    return raw
  } catch {
    return null
  }
}


