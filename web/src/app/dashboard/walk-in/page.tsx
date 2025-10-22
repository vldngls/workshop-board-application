'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import WalkInSystem from '@/components/WalkInSystem'

export default function WalkInPage() {
  const [selectedDate, setSelectedDate] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setSelectedDate(new Date().toISOString().split('T')[0])
  }, [])

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Walk-In System</h1>
            <p className="text-sm text-neutral-600">
              {isClient && selectedDate ? `Available technician hours for ${format(new Date(selectedDate), 'EEE, MMM d, yyyy')}` : 'Available technician hours'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="date" className="text-sm font-medium text-neutral-700">
              Date:
            </label>
            <input
              type="date"
              id="date"
              value={selectedDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Walk-In System */}
      {isClient && (
        <WalkInSystem
          date={selectedDate || new Date().toISOString().split('T')[0]}
        />
      )}
    </div>
  )
}
