import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"
const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || ""

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await _req.json()
    const r = await fetch(`${API_BASE}/users/${params.id}`, {
      method: "PUT",
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await fetch(`${API_BASE}/users/${params.id}`, {
      method: "DELETE",
      headers: { "x-api-key": API_KEY },
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


