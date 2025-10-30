import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify, JWTPayload as JoseJWTPayload } from 'jose'
import { decryptToken } from '@/utils/tokenCrypto'

interface CustomJWTPayload extends JoseJWTPayload {
  userId: string
  email: string
  username?: string
  role: string
  name: string
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const enc = cookieStore.get('token')?.value

    if (!enc) {
      return NextResponse.json({ error: 'No token found' }, { status: 401 })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const raw = await decryptToken(enc)
    const { payload } = await jwtVerify(raw, secret)
    
    const userInfo = payload as CustomJWTPayload

    return NextResponse.json({
      user: {
        userId: (userInfo as any).sub,
        role: userInfo.role,
      }
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
