'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import AddJobOrderModal from './AddJobOrderModal'

interface AvailableSlot {
  startTime: string
  endTime: string
  durationHighlight: string
  dailyHoursRemaining: number
}

interface TechnicianSlot {
  technician: {
    _id: string
    name: string
    level: string
  }
  availableSlots: AvailableSlot[]
  currentDailyHours: number
  dailyHoursRemaining: number
}

interface WalkInSystemProps {
  date: string
}

export default function WalkInSystem({ date }: WalkInSystemProps) {
  const duration = 60 // Fixed 60 minutes for walk-ins
  const [selectedSlot, setSelectedSlot] = useState<{technicianId: string, startTime: string, endTime: string} | null>(null)
  const [showJobModal, setShowJobModal] = useState(false)

  // Fetch available slots
  const { data: slotsData, isLoading, error, refetch } = useQuery({
    queryKey: ['walk-in-slots', date, duration],
    queryFn: async () => {
      const response = await fetch(`/api/job-orders/walk-in-slots?date=${encodeURIComponent(date)}&duration=${duration}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch available slots')
      }
      return response.json()
    },
    enabled: !!date && !!duration,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const technicianSlots: TechnicianSlot[] = slotsData?.technicianSlots || []

  const handleSlotClick = (technicianId: string, startTime: string, endTime: string) => {
    setSelectedSlot({ technicianId, startTime, endTime })
    setShowJobModal(true)
  }

  const handleJobCreated = () => {
    setSelectedSlot(null)
    setShowJobModal(false)
    // Refetch available slots to update the display
    refetch()
  }

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'level-3':
        return 'bg-blue-100 text-blue-800'
      case 'level-2':
        return 'bg-green-100 text-green-800'
      case 'level-1':
        return 'bg-yellow-100 text-yellow-800'
      case 'level-0':
      case 'untrained':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
      <div className="text-center py-4 text-neutral-500 text-sm">
        Loading available time slots...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500 text-sm">
        Error loading available slots. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="floating-card p-5 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Walk-In System</h2>
            <p className="text-sm text-neutral-600">
              {format(new Date(date), 'EEE, MMM d, yyyy')} - Click green areas to create 1-hour job orders
            </p>
          </div>
        </div>
      </div>

      {/* Technician Timeline Bars */}
      {technicianSlots.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">
          No technicians available for 1-hour slots on this date.
        </div>
      ) : (
        <div className="space-y-4">
          {technicianSlots.map((technicianSlot) => (
            <div key={technicianSlot.technician._id} className="floating-card p-4 rounded-2xl">
              {/* Technician Header with Hours */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getLevelIcon(technicianSlot.technician.level)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">{technicianSlot.technician.name}</h3>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(technicianSlot.technician.level)}`}>
                      {technicianSlot.technician.level}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-neutral-600">
                    <span className="font-semibold text-red-600">{technicianSlot.currentDailyHours.toFixed(1)}h</span> used
                  </div>
                  <div className="text-sm text-green-600">
                    <span className="font-semibold">{technicianSlot.dailyHoursRemaining.toFixed(1)}h</span> remaining
                  </div>
                </div>
              </div>

              {/* Timeline Bar */}
              <div className="relative">
                {/* Time labels */}
                <div className="flex justify-between text-xs text-neutral-500 mb-2">
                  <span>7:00 AM</span>
                  <span>9:00 AM</span>
                  <span>12:00 PM</span>
                  <span>3:00 PM</span>
                  <span>6:00 PM</span>
                </div>

                {/* Main timeline bar */}
                <div className="relative h-8 bg-gray-200 rounded-xl overflow-hidden">
                  {/* Generate time segments */}
                  {(() => {
                    const segments = []
                    const startHour = 7
                    const endHour = 18
                    const totalMinutes = (endHour - startHour) * 60
                    
                    for (let i = 0; i < totalMinutes; i += 30) {
                      const currentTime = `${String(startHour + Math.floor(i / 60)).padStart(2, '0')}:${String((i % 60)).padStart(2, '0')}`
                      const segmentStart = (i / totalMinutes) * 100
                      const segmentWidth = (30 / totalMinutes) * 100
                      
                      // Check if this segment is available for the selected duration
                      const isAvailable = technicianSlot.availableSlots.some(slot => 
                        slot.startTime === currentTime
                      )
                      
                      const isSelected = selectedSlot?.technicianId === technicianSlot.technician._id &&
                                       selectedSlot?.startTime === currentTime
                      
                      segments.push(
                        <div
                          key={currentTime}
                          className={`absolute h-full cursor-pointer transition-all hover:opacity-90 ${
                            isSelected
                              ? 'bg-blue-600 z-10'
                              : isAvailable
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-red-400/60'
                          }`}
                          style={{
                            left: `${segmentStart}%`,
                            width: `${segmentWidth}%`
                          }}
                          onClick={() => {
                            if (isAvailable) {
                              // Calculate end time based on duration
                              const [startHour, startMinute] = currentTime.split(':').map(Number)
                              const startMinutes = startHour * 60 + startMinute
                              const endMinutes = startMinutes + duration
                              const endHour = Math.floor(endMinutes / 60)
                              const endMin = endMinutes % 60
                              const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
                              
                              handleSlotClick(technicianSlot.technician._id, currentTime, endTime)
                            }
                          }}
                          title={`${currentTime} - ${isAvailable ? 'Available' : 'Occupied'}${isAvailable ? ` (${duration}min)` : ''}`}
                        />
                      )
                    }
                    
                    return segments
                  })()}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-2 text-xs text-neutral-600">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-400/60 rounded"></div>
                    <span>Occupied</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-600 rounded"></div>
                    <span>Selected</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Slot Info */}
      {selectedSlot && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold text-blue-900">Selected Time Slot</h4>
              <div className="text-sm text-blue-800 mt-1">
                <span className="font-medium">{technicianSlots.find(t => t.technician._id === selectedSlot.technicianId)?.technician.name}</span>
                {' • '}
                <span>{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</span>
                {' • '}
                <span>1 hour</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedSlot(null)}
              className="btn-secondary text-sm px-3 py-1 rounded-xl"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Job Order Modal */}
      {showJobModal && selectedSlot && (
        <AddJobOrderModal
          onClose={() => {
            setShowJobModal(false)
            setSelectedSlot(null)
          }}
          onSuccess={handleJobCreated}
          prefilledData={{
            assignedTechnician: selectedSlot.technicianId,
            timeRange: {
              start: selectedSlot.startTime,
              end: selectedSlot.endTime
            },
            date: date,
            status: 'OG'
          }}
        />
      )}
    </div>
  )
}
