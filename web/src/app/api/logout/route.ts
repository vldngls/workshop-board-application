import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    new URL(request.url).protocol === 'https:'

  const res = NextResponse.json({ ok: true, message: "Logged out successfully" })
  
  // Clear the token cookie by setting it to expire immediately
  res.cookies.set("token", "", { 
    httpOnly: true, 
    secure: isHttps, 
    sameSite: "lax", 
    path: "/", 
    maxAge: 0,
    expires: new Date(0) // Set to epoch time to ensure immediate expiration
  })
  
  return res
}


