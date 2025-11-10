'use client'

import { useMemo, useState, useEffect } from 'react'
import WorkshopTimetable from '@/components/WorkshopTimetable'
import type { WorkshopDataPayload } from '@/lib/workshopData'

interface WorkshopPageClientProps {
  highlightId?: string
  dateParam?: string
  initialData?: WorkshopDataPayload
}

export default function WorkshopPageClient({
  highlightId,
  dateParam,
  initialData,
}: WorkshopPageClientProps) {
  const initialDate = useMemo(() => {
    if (dateParam) {
      const parsed = new Date(dateParam)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }
    return new Date()
  }, [dateParam])

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate)

  useEffect(() => {
    setSelectedDate(initialDate)
  }, [initialDate])

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Job Control Board</h1>
        <div className="text-sm text-gray-600">
          Interactive timetable view of all job orders
        </div>
      </div>

      <WorkshopTimetable
        date={selectedDate}
        onDateChange={setSelectedDate}
        highlightJobId={highlightId}
        initialData={initialData}
      />
    </div>
  )
}


