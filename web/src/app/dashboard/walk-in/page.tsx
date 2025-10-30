'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import WalkInSystem from '@/components/WalkInSystem'

export default function WalkInPage() {
  const [selectedDate, setSelectedDate] = useState('')
  const [isClient, setIsClient] = useState(false)

  const getLocalISODate = (): string => {
    const now = new Date()
    const tzOffsetMs = now.getTimezoneOffset() * 60000
    const local = new Date(now.getTime() - tzOffsetMs)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => {
    setIsClient(true)
    setSelectedDate(getLocalISODate())
  }, [])

  return (
    <div className="space-y-4">
      {/* Page Header (consistent with other pages) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Walk-In System</h1>
          <p className="text-sm text-gray-600">
            {isClient && selectedDate ? `Available technician hours for ${format(new Date(selectedDate), 'EEE, MMM d, yyyy')}` : 'Available technician hours'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="date" className="text-sm font-medium text-gray-700">
            Date:
          </label>
          <input
            type="date"
            id="date"
            value={selectedDate || getLocalISODate()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Walk-In System */}
      {isClient && (
        <WalkInSystem
          date={selectedDate || getLocalISODate()}
        />
      )}
    </div>
  )
}
