import { NextRequest, NextResponse } from "next/server"
import { getRawToken } from "../_lib/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const url = queryString ? `${API_BASE}/users?${queryString}` : `${API_BASE}/users`
    
    const r = await fetch(url, { 
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } 
    })
    const text = await r.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: r.status })
    } catch {
      return new NextResponse(text, { status: r.status })
    }
  } catch (e) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await req.json()
    const r = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: r.status })
    } catch {
      return new NextResponse(text, { status: r.status })
    }
  } catch {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }
}


