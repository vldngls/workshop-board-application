import { CompactEncrypt, compactDecrypt } from 'jose'

function getEncKey(): Uint8Array {
  const secret = process.env.NEXT_JWT_ENC_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Missing NEXT_JWT_ENC_SECRET or JWT_SECRET for token encryption')
  }
  const bytes = new TextEncoder().encode(secret)
  // Ensure 32 bytes for A256GCM. If shorter, repeat; if longer, slice.
  if (bytes.length >= 32) {
    return bytes.slice(0, 32)
  }
  const buf = new Uint8Array(32)
  for (let i = 0; i < 32; i++) buf[i] = bytes[i % bytes.length]
  return buf
}

export async function encryptToken(plain: string): Promise<string> {
  const key = getEncKey()
  const jwe = await new CompactEncrypt(new TextEncoder().encode(plain))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(key)
  return jwe
}

export async function decryptToken(jwe: string): Promise<string> {
  const key = getEncKey()
  const { plaintext } = await compactDecrypt(jwe, key)
  return new TextDecoder().decode(plaintext)
}


