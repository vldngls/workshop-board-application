import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../../_lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[CREATE-JOB-ORDER] Starting request')
    
    const token = await getRawToken()
    console.log('[CREATE-JOB-ORDER] Token retrieved:', token ? 'YES' : 'NO')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    console.log('[CREATE-JOB-ORDER] Calling backend:', `${API_BASE_URL}/appointments/${id}/create-job-order`)
    
    const response = await fetch(`${API_BASE_URL}/appointments/${id}/create-job-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    console.log('[CREATE-JOB-ORDER] Backend response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.log('[CREATE-JOB-ORDER] Backend error:', errorData)
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating job order from appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

