import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const token = process.argv[2]

if (!token) {
  console.error('Usage: node verify-token.mjs <token>')
  process.exit(1)
}

const jwtSecret = process.env.JWT_SECRET

console.log('\n=== Token Verification Debug ===\n')
console.log('JWT_SECRET from env:', jwtSecret ? `"${jwtSecret}"` : 'NOT SET')
console.log('Token:', token)
console.log('\n--- Decoding without verification ---')

try {
  const decoded = jwt.decode(token)
  console.log('Decoded payload:', JSON.stringify(decoded, null, 2))
  
  if (decoded && decoded.exp) {
    const expiresAt = new Date(decoded.exp * 1000)
    const now = new Date()
    console.log('\nExpiration time:', expiresAt.toISOString())
    console.log('Current time:', now.toISOString())
    console.log('Token expired?', now > expiresAt)
  }
} catch (err) {
  console.error('Failed to decode:', err.message)
}

console.log('\n--- Verifying with JWT_SECRET ---')

if (!jwtSecret) {
  console.error('❌ JWT_SECRET is not set in environment variables')
  process.exit(1)
}

try {
  const verified = jwt.verify(token, jwtSecret)
  console.log('✅ Token is VALID')
  console.log('Verified payload:', JSON.stringify(verified, null, 2))
} catch (err) {
  console.error('❌ Token verification FAILED')
  console.error('Error:', err.message)
  
  if (err.name === 'TokenExpiredError') {
    console.error('Reason: Token has expired')
  } else if (err.name === 'JsonWebTokenError') {
    console.error('Reason: Invalid token or wrong secret')
  }
}

console.log('\n=== End Debug ===\n')

