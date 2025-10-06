"use client"

import { useState, useEffect } from 'react'
import type { JobOrder } from '@/types/jobOrder'

interface WorkshopTimetableProps {
  date: Date
  onDateChange: (date: Date) => void
}

interface TimeSlot {
  time: string
  hour: number
  minute: number
}

interface Technician {
  _id: string
  name: string
  email: string
}

interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: Technician
  createdBy: Technician
}

const TIME_SLOTS: TimeSlot[] = [
  { time: '08:00', hour: 8, minute: 0 },
  { time: '09:00', hour: 9, minute: 0 },
  { time: '10:00', hour: 10, minute: 0 },
  { time: '11:00', hour: 11, minute: 0 },
  { time: '12:00', hour: 12, minute: 0 },
  { time: '13:00', hour: 13, minute: 0 },
  { time: '14:00', hour: 14, minute: 0 },
  { time: '15:00', hour: 15, minute: 0 },
  { time: '16:00', hour: 16, minute: 0 },
  { time: '17:00', hour: 17, minute: 0 },
  { time: '18:00', hour: 18, minute: 0 }
]

const STATUS_COLORS = {
  'Incomplete': 'bg-red-100 border-red-300 text-red-800',
  'In Progress': 'bg-yellow-100 border-yellow-300 text-yellow-800',
  'Complete': 'bg-green-100 border-green-300 text-green-800'
}

export default function WorkshopTimetable({ date, onDateChange }: WorkshopTimetableProps) {
  const [jobOrders, setJobOrders] = useState<JobOrderWithDetails[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobOrderWithDetails | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [date])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch job orders for the selected date
      const dateStr = date.toISOString().split('T')[0]
      const jobOrdersResponse = await fetch(`/api/job-orders?date=${dateStr}`)
      if (!jobOrdersResponse.ok) throw new Error('Failed to fetch job orders')
      const jobOrdersData = await jobOrdersResponse.json()
      
      // Fetch technicians
      const techniciansResponse = await fetch('/api/users')
      if (!techniciansResponse.ok) throw new Error('Failed to fetch technicians')
      const techniciansData = await techniciansResponse.json()
      
      setJobOrders(jobOrdersData.jobOrders || [])
      setTechnicians(techniciansData.users?.filter((user: any) => user.role === 'technician') || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getJobAtTime = (technicianId: string, timeSlot: TimeSlot): JobOrderWithDetails | null => {
    return jobOrders.find(job => {
      if (job.assignedTechnician._id !== technicianId) return false
      
      const jobStart = parseTime(job.timeRange.start)
      const slotTime = timeSlot.hour * 60 + timeSlot.minute
      
      // Show job in the cell that matches its start time
      return slotTime === jobStart
    }) || null
  }

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const handleCellClick = (job: JobOrderWithDetails) => {
    setSelectedJob(job)
    setShowModal(true)
  }

  const getJobDuration = (job: JobOrderWithDetails): number => {
    const start = parseTime(job.timeRange.start)
    const end = parseTime(job.timeRange.end)
    return end - start
  }

  const getJobProgress = (job: JobOrderWithDetails): number => {
    const finishedTasks = job.jobList.filter(task => task.status === 'Finished').length
    return job.jobList.length > 0 ? (finishedTasks / job.jobList.length) * 100 : 0
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    onDateChange(newDate)
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading timetable...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <button
          onClick={() => navigateDate('prev')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          ← Previous
        </button>
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">{formatDate(date)}</h2>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateDate('next')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Timetable */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-48 px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">
                  Technician
                </th>
                {TIME_SLOTS.map((slot) => (
                  <th
                    key={slot.time}
                    className="w-24 px-2 py-3 text-center text-xs font-medium text-gray-600 border-r"
                  >
                    {formatTime(slot.time)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {technicians.map((technician) => (
                <tr key={technician._id} className="border-t h-20">
                  <td className="w-48 px-4 py-3 text-sm font-medium text-gray-900 border-r bg-gray-50 h-20">
                    {technician.name}
                  </td>
                  {TIME_SLOTS.map((slot) => {
                    const job = getJobAtTime(technician._id, slot)
                    return (
                      <td
                        key={`${technician._id}-${slot.time}`}
                        className="w-24 h-20 px-1 py-1 border-r border-b relative"
                      >
                        {job ? (
                          <button
                            onClick={() => handleCellClick(job)}
                            className={`w-full h-full rounded text-xs font-medium border-2 transition-all hover:shadow-md relative ${STATUS_COLORS[job.status]}`}
                            title={`${job.jobNumber} - ${job.plateNumber} (${getJobProgress(job).toFixed(0)}% complete)`}
                          >
                            <div className="truncate font-semibold">{job.jobNumber}</div>
                            <div className="truncate text-xs opacity-75">{job.plateNumber}</div>
                            {job.status === 'In Progress' && (
                              <div className="absolute bottom-1 left-1 right-1">
                                <div className="bg-white bg-opacity-50 rounded-full h-1">
                                  <div 
                                    className="bg-blue-500 h-1 rounded-full transition-all"
                                    style={{ width: `${getJobProgress(job)}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </button>
                        ) : (
                          <div className="w-full h-full bg-gray-50 rounded min-h-[4rem]"></div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics and Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistics */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-3">Daily Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Jobs</div>
              <div className="text-2xl font-bold text-blue-600">{jobOrders.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Completed</div>
              <div className="text-2xl font-bold text-green-600">
                {jobOrders.filter(job => job.status === 'Complete').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">In Progress</div>
              <div className="text-2xl font-bold text-yellow-600">
                {jobOrders.filter(job => job.status === 'In Progress').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Incomplete</div>
              <div className="text-2xl font-bold text-red-600">
                {jobOrders.filter(job => job.status === 'Incomplete').length}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-3">Status Legend</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span>Incomplete - Not started</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>In Progress - Currently being worked on</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span>Complete - Finished</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Click on any job cell to view detailed information
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {showModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">Job Order Details</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Job Number</label>
                    <p className="text-lg font-semibold">{selectedJob.jobNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      selectedJob.status === 'Complete' ? 'bg-green-100 text-green-800' :
                      selectedJob.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedJob.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Plate Number</label>
                    <p className="text-lg">{selectedJob.plateNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">VIN</label>
                    <p className="text-sm font-mono">{selectedJob.vin}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Assigned Technician</label>
                    <p className="text-lg">{selectedJob.assignedTechnician.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Time Slot</label>
                    <p className="text-lg">{formatTime(selectedJob.timeRange.start)} - {formatTime(selectedJob.timeRange.end)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Job Tasks</label>
                  <div className="mt-2 space-y-2">
                    {selectedJob.jobList.map((task, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{task.description}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          task.status === 'Finished' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Parts Required</label>
                  <div className="mt-2 space-y-2">
                    {selectedJob.parts.map((part, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{part.name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          part.availability === 'Available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {part.availability}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
