import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../_lib/auth'

// Align with other routes: use NEXT_PUBLIC_API_BASE_URL and same default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '30'
    
    const response = await fetch(`${API_BASE_URL}/job-orders/snapshots?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(errorData, { status: response.status })
    }
    
    const data = await response.json()
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error fetching workshop snapshots:', error)
    return NextResponse.json({ error: 'Failed to fetch workshop snapshots' }, { status: 500 })
  }
}
