import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../_lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    
    const response = await fetch(`${API_BASE}/bug-reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    const text = await response.text()
    
    // Handle 500 errors from backend gracefully - but still return proper error structure
    if (response.status === 500) {
      console.error('Backend returned 500 for bug-reports POST endpoint')
      try {
        const errorData = JSON.parse(text)
        return NextResponse.json({ 
          error: errorData.error || 'Internal server error',
          details: errorData.details 
        }, { status: 500 })
      } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    }
    
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return new NextResponse(text, { status: response.status })
    }
  } catch (e: any) {
    console.error('Error in bug-reports POST route:', e)
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const url = queryString ? `${API_BASE}/bug-reports?${queryString}` : `${API_BASE}/bug-reports`
    
    const response = await fetch(url, { 
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } 
    })
    
    // Handle 500 errors from backend gracefully
    if (response.status === 500) {
      console.error('Backend returned 500 for bug-reports endpoint')
      return NextResponse.json({ error: 'Internal server error', bugReports: [] }, { status: 500 })
    }
    
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return new NextResponse(text, { status: response.status })
    }
  } catch (e: any) {
    console.error('Error in bug-reports GET route:', e)
    // Return empty array instead of error to prevent UI issues
    return NextResponse.json({ error: "Upstream error", bugReports: [] }, { status: 502 })
  }
}