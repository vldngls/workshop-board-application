import { NextRequest, NextResponse } from "next/server"
import { getRawToken } from "../../_lib/auth"
import { encryptToken } from "@/utils/tokenCrypto"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

/**
 * Refresh token endpoint
 * Validates current token and issues a new one if still valid
 */
export async function POST(req: NextRequest) {
  try {
    const currentToken = await getRawToken()
    
    if (!currentToken) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Call backend refresh endpoint to get new token
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    })

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json().catch(() => ({ error: 'Token refresh failed' }))
      return NextResponse.json(errorData, { status: refreshResponse.status })
    }

    const { token: newToken } = await refreshResponse.json()

    if (!newToken) {
      return NextResponse.json({ error: 'No token returned from refresh' }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true })
    const isProduction = process.env.NODE_ENV === 'production'
    
    // Encrypt and store new JWT token
    const encrypted = await encryptToken(newToken)
    res.cookies.set("token", encrypted, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    
    return res
  } catch (err) {
    console.error('Token refresh error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

