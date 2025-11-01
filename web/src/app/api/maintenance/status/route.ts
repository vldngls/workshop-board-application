import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function GET(_request: NextRequest) {
  try {
    // Use public endpoint for maintenance status check (no auth required)
    const response = await fetch(`${API_BASE}/maintenance/settings/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({
        isUnderMaintenance: !!data.isUnderMaintenance,
        maintenanceMessage: data.maintenanceMessage || ''
      }, { status: 200 })
    }

    // If public endpoint fails, treat as not under maintenance to avoid blocking UI
    return NextResponse.json({ isUnderMaintenance: false, maintenanceMessage: '' }, { status: 200 })
  } catch (e) {
    // Network or unexpected error -> default to not under maintenance
    return NextResponse.json({ isUnderMaintenance: false, maintenanceMessage: '' }, { status: 200 })
  }
}


