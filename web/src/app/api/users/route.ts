import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"
const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || ""

export async function GET() {
  try {
    if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    const r = await fetch(`${API_BASE}/users`, { headers: { "x-api-key": API_KEY } })
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
    if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    const body = await req.json()
    const r = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
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


