import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from 'jose'
import { decryptToken } from '@/utils/tokenCrypto'

interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
}

export async function GET() {
  try {
    // Get JWT token from cookies
    const cookieStore = await cookies()
    const enc = cookieStore.get('token')?.value
    
    if (!enc) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const raw = await decryptToken(enc)
    const { payload } = await jwtVerify(raw, secret)
    
    // Return user information from the JWT payload
    const userInfo = {
      id: (payload as any).sub,
      role: (payload as any).role,
    }

    return NextResponse.json(userInfo, { status: 200 })
  } catch (error) {
    console.error('Token verification failed:', error)
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
