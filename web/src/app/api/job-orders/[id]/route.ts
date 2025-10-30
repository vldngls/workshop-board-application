import { NextRequest, NextResponse } from 'next/server'
import { getRawToken } from '../../_lib/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
const API_KEY = process.env.API_KEY

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
  const { id } = await params
    const response = await fetch(`${API_BASE_URL}/job-orders/${id}`, {
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
    console.error('Error fetching job order:', error)
    return NextResponse.json({ error: 'Failed to fetch job order' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 })
    }
    
    const body = await request.json()
  const { id } = await params
    
    const response = await fetch(`${API_BASE_URL}/job-orders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY || '',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update job order' }))
      
      // If backend returns 401 or 403, it means token is invalid/expired
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ 
          error: 'Your session has expired or is invalid. Please log in again.' 
        }, { status: 401 })
      }
      
      return NextResponse.json(errorData, { status: response.status })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to update job order',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getRawToken()
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
  const { id } = await params
    const response = await fetch(`${API_BASE_URL}/job-orders/${id}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY || '',
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
    console.error('Error deleting job order:', error)
    return NextResponse.json({ error: 'Failed to delete job order' }, { status: 500 })
  }
}
