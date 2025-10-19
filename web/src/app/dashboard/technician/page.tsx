"use client"

import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  FiCalendar, 
  FiClock, 
  FiTool, 
  FiCheckCircle, 
  FiPause, 
  FiStar, 
  FiSearch, 
  FiUser
} from 'react-icons/fi'
import type { JobOrder } from '@/types/jobOrder'
import type { Appointment } from '@/types/appointment'

interface TechnicianStats {
  totalAssigned: number
  onGoing: number
  forRelease: number
  onHold: number
  important: number
  qualityInspection: number
  todayAppointments: number
}

interface JobOrderWithDetails extends JobOrder {
  createdBy: {
    _id: string
    name: string
    email: string
  }
}

interface AppointmentWithDetails extends Appointment {
  createdBy: {
    _id: string
    name: string
    email: string
  }
}

export default function TechnicianDashboard() {
  const [stats, setStats] = useState<TechnicianStats>({
    totalAssigned: 0,
    onGoing: 0,
    forRelease: 0,
    onHold: 0,
    important: 0,
    qualityInspection: 0,
    todayAppointments: 0
  })
  const [assignedJobs, setAssignedJobs] = useState<JobOrderWithDetails[]>([])
  const [todayAppointments, setTodayAppointments] = useState<AppointmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userInfo, setUserInfo] = useState<{ name: string; level?: string } | null>(null)

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchTechnicianData()
    fetchUserInfo()
  }, [])

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me', { 
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserInfo({ name: data.user.name, level: undefined }) // Level not in JWT, would need separate API call
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
  }

  const fetchTechnicianData = async () => {
    try {
      setLoading(true)
      
      // Fetch assigned job orders
      const jobsResponse = await fetch('/api/job-orders?assignedToMe=true&limit=1000', { credentials: 'include' })
      if (!jobsResponse.ok) throw new Error('Failed to fetch job orders')
      const jobsData = await jobsResponse.json()
      const assignedJobs: JobOrderWithDetails[] = jobsData.jobOrders || []

      // Fetch today's appointments
      const today = new Date().toISOString().split('T')[0]
      const appointmentsResponse = await fetch(`/api/appointments?date=${today}&assignedToMe=true`, { credentials: 'include' })
      if (!appointmentsResponse.ok) throw new Error('Failed to fetch appointments')
      const appointmentsData = await appointmentsResponse.json()
      const todayAppointments: AppointmentWithDetails[] = appointmentsData.appointments || []

      // Calculate statistics
      const newStats: TechnicianStats = {
        totalAssigned: assignedJobs.length,
        onGoing: assignedJobs.filter(job => job.status === 'OG').length,
        forRelease: assignedJobs.filter(job => job.status === 'FR').length,
        onHold: assignedJobs.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status)).length,
        important: assignedJobs.filter(job => job.isImportant).length,
        qualityInspection: assignedJobs.filter(job => job.status === 'QI').length,
        todayAppointments: todayAppointments.length
      }

      setStats(newStats)
      setAssignedJobs(assignedJobs)
      setTodayAppointments(todayAppointments)
    } catch (error) {
      console.error('Error fetching technician data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (jobId: string, taskIndex: number, status: 'Finished' | 'Unfinished') => {
    try {
      const job = assignedJobs.find(j => j._id === jobId)
      if (!job) return

      const updatedJobList = [...job.jobList]
      updatedJobList[taskIndex].status = status

      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobList: updatedJobList })
      })

      if (!response.ok) throw new Error('Failed to update task')
      
      toast.success(`Task marked as ${status.toLowerCase()}`)
      fetchTechnicianData() // Refresh data
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    }
  }

  const submitForQualityInspection = async (jobId: string) => {
    try {
      const response = await fetch(`/api/job-orders/${jobId}/submit-qi`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to submit for quality inspection')
      
      toast.success('Job submitted for quality inspection')
      fetchTechnicianData() // Refresh data
    } catch (error) {
      console.error('Error submitting for QI:', error)
      toast.error('Failed to submit for quality inspection')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Toaster position="top-right" />
        
        {/* Loading Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-800 to-blue-700 p-8 text-white">
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 bg-white/20 rounded-md w-80 mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded-md w-96 mb-3 animate-pulse"></div>
              </div>
              <div className="text-right">
                <div className="w-16 h-16 bg-white/20 rounded-md mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded-md w-32 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-white p-4 border border-slate-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-gray-200 rounded-md mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded-md w-12 mb-1 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded-md w-6 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Technician Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-800 to-blue-700 p-8 text-white">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-white">Technician Dashboard</h1>
              <p className="text-blue-200 text-base font-medium">
                Your assigned jobs and appointments
              </p>
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-blue-200">
                  <FiUser size={18} />
                  <span className="font-medium text-sm">{userInfo?.name}</span>
                  {userInfo?.level && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                      {userInfo.level}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-blue-200">
                  <FiCalendar size={18} />
                  <span className="font-medium text-sm">{currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-200">
                  <FiClock size={18} />
                  <span className="font-medium text-sm">{currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-blue-600/50 rounded-md flex items-center justify-center mb-2">
                <FiTool size={32} color="white" />
              </div>
              <div className="text-blue-200 font-medium text-sm">Technician Portal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Assigned */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-gray-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-gray-200 transition-colors duration-200">
              <FiTool size={18} color="#475569" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">Total Assigned</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalAssigned}</p>
          </div>
        </div>

        {/* On Going */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-blue-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors duration-200">
              <FiTool size={18} color="#2563eb" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">On Going</p>
            <p className="text-lg font-bold text-slate-900">{stats.onGoing}</p>
          </div>
        </div>

        {/* For Release */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-green-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-green-100 transition-colors duration-200">
              <FiCheckCircle size={18} color="#16a34a" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">For Release</p>
            <p className="text-lg font-bold text-slate-900">{stats.forRelease}</p>
          </div>
        </div>

        {/* On Hold */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-red-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-red-100 transition-colors duration-200">
              <FiPause size={18} color="#dc2626" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">On Hold</p>
            <p className="text-lg font-bold text-slate-900">{stats.onHold}</p>
          </div>
        </div>

        {/* Important */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-yellow-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-yellow-100 transition-colors duration-200">
              <FiStar size={18} color="#ca8a04" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">Important</p>
            <p className="text-lg font-bold text-slate-900">{stats.important}</p>
          </div>
        </div>

        {/* Quality Inspection */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-purple-100 transition-colors duration-200">
              <FiSearch size={18} color="#9333ea" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">Quality Check</p>
            <p className="text-lg font-bold text-slate-900">{stats.qualityInspection}</p>
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 cursor-pointer border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-indigo-50 rounded-md flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors duration-200">
              <FiCalendar size={18} color="#6366f1" />
            </div>
            <p className="text-xs text-slate-600 mb-1 font-medium">Today&apos;s Appointments</p>
            <p className="text-lg font-bold text-slate-900">{stats.todayAppointments}</p>
          </div>
        </div>
      </div>

      {/* Today's Appointments */}
      {todayAppointments.length > 0 && (
        <div className="floating-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
              <FiCalendar size={20} />
              Today&apos;s Appointments
            </h2>
            <span className="text-xs text-gray-700 font-semibold">{todayAppointments.length} appointment(s)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayAppointments.map((appointment) => (
              <div key={appointment._id} className="bg-indigo-500/20 backdrop-blur-sm border border-indigo-300/30 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-indigo-900">{appointment.plateNumber}</h3>
                  <span className="text-xs text-indigo-700 font-medium">
                    {appointment.timeRange.start} - {appointment.timeRange.end}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mb-2">Plate: {appointment.plateNumber}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Job Orders */}
      {assignedJobs.length > 0 ? (
        <div className="floating-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2">
              <FiTool size={20} />
              Your Assigned Job Orders
            </h2>
            <span className="text-xs text-gray-700 font-semibold">{assignedJobs.length} job(s)</span>
          </div>
          <div className="space-y-4">
            {assignedJobs.map((job) => (
              <div key={job._id} className="bg-white/40 backdrop-blur-sm border border-white/40 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{job.jobNumber}</h3>
                    <p className="text-sm text-gray-700">{job.plateNumber} - {job.vin}</p>
                    <p className="text-xs text-gray-600">
                      Date: {new Date(job.date).toLocaleDateString()} | 
                      Time: {job.timeRange.start} - {job.timeRange.end}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm border ${
                      job.status === 'OG' ? 'bg-blue-500/20 text-blue-700 border-blue-300/30' :
                      job.status === 'QI' ? 'bg-purple-500/20 text-purple-700 border-purple-300/30' :
                      job.status === 'WP' ? 'bg-orange-500/20 text-orange-700 border-orange-300/30' :
                      job.status === 'FR' ? 'bg-green-500/20 text-green-700 border-green-300/30' :
                      'bg-gray-500/20 text-gray-700 border-gray-300/30'
                    }`}>
                      {job.status === 'WP' ? 'Waiting Parts' :
                       job.status === 'OG' ? 'On Going' :
                       job.status === 'QI' ? 'Quality Inspection' :
                       job.status === 'FR' ? 'For Release' : job.status}
                    </span>
                    {job.isImportant && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                        ⭐ Important
                      </span>
                    )}
                  </div>
                </div>

                {/* Job Tasks */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Job Tasks</h4>
                  <div className="space-y-2">
                    {job.jobList.map((task, index) => (
                      <div key={index} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                        <span className="text-sm text-gray-800">{task.description}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateTaskStatus(job._id, index, 'Finished')}
                            disabled={task.status === 'Finished'}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              task.status === 'Finished'
                                ? 'bg-green-100 text-green-800 cursor-not-allowed'
                                : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/30 hover:shadow-lg hover:-translate-y-0.5'
                            }`}
                          >
                            {task.status === 'Finished' ? '✓ Finished' : 'Mark Finished'}
                          </button>
                          <button
                            onClick={() => updateTaskStatus(job._id, index, 'Unfinished')}
                            disabled={task.status === 'Unfinished'}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              task.status === 'Unfinished'
                                ? 'bg-gray-100 text-gray-800 cursor-not-allowed'
                                : 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30 border border-gray-300/30 hover:shadow-lg hover:-translate-y-0.5'
                            }`}
                          >
                            {task.status === 'Unfinished' ? '○ Unfinished' : 'Mark Unfinished'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parts Status */}
                {job.parts && job.parts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Parts Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {job.parts.map((part, index) => (
                        <div key={index} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                          <span className="text-sm text-gray-800">{part.name}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            part.availability === 'Available'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {part.availability}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit for Quality Inspection */}
                {job.jobList.every(task => task.status === 'Finished') && job.status === 'OG' && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => submitForQualityInspection(job._id)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 text-sm"
                    >
                      Submit for Quality Inspection
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="floating-card p-8 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Assigned Jobs</h3>
          <p className="text-gray-600">You don&apos;t have any assigned job orders at the moment.</p>
        </div>
      )}
    </div>
  )
}
