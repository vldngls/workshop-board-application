import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set("token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 })
  res.headers.set("Location", "/login")
  return new Response(null, { status: 303, headers: res.headers })
}


