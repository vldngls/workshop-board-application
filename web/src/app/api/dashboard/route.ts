import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 DASHBOARD API - Fetching dashboard data')
    
    // Get JWT token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
    console.log('🔐 Token from cookies:', token ? 'Present' : 'Missing')
    
    if (!token) {
      console.log('❌ No token found in cookies')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Forward the request to the backend server
    const response = await fetch(`${API_BASE_URL}/job-orders/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
    
    console.log('📡 Backend response status:', response.status)
    
    if (!response.ok) {
      console.error('❌ Backend error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Backend error response:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Dashboard data received:', {
      stats: data.stats,
      carriedOverJobsCount: data.carriedOverJobs?.length || 0,
      allJobsCount: data.allJobs?.length || 0
    })
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('💥 Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
