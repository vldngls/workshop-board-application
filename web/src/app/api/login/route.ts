import { NextRequest, NextResponse } from "next/server"
import { encryptToken } from "@/utils/tokenCrypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, username, password } = body

    if (!password || (!email && !username)) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"
    
    const r = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    
    if (!r.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    
    const data = await r.json()
    
    const token = data?.token
    const role = data?.user?.role
    
    if (!token || !role) {
      return NextResponse.json({ error: "Invalid server response" }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true, role })
    const isProduction = process.env.NODE_ENV === 'production'
    
    // Encrypt and store JWT token securely
    const encrypted = await encryptToken(token)
    res.cookies.set("token", encrypted, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 60 * 15, // 15 minutes to match access token exp
    })
    
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    const status = message.includes('Missing NEXT_JWT_ENC_SECRET') ? 500 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
