'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

interface TechnicianHoursSummaryProps {
  date: Date
}

interface TechnicianSlot {
  technician: {
    _id: string
    name: string
    level: string
  }
  currentDailyHours: number
  dailyHoursRemaining: number
}

export default function TechnicianHoursSummary({ date }: TechnicianHoursSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Fetch technician hours data
  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['workshop-slots', date.toISOString().split('T')[0]],
    queryFn: async () => {
      const response = await fetch(`/api/job-orders/workshop-slots?date=${encodeURIComponent(date.toISOString().split('T')[0])}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch technician hours')
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const technicianSlots: TechnicianSlot[] = slotsData?.technicianSlots || []

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'level-3':
        return 'text-blue-600'
      case 'level-2':
        return 'text-green-600'
      case 'level-1':
        return 'text-yellow-600'
      case 'level-0':
      case 'untrained':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'level-3':
        return '⭐'
      case 'level-2':
        return '🔧'
      case 'level-1':
        return '🛠️'
      case 'level-0':
      case 'untrained':
        return '👶'
      default:
        return '👤'
    }
  }

  if (isLoading) {
    return (
      <div className="floating-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Technician Hours</h3>
          <div className="text-xs text-neutral-500">Loading...</div>
        </div>
      </div>
    )
  }

  // Calculate total hours used and remaining
  const totalUsed = technicianSlots.reduce((sum, slot) => sum + slot.currentDailyHours, 0)
  const totalRemaining = technicianSlots.reduce((sum, slot) => sum + slot.dailyHoursRemaining, 0)

  return (
    <div className="floating-card">
      {/* Compact Header */}
      <div 
        className="p-3 cursor-pointer hover:bg-neutral-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Technician Hours Summary</h3>
            <div className="text-xs text-neutral-600">
              {format(date, 'MMM d')} • {technicianSlots.length} technicians
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-neutral-600">
              <span className="font-semibold text-red-600">{totalUsed.toFixed(1)}h</span> used • 
              <span className="font-semibold text-green-600 ml-1">{totalRemaining.toFixed(1)}h</span> remaining
            </div>
            {isExpanded ? (
              <FiChevronUp className="h-4 w-4 text-neutral-500" />
            ) : (
              <FiChevronDown className="h-4 w-4 text-neutral-500" />
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral-200 p-3 bg-neutral-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {technicianSlots.map((technicianSlot) => (
              <div key={technicianSlot.technician._id} className="bg-white rounded-md p-3 border border-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{getLevelIcon(technicianSlot.technician.level)}</span>
                  <div>
                    <h4 className="font-medium text-neutral-900 text-xs">{technicianSlot.technician.name}</h4>
                    <span className={`text-xs font-medium ${getLevelColor(technicianSlot.technician.level)}`}>
                      {technicianSlot.technician.level}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600">Used:</span>
                    <span className="font-semibold text-red-600">
                      {technicianSlot.currentDailyHours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-600">Remaining:</span>
                    <span className="font-semibold text-green-600">
                      {technicianSlot.dailyHoursRemaining.toFixed(1)}h
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-2">
                  <div className="w-full bg-neutral-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${(technicianSlot.currentDailyHours / 7.5) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 text-center">
                    {((technicianSlot.currentDailyHours / 7.5) * 100).toFixed(0)}% capacity
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {technicianSlots.length === 0 && (
            <div className="text-center py-4 text-neutral-500 text-sm">
              No technicians found for this date.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
