import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE}/maintenance/settings/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // no auth: public endpoint
      cache: 'no-store'
    })

    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return new NextResponse(text, { status: response.status })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
  }
}


