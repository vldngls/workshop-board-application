import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"
    const r = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      // Do not forward cookies from client to API here
    })
    if (!r.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    const data = await r.json()
    const role = data?.user?.role
    const name = data?.user?.name
    const emailResp = data?.user?.email
    if (!role) return NextResponse.json({ error: "Invalid server response" }, { status: 500 })

    const res = NextResponse.json({ ok: true, role })
    res.cookies.set("role", role, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    if (name) {
      res.cookies.set("name", name, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 8 })
    }
    if (emailResp) {
      res.cookies.set("email", emailResp, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 8 })
    }
    return res
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}


