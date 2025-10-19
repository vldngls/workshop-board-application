import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify, JWTPayload as JoseJWTPayload } from 'jose'

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
    const token = cookieStore.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'No token found' }, { status: 401 })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    
    const userInfo = payload as CustomJWTPayload

    return NextResponse.json({
      user: {
        userId: userInfo.userId,
        email: userInfo.email,
        username: userInfo.username,
        role: userInfo.role,
        name: userInfo.name
      }
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
