import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../_lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const response = await fetch(`${API_BASE}/maintenance/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return new NextResponse(text, { status: response.status })
    }
  } catch (e) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }
}