import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../_lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
const API_KEY = process.env.API_KEY

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const technician = searchParams.get('technician')
    const date = searchParams.get('date')
    const search = searchParams.get('search')
    const assignedToMe = searchParams.get('assignedToMe')
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '10'
    
    const queryParams = new URLSearchParams()
    if (status) queryParams.append('status', status)
    if (technician) queryParams.append('technician', technician)
    if (date) queryParams.append('date', date)
    if (search) queryParams.append('search', search)
    if (assignedToMe) queryParams.append('assignedToMe', assignedToMe)
    queryParams.append('page', page)
    queryParams.append('limit', limit)
    
    const url = `${API_BASE_URL}/job-orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': API_KEY || '',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching job orders:', error)
    return NextResponse.json({ error: 'Failed to fetch job orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    
    const response = await fetch(`${API_BASE_URL}/job-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY || '',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(errorData, { status: response.status })
    }
    
    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating job order:', error)
    return NextResponse.json({ error: 'Failed to create job order' }, { status: 500 })
  }
}
