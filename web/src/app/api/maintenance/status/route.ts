import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../_lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function GET(_request: NextRequest) {
  try {
    const token = await getRawToken().catch(() => null)
    // Try explicit status endpoint first
    const statusRes = await fetch(`${API_BASE}/maintenance/settings/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    })

    if (statusRes.ok) {
      const data = await statusRes.json()
      // Normalize to common shape
      return NextResponse.json({
        isUnderMaintenance: !!data.isUnderMaintenance,
        maintenanceMessage: data.maintenanceMessage || ''
      }, { status: 200 })
    }

    // If upstream returns 404, fall back to reading full settings
    if (statusRes.status === 404) {
      const settingsRes = await fetch(`${API_BASE}/maintenance/settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        cache: 'no-store'
      })
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        return NextResponse.json({
          isUnderMaintenance: !!settings.isUnderMaintenance,
          maintenanceMessage: settings.maintenanceMessage || ''
        }, { status: 200 })
      }

      // Both endpoints unavailable -> treat as not under maintenance
      return NextResponse.json({ isUnderMaintenance: false, maintenanceMessage: '' }, { status: 200 })
    }

    // Other upstream errors: map to not under maintenance to avoid blocking UI in dev
    return NextResponse.json({ isUnderMaintenance: false, maintenanceMessage: '' }, { status: 200 })
  } catch (e) {
    // Network or unexpected error -> default to not under maintenance
    return NextResponse.json({ isUnderMaintenance: false, maintenanceMessage: '' }, { status: 200 })
  }
}


