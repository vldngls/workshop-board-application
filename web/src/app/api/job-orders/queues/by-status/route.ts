import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../../_lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
const API_KEY = process.env.API_KEY

export async function GET(request: NextRequest) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const statuses = searchParams.get('statuses')
    const limit = searchParams.get('limit') || '100'
    
    if (!statuses) {
      return NextResponse.json({ error: 'statuses query parameter required' }, { status: 400 })
    }
    
    const queryParams = new URLSearchParams()
    queryParams.append('statuses', statuses)
    queryParams.append('limit', limit)
    
    const url = `${API_BASE_URL}/job-orders/queues/by-status?${queryParams.toString()}`
    
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
    console.error('Error fetching job queues:', error)
    return NextResponse.json({ error: 'Failed to fetch job queues' }, { status: 500 })
  }
}

