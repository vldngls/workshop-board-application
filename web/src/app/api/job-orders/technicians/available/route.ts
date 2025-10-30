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
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    
    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: 'Date, startTime, and endTime are required' }, { status: 400 })
    }
    
    const queryParams = new URLSearchParams({
      date,
      startTime,
      endTime
    })
    
    const response = await fetch(`${API_BASE_URL}/job-orders/technicians/available?${queryParams.toString()}`, {
      headers: {
        'x-api-key': API_KEY || '',
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching available technicians:', error)
    return NextResponse.json({ error: 'Failed to fetch available technicians' }, { status: 500 })
  }
}
