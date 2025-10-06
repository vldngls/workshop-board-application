import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"
    
    const r = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
    
    // Store JWT token securely
    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    
    return res
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
