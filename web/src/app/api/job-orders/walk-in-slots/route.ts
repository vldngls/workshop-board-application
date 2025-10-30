import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../_lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const duration = searchParams.get('duration')

    if (!date || !duration) {
      return NextResponse.json({ error: 'Date and duration are required' }, { status: 400 })
    }

    const token = await getRawToken()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward the request to the backend API
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    
    const response = await fetch(`${backendUrl}/job-orders/walk-in-slots?date=${encodeURIComponent(date)}&duration=${encodeURIComponent(duration)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching walk-in slots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
