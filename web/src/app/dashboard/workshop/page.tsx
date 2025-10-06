"use client"

import { useState } from 'react'
import WorkshopTimetable from '@/components/WorkshopTimetable'

export default function WorkshopPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Workshop Board</h1>
        <div className="text-sm text-gray-600">
          Interactive timetable view of all job orders
        </div>
      </div>
      
      <WorkshopTimetable 
        date={selectedDate} 
        onDateChange={setSelectedDate} 
      />
    </div>
  )
}
