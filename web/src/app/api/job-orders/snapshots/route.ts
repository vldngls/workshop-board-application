import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
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
