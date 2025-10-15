import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'
    
    const response = await fetch(`${serverUrl}/api/appointments/delete-all-no-show`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({ error: errorData.message || 'Failed to delete all no-show appointments' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error deleting all no-show appointments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
