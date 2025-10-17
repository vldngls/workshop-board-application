"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import WorkshopTimetable from '@/components/WorkshopTimetable'

export default function WorkshopPage() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const dateParam = searchParams.get('date')
  
  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam) {
      const date = new Date(dateParam)
      return isNaN(date.getTime()) ? new Date() : date
    }
    return new Date()
  })

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Workshop Board</h1>
        <div className="text-sm text-gray-600">
          Interactive timetable view of all job orders
        </div>
      </div>
      
      <WorkshopTimetable 
        date={selectedDate} 
        onDateChange={setSelectedDate}
        highlightJobId={highlightId || undefined}
      />
    </div>
  )
}
