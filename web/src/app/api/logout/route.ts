import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Logged out successfully" })
  
  // Clear the token cookie by setting it to expire immediately
  res.cookies.set("token", "", { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: "lax", 
    path: "/", 
    maxAge: 0,
    expires: new Date(0) // Set to epoch time to ensure immediate expiration
  })
  
  return res
}


