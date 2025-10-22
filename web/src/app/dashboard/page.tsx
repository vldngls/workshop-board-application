"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { 
  FiCalendar, 
  FiClock, 
  FiSettings, 
  FiClipboard, 
  FiTool, 
  FiCheckCircle, 
  FiPause, 
  FiRefreshCw, 
  FiStar, 
  FiSearch, 
  FiPackage,
  FiBarChart,
  FiAlertTriangle,
  FiUsers,
  FiSettings as FiWrench
} from 'react-icons/fi'
import type { JobOrder } from '@/types/jobOrder'
import SkeletonLoader from '@/components/SkeletonLoader'

interface DashboardStats {
  total: number
  onGoing: number
  forRelease: number
  onHold: number
  carriedOver: number
  important: number
  qualityInspection: number
  finishedUnclaimed: number
}

interface JobOrderWithTechnician extends JobOrder {
  assignedTechnician: {
    _id: string
    name: string
    email: string
  }
  createdBy: {
    _id: string
    name: string
    email: string
  }
}

export default function MainDashboard() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    onGoing: 0,
    forRelease: 0,
    onHold: 0,
    carriedOver: 0,
    important: 0,
    qualityInspection: 0,
    finishedUnclaimed: 0
  })
  const [carriedOverJobs, setCarriedOverJobs] = useState<JobOrderWithTechnician[]>([])
  const [importantJobs, setImportantJobs] = useState<JobOrderWithTechnician[]>([])
  const [anomalyJobs, setAnomalyJobs] = useState<JobOrderWithTechnician[]>([])
  const [allJobs, setAllJobs] = useState<JobOrderWithTechnician[]>([])
  const [loading, setLoading] = useState(true)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedJobForReassign, setSelectedJobForReassign] = useState<JobOrderWithTechnician | null>(null)
  const [showBreakSettings, setShowBreakSettings] = useState(false)
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false)
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobOrderWithTechnician | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isCheckingCarryOver, setIsCheckingCarryOver] = useState(false)
  
  // Break time settings (stored in localStorage)
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // Load break settings from localStorage
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
  }, [])

  // Check user role and redirect technicians
  useEffect(() => {
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
          const role = data.user.role
          console.log('Detected role from server:', role) // Debug log
          
          setUserRole(role)
          
          // Redirect technicians to their specific dashboard
          if (role === 'technician') {
            router.push('/dashboard/technician')
            return
          }
        } else {
          console.log('No valid token, redirecting to login')
          router.push('/login')
          return
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        router.push('/login')
        return
      }
    }

    fetchUserInfo()
  }, [router])

  useEffect(() => {
    // Only fetch dashboard data for non-technicians
    if (userRole && userRole !== 'technician') {
      fetchDashboardData()
      
      // Auto-check for carry-over jobs if user is admin or job-controller
      if (userRole === 'administrator' || userRole === 'job-controller') {
        handleCheckCarryOver()
      }
    }
  }, [userRole])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Calculate end time from start time and duration, accounting for lunch break
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)
    
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const breakStartDate = new Date()
    breakStartDate.setHours(breakStartHour, breakStartMinute, 0, 0)
    
    const breakEndDate = new Date()
    breakEndDate.setHours(breakEndHour, breakEndMinute, 0, 0)
    
    const breakDuration = (breakEndDate.getTime() - breakStartDate.getTime()) / (1000 * 60)
    
    // Calculate initial end time without break
    const initialEndDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    
    // Check if work period overlaps with break
    // Work overlaps if: start < breakEnd AND initialEnd > breakStart
    if (startDate < breakEndDate && initialEndDate > breakStartDate) {
      // The break falls within the work period - add break duration to skip it
      const endDate = new Date(initialEndDate.getTime() + breakDuration * 60 * 1000)
      
      const endHour = String(endDate.getHours()).padStart(2, '0')
      const endMinute = String(endDate.getMinutes()).padStart(2, '0')
      return `${endHour}:${endMinute}`
    }
    
    // No overlap with break, return initial calculation
    const endHour = String(initialEndDate.getHours()).padStart(2, '0')
    const endMinute = String(initialEndDate.getMinutes()).padStart(2, '0')
    return `${endHour}:${endMinute}`
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch all job orders (with pagination limit increased)
      const response = await fetch('/api/job-orders?limit=1000')
      if (!response.ok) throw new Error('Failed to fetch job orders')
      const data = await response.json()
      const allJobs: JobOrderWithTechnician[] = data.jobOrders || []

      // Calculate statistics
      const newStats: DashboardStats = {
        total: allJobs.length,
        onGoing: allJobs.filter(job => job.status === 'OG').length,
        forRelease: allJobs.filter(job => job.status === 'FR').length,
        onHold: allJobs.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status)).length,
        carriedOver: allJobs.filter(job => job.carriedOver).length,
        important: allJobs.filter(job => job.isImportant).length,
        qualityInspection: allJobs.filter(job => job.status === 'QI').length,
        finishedUnclaimed: allJobs.filter(job => job.status === 'FU' || job.status === 'CP').length
      }

      // Filter carried over and important jobs (exclude completed jobs)
      const carried = allJobs.filter(job => job.carriedOver && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP')
      const important = allJobs.filter(job => job.isImportant && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP')
      
      // Identify pending job orders (mainly WP status or jobs needing attention)
      const pendingJobs = allJobs.filter(job => {
        // Exclude completed jobs
        if (job.status === 'FR' || job.status === 'FU' || job.status === 'CP') return false
        
        // Include all Waiting Parts jobs
        if (job.status === 'WP') return true
        
        // Check for unavailable parts in non-WP jobs
        const hasUnavailableParts = job.parts && job.parts.some(part => part.availability === 'Unavailable')
        
        // Check for overdue jobs (older than 7 days and not on hold)
        const jobDate = new Date(job.date)
        const daysSinceJob = Math.floor((new Date().getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24))
        const isOverdue = daysSinceJob > 7 && !['HC', 'HW', 'HI', 'WP'].includes(job.status)
        
        // Check for jobs with all tasks finished but not submitted for QI
        const allTasksFinished = job.jobList && job.jobList.every(task => task.status === 'Finished')
        const notSubmittedForQI = allTasksFinished && job.status !== 'QI'
        
        return hasUnavailableParts || isOverdue || notSubmittedForQI
      })

      setStats(newStats)
      setAllJobs(allJobs)
      setCarriedOverJobs(carried)
      setImportantJobs(important)
      setAnomalyJobs(pendingJobs)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateJobStatus = useCallback((jobId: string, status: string, remarks?: string) => {
    // For now, just show a toast - in a real implementation, you'd call an API
    console.log('Update job status:', { jobId, status, remarks })
  }, [])

  const handleCarryOver = useCallback((jobId: string) => {
    // For now, just show a toast - in a real implementation, you'd call an API
    console.log('Carry over job:', jobId)
  }, [])

  const handleCheckCarryOver = async () => {
    if (isCheckingCarryOver) return
    
    setIsCheckingCarryOver(true)
    try {
      const response = await fetch('/api/job-orders/check-carry-over', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Found and processed ${data.count} carry-over job(s)`)
        // Refresh dashboard data
        fetchDashboardData()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to check carry-over jobs')
      }
    } catch (error) {
      console.error('Error checking carry-over:', error)
      toast.error('Failed to check carry-over jobs')
    } finally {
      setIsCheckingCarryOver(false)
    }
  }

  // Show loading while checking role
  if (!userRole) {
    return (
      <div className="space-y-6">
        <Toaster position="top-right" />
        
        {/* Loading Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 p-8 text-white">
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-white">Loading Dashboard...</h1>
                <p className="text-slate-300 text-base font-medium">
                  Checking user permissions and loading data
                </p>
              </div>
              <div className="text-right">
                <div className="w-16 h-16 bg-slate-600/50 rounded-md flex items-center justify-center mb-2 animate-spin">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"></div>
                </div>
                <div className="text-slate-300 font-medium text-sm">Please wait...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Toaster position="top-right" />
        
        {/* Loading Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 p-8 text-white">
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 bg-white/20 rounded-md w-80 mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded-md w-96 mb-3 animate-pulse"></div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="h-5 bg-white/20 rounded-md w-48 animate-pulse"></div>
                  <div className="h-5 bg-white/20 rounded-md w-24 animate-pulse"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="w-16 h-16 bg-white/20 rounded-md mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded-md w-32 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-white p-4 border border-slate-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-gray-200 rounded-md mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded-md w-12 mb-1 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded-md w-6 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-white p-6 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded-md w-32 mb-1 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded-md w-24 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-white p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-md animate-pulse"></div>
              <div>
                <div className="h-5 bg-gray-200 rounded-md w-40 mb-1 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded-md w-32 animate-pulse"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-md p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-gray-200 rounded-md w-20 animate-pulse"></div>
                    <div className="w-5 h-5 bg-gray-200 rounded-sm animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-md w-12 mb-1 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded-md w-24 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl bg-white p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-md animate-pulse"></div>
              <div>
                <div className="h-5 bg-gray-200 rounded-md w-24 mb-1 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded-md w-28 animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-md p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-20 animate-pulse"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-md w-24 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* iOS 26 Inspired Header */}
      <div className="ios-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--ios-text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'}}>
              Workshop Dashboard
            </h1>
            <p className="text-base font-medium mb-4" style={{color: 'var(--ios-text-secondary)'}}>
              Real-time overview of job orders and workshop operations
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2" style={{color: 'var(--ios-text-tertiary)'}}>
                <FiCalendar size={18} />
                <span className="font-medium text-sm">{currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              <div className="flex items-center gap-2" style={{color: 'var(--ios-text-tertiary)'}}>
                <FiClock size={18} />
                <span className="font-medium text-sm">{currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="w-16 h-16 ford-gradient rounded-2xl shadow-lg flex items-center justify-center mb-2">
              <FiWrench size={32} color="white" />
            </div>
            <div className="text-sm font-medium" style={{color: 'var(--ios-text-tertiary)'}}>Workshop Management</div>
          </div>
        </div>
      </div>

      {/* iOS 26 Inspired Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {loading ? (
          // Skeleton loading for statistics
          Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="ios-card p-4">
              <div className="flex flex-col items-center text-center">
                <SkeletonLoader type="avatar" className="mb-3" />
                <SkeletonLoader type="text" lines={1} className="mb-1" width="60%" />
                <SkeletonLoader type="text" lines={1} width="40%" />
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Total Jobs */}
            <Link href="/dashboard/job-orders" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors duration-200">
                  <FiClipboard size={20} color="#6b7280" />
                </div>
                <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>Total</p>
                <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.total}</p>
              </div>
            </Link>

        {/* On Going */}
        <Link href="/dashboard/job-orders?filter=OG" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors duration-200">
              <FiTool size={20} color="#2563eb" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>On Going</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.onGoing}</p>
          </div>
        </Link>

        {/* For Release */}
        <Link href="/dashboard/job-orders?filter=FR" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors duration-200">
              <FiCheckCircle size={20} color="#16a34a" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>For Release</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.forRelease}</p>
          </div>
        </Link>

        {/* On Hold */}
        <Link href="/dashboard/job-orders?filter=hold" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-red-200 transition-colors duration-200">
              <FiPause size={20} color="#dc2626" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>On Hold</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.onHold}</p>
          </div>
        </Link>

        {/* Carried Over */}
        <Link href="/dashboard/job-orders?filter=carried" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors duration-200">
              <FiRefreshCw size={20} color="#ea580c" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>Carried Over</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.carriedOver}</p>
          </div>
        </Link>

        {/* Important */}
        <Link href="/dashboard/job-orders?filter=important" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-yellow-200 transition-colors duration-200">
              <FiStar size={20} color="#ca8a04" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>Important</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.important}</p>
          </div>
        </Link>

        {/* Quality Inspection */}
        <Link href="/dashboard/job-orders?filter=QI" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors duration-200">
              <FiSearch size={20} color="#9333ea" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>Quality Check</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.qualityInspection}</p>
          </div>
        </Link>

        {/* Finished Unclaimed */}
        <Link href="/dashboard/job-orders?filter=unclaimed" className="group ios-card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors duration-200">
              <FiPackage size={20} color="#6b7280" />
            </div>
            <p className="text-xs font-semibold mb-1" style={{color: 'var(--ios-text-tertiary)'}}>Unclaimed</p>
            <p className="text-xl font-bold" style={{color: 'var(--ios-text-primary)'}}>{stats.finishedUnclaimed}</p>
          </div>
        </Link>
          </>
        )}
      </div>

      {/* Quick Stats Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          // Skeleton loading for breakdown cards
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ios-card p-5">
              <SkeletonLoader type="text" lines={1} className="mb-3" width="60%" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, lineIndex) => (
                  <div key={lineIndex} className="flex justify-between items-center">
                    <SkeletonLoader type="text" lines={1} width="70%" />
                    <SkeletonLoader type="text" lines={1} width="20%" />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Status Breakdown */}
            <div className="ios-card p-5">
              <h3 className="text-lg font-bold mb-3 text-gray-900">Status Breakdown</h3>
              <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">On Going (OG)</span>
              <span className="font-semibold text-blue-600">{stats.onGoing}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Waiting Parts (WP)</span>
              <span className="font-semibold text-orange-600">{allJobs.filter(job => job.status === 'WP').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Quality Inspection (QI)</span>
              <span className="font-semibold text-purple-600">{stats.qualityInspection}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Hold Customer (HC)</span>
              <span className="font-semibold text-yellow-600">{allJobs.filter(job => job.status === 'HC').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Hold Warranty (HW)</span>
              <span className="font-semibold text-red-600">{allJobs.filter(job => job.status === 'HW').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Hold Insurance (HI)</span>
              <span className="font-semibold text-indigo-600">{allJobs.filter(job => job.status === 'HI').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">For Release (FR)</span>
              <span className="font-semibold text-green-600">{stats.forRelease}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Finished Unclaimed (FU)</span>
              <span className="font-semibold text-gray-600">{allJobs.filter(job => job.status === 'FU').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Complete (CP)</span>
              <span className="font-semibold text-emerald-600">{allJobs.filter(job => job.status === 'CP').length}</span>
            </div>
          </div>
        </div>

        {/* Technician Summary */}
        <div className="floating-card p-5">
          <h3 className="text-lg font-bold mb-3 text-gray-900">Technician Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Jobs</span>
              <span className="font-semibold text-blue-600">{allJobs.filter(job => job.assignedTechnician && !['FR', 'FU', 'CP'].includes(job.status)).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Unassigned</span>
              <span className="font-semibold text-red-600">{allJobs.filter(job => !job.assignedTechnician).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending QI Review</span>
              <span className="font-semibold text-purple-600">{allJobs.filter(job => job.status === 'QI' && job.qiStatus === 'pending').length}</span>
            </div>
          </div>
        </div>

        {/* Today's Progress */}
        <div className="floating-card p-5">
          <h3 className="text-lg font-bold mb-3 text-gray-900">Jobs by Completion</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Not Started</span>
              <span className="font-semibold text-gray-600">
                {allJobs.filter(job => 
                  job.jobList && job.jobList.every(task => task.status === 'Unfinished') && 
                  !['FR', 'FU', 'CP'].includes(job.status)
                ).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">In Progress</span>
              <span className="font-semibold text-blue-600">
                {allJobs.filter(job => 
                  job.jobList && 
                  job.jobList.some(task => task.status === 'Finished') && 
                  job.jobList.some(task => task.status === 'Unfinished') &&
                  !['FR', 'FU', 'CP'].includes(job.status)
                ).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tasks Complete</span>
              <span className="font-semibold text-yellow-600">
                {allJobs.filter(job => 
                  job.jobList && 
                  job.jobList.every(task => task.status === 'Finished') &&
                  !['QI', 'FR', 'FU', 'CP'].includes(job.status)
                ).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ready for Release</span>
              <span className="font-semibold text-green-600">{stats.forRelease}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed Today</span>
              <span className="font-semibold text-emerald-600">
                {allJobs.filter(job => {
                  if (job.status !== 'CP') return false
                  const today = new Date().toISOString().split('T')[0]
                  const jobDate = new Date(job.date).toISOString().split('T')[0]
                  return jobDate === today
                }).length}
              </span>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Pending Job Orders Section - Horizontal Scroll */}
      {anomalyJobs.length > 0 && (
        <div className="floating-card p-5 border-2 border-orange-400/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
              <span className="text-xl">⏳</span>
              Pending Job Orders
            </h2>
            <span className="text-xs text-gray-700 font-semibold">{anomalyJobs.length} job(s) need attention</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
            {anomalyJobs.map((job) => {
              // Determine pending reasons
              const unavailableParts = job.parts && job.parts.filter(part => part.availability === 'Unavailable')
              const hasUnavailableParts = unavailableParts && unavailableParts.length > 0
              const jobDate = new Date(job.date)
              const daysSinceJob = Math.floor((new Date().getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24))
              const isOverdue = daysSinceJob > 7 && !['HC', 'HW', 'HI', 'WP'].includes(job.status)
              const allTasksFinished = job.jobList && job.jobList.every(task => task.status === 'Finished')
              const notSubmittedForQI = allTasksFinished && job.status !== 'QI' && job.status !== 'FR'

              return (
                <div key={job._id} className="bg-orange-500/20 backdrop-blur-sm border border-orange-300/30 rounded-xl p-3 hover:shadow-lg transition-all w-64 flex-shrink-0 hover:-translate-y-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-orange-900">{job.jobNumber}</h3>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-sm ${
                      job.status === 'OG' ? 'bg-blue-500/20 text-blue-700 border border-blue-300/30' :
                      job.status === 'QI' ? 'bg-purple-500/20 text-purple-700 border border-purple-300/30' :
                      job.status === 'WP' ? 'bg-orange-500/20 text-orange-700 border border-orange-300/30' :
                      'bg-gray-500/20 text-gray-700 border border-gray-300/30'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  
                  {/* Pending Indicators - Compact */}
                  <div className="space-y-1 mb-2">
                    {hasUnavailableParts && (
                      <div className="flex flex-col gap-0.5 text-xs bg-orange-200 text-orange-900 px-1.5 py-1 rounded">
                        <div className="flex items-center gap-1 font-semibold">
                          <span>⚠️</span>
                          <span>Waiting Parts:</span>
                        </div>
                        <div className="text-[10px] pl-4 truncate">
                          {unavailableParts!.map(p => p.name).join(', ')}
                        </div>
                      </div>
                    )}
                    {isOverdue && (
                      <div className="flex items-center gap-1 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
                        <span>⏰</span>
                        <span>Overdue ({daysSinceJob}d)</span>
                      </div>
                    )}
                    {notSubmittedForQI && (
                      <div className="flex items-center gap-1 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                        <span>✓</span>
                        <span>Ready for QI</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      setSelectedJobForDetails(job)
                      setShowJobDetailsModal(true)
                    }}
                    className="block w-full text-center ford-gradient text-white font-semibold py-1.5 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 text-xs"
                  >
                    View Details
                  </button>
                </div>
              )
            })}
            </div>
          </div>
        </div>
      )}

      {/* Carried Over Jobs Section - Horizontal Scroll */}
      {carriedOverJobs.length > 0 && (
        <div className="floating-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
              <span className="text-xl">🔄</span>
              Carried Over Jobs - Awaiting Reassignment
            </h2>
            <span className="text-xs text-gray-700 font-semibold">{carriedOverJobs.length} job(s)</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
              {carriedOverJobs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((job) => (
                <div key={job._id} className="bg-orange-500/20 backdrop-blur-sm border-2 border-orange-400/30 rounded-xl p-3 hover:shadow-lg transition-all w-64 flex-shrink-0 hover:-translate-y-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-orange-900">{job.jobNumber}</h3>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-sm ${
                      job.status === 'OG' ? 'bg-blue-500/20 text-blue-700 border border-blue-300/30' :
                      job.status === 'QI' ? 'bg-purple-500/20 text-purple-700 border border-purple-300/30' :
                      job.status === 'WP' ? 'bg-orange-500/20 text-orange-700 border border-orange-300/30' :
                      'bg-gray-500/20 text-gray-700 border border-gray-300/30'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5 text-xs mb-2">
                    <p className="text-gray-600">{job.plateNumber}</p>
                    <p className="text-gray-600">
                      {job.assignedTechnician ? job.assignedTechnician.name : (
                        <span className="text-red-600 font-semibold">⚠️ Needs Reassignment</span>
                      )}
                    </p>
                    <p className="text-gray-500">From: {new Date(job.date).toLocaleDateString()}</p>
                    <p className="text-gray-500">{job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length} tasks</p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedJobForReassign(job)
                      setShowReassignModal(true)
                    }}
                    className="block w-full text-center ford-gradient text-white font-semibold py-1.5 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 text-xs"
                  >
                    {job.assignedTechnician ? 'Reassign' : 'Assign Now'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Important Jobs Section - Horizontal Scroll */}
      {importantJobs.length > 0 && (
        <div className="floating-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-yellow-800 flex items-center gap-2">
              <span className="text-xl">⭐</span>
              Important Jobs
            </h2>
            <span className="text-xs text-gray-700 font-semibold">{importantJobs.length} job(s)</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
              {importantJobs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((job) => (
                <div key={job._id} className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-300/30 rounded-xl p-3 hover:shadow-lg transition-all w-64 flex-shrink-0 hover:-translate-y-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-yellow-900">{job.jobNumber}</h3>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-sm ${
                      job.status === 'OG' ? 'bg-blue-500/20 text-blue-700 border border-blue-300/30' :
                      job.status === 'QI' ? 'bg-purple-500/20 text-purple-700 border border-purple-300/30' :
                      job.status === 'WP' ? 'bg-orange-500/20 text-orange-700 border border-orange-300/30' :
                      'bg-gray-500/20 text-gray-700 border border-gray-300/30'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5 text-xs mb-2">
                    <p className="text-gray-600">{job.plateNumber}</p>
                    <p className="text-gray-600">{job.assignedTechnician ? job.assignedTechnician.name : 'Unassigned'}</p>
                    <p className="text-gray-500">{new Date(job.date).toLocaleDateString()}</p>
                    <p className="text-gray-500">{job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length} tasks</p>
                  </div>

                  <Link 
                    href={`/dashboard/workshop?highlight=${job._id}&date=${new Date(job.date).toISOString().split('T')[0]}`}
                    className="block w-full text-center bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-600 text-white font-semibold py-1.5 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 text-xs"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Professional Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/job-orders" className="group ios-card p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
              <FiClipboard size={20} color="#475569" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 mb-1">Job Orders</h3>
              <p className="text-sm text-slate-600 font-medium">Manage all job orders</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/workshop" className="group ios-card p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
              <FiTool size={20} color="#475569" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 mb-1">Job Control Board</h3>
              <p className="text-sm text-slate-600 font-medium">View timetable & schedule</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/account-management" className="group ios-card p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
              <FiUsers size={20} color="#475569" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 mb-1">Account Management</h3>
              <p className="text-sm text-slate-600 font-medium">Manage users & roles</p>
            </div>
          </div>
        </Link>

        <button onClick={() => setShowBreakSettings(true)} className="group ios-card p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
              <FiSettings size={20} color="#475569" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 mb-1">Break Settings</h3>
              <p className="text-sm text-slate-600 font-medium">{breakStart} - {breakEnd}</p>
            </div>
          </div>
        </button>

        <button 
          onClick={handleCheckCarryOver} 
          disabled={isCheckingCarryOver}
          className="group ios-card p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
              {isCheckingCarryOver ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FiRefreshCw size={20} color="#475569" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 mb-1">Check Carry-Over</h3>
              <p className="text-sm text-slate-600 font-medium">
                {isCheckingCarryOver ? 'Checking...' : 'Process previous day jobs'}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Professional Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Metrics Widget */}
        <div className="lg:col-span-2 ios-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
              <FiBarChart size={18} color="#475569" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Performance Metrics</h3>
              <p className="text-sm text-slate-600">Today's workshop efficiency</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Completion Rate</span>
                <FiCheckCircle size={18} color="#16a34a" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {stats.total > 0 ? Math.round((stats.forRelease / stats.total) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {stats.forRelease} of {stats.total} jobs completed
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Active Jobs</span>
                <FiTool size={18} color="#2563eb" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.onGoing}</div>
              <div className="text-xs text-slate-600 mt-1">
                Currently in progress
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Pending QI</span>
                <FiSearch size={18} color="#9333ea" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.qualityInspection}</div>
              <div className="text-xs text-slate-600 mt-1">
                Awaiting inspection
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">On Hold</span>
                <FiPause size={18} color="#dc2626" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.onHold}</div>
              <div className="text-xs text-slate-600 mt-1">
                Require attention
              </div>
            </div>
          </div>
        </div>

        {/* Quick Alerts Widget */}
        <div className="ios-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
              <FiAlertTriangle size={18} color="#475569" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Quick Alerts</h3>
              <p className="text-sm text-slate-600">Items needing attention</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {anomalyJobs.length > 0 && (
              <div className="bg-orange-50 rounded-md p-3 border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <FiAlertTriangle size={14} color="#ea580c" />
                  <span className="font-semibold text-orange-900 text-sm">Pending Jobs</span>
                </div>
                <p className="text-xs text-orange-800">{anomalyJobs.length} jobs need attention</p>
              </div>
            )}
            
            {carriedOverJobs.length > 0 && (
              <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <FiRefreshCw size={14} color="#2563eb" />
                  <span className="font-semibold text-blue-900 text-sm">Carried Over</span>
                </div>
                <p className="text-xs text-blue-800">{carriedOverJobs.length} jobs need reassignment</p>
              </div>
            )}
            
            {stats.important > 0 && (
              <div className="bg-yellow-50 rounded-md p-3 border border-yellow-200">
                <div className="flex items-center gap-2 mb-1">
                  <FiStar size={14} color="#ca8a04" />
                  <span className="font-semibold text-yellow-900 text-sm">Important Jobs</span>
                </div>
                <p className="text-xs text-yellow-800">{stats.important} high-priority jobs</p>
              </div>
            )}
            
            {stats.finishedUnclaimed > 0 && (
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <FiPackage size={14} color="#6b7280" />
                  <span className="font-semibold text-gray-900 text-sm">Unclaimed</span>
                </div>
                <p className="text-xs text-gray-800">{stats.finishedUnclaimed} jobs ready for pickup</p>
              </div>
            )}
            
            {anomalyJobs.length === 0 && carriedOverJobs.length === 0 && stats.important === 0 && stats.finishedUnclaimed === 0 && (
              <div className="bg-green-50 rounded-md p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <FiCheckCircle size={14} color="#16a34a" />
                  <span className="font-semibold text-green-900 text-sm">All Good!</span>
                </div>
                <p className="text-xs text-green-800">No urgent items requiring attention</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reassignment Modal */}
      {showReassignModal && selectedJobForReassign && (
        <ReassignmentModal
          job={selectedJobForReassign}
          calculateEndTime={calculateEndTime}
          onClose={() => {
            setShowReassignModal(false)
            setSelectedJobForReassign(null)
          }}
          onSuccess={() => {
            setShowReassignModal(false)
            setSelectedJobForReassign(null)
            fetchDashboardData()
          }}
        />
      )}

      {/* Job Details Modal */}
      {showJobDetailsModal && selectedJobForDetails && (
        <JobDetailsModal
          job={selectedJobForDetails}
          calculateEndTime={calculateEndTime}
          onClose={() => {
            setShowJobDetailsModal(false)
            setSelectedJobForDetails(null)
          }}
          onSuccess={() => {
            setShowJobDetailsModal(false)
            setSelectedJobForDetails(null)
            fetchDashboardData()
          }}
          onUpdateJobStatus={handleUpdateJobStatus}
          onCarryOver={handleCarryOver}
        />
      )}

      {/* Break Settings Modal */}
      {showBreakSettings && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Break Time Settings</h3>
                <button
                  onClick={() => setShowBreakSettings(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Break Start Time
                  </label>
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Break End Time
                  </label>
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="w-full px-3 py-2"
                  />
                </div>
                
                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl p-3">
                  <p className="text-sm text-blue-800 font-medium">
                    ℹ️ This break time will be automatically accounted for when calculating job end times.
                  </p>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowBreakSettings(false)}
                    className="flex-1 px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('breakStart', breakStart)
                      localStorage.setItem('breakEnd', breakEnd)
                      setShowBreakSettings(false)
                      toast.success('Break time settings saved!')
                    }}
                    className="flex-1 px-6 py-2.5 ford-gradient text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Job Details Modal Component
function JobDetailsModal({ job, calculateEndTime, onClose, onSuccess, onUpdateJobStatus, onCarryOver }: {
  job: any
  calculateEndTime: (startTime: string, duration: number) => string
  onClose: () => void
  onSuccess: () => void
  onUpdateJobStatus?: (jobId: string, status: string, remarks?: string) => void
  onCarryOver?: (jobId: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [localJob, setLocalJob] = useState(job)

  const updateTaskStatus = async (taskIndex: number, status: 'Finished' | 'Unfinished') => {
    try {
      setUpdating(true)
      const updatedJobList = [...localJob.jobList]
      updatedJobList[taskIndex].status = status

      const response = await fetch(`/api/job-orders/${job._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobList: updatedJobList })
      })

      if (!response.ok) throw new Error('Failed to update task')
      
      const data = await response.json()
      setLocalJob(data.jobOrder)
      toast.success(`Task marked as ${status.toLowerCase()}`)
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    } finally {
      setUpdating(false)
    }
  }

  const updatePartAvailability = async (partIndex: number, availability: 'Available' | 'Unavailable') => {
    try {
      setUpdating(true)
      const updatedParts = [...localJob.parts]
      updatedParts[partIndex].availability = availability

      const response = await fetch(`/api/job-orders/${job._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parts: updatedParts })
      })

      if (!response.ok) throw new Error('Failed to update part')
      
      const data = await response.json()
      setLocalJob(data.jobOrder)
      toast.success(`Part marked as ${availability.toLowerCase()}`)
      
      // Check if all parts are now available
      const allPartsAvailable = updatedParts.every(p => p.availability === 'Available')
      if (allPartsAvailable && localJob.status === 'WP') {
        toast.success('All parts available! You can now assign a technician.', { duration: 5000 })
      }
    } catch (error) {
      console.error('Error updating part:', error)
      toast.error('Failed to update part availability')
    } finally {
      setUpdating(false)
    }
  }

  const allPartsAvailable = localJob.parts.every((p: any) => p.availability === 'Available')

  return (
    <div className="modal-backdrop">
      <div className="floating-card max-w-4xl w-full max-h-[95vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-gray-900">Job Order Details</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">
              ×
            </button>
          </div>

          {/* Job Info Header */}
          <div className="bg-orange-500/20 backdrop-blur-sm border border-orange-300/30 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-lg text-orange-900">{localJob.jobNumber}</h4>
                <p className="text-sm text-gray-700">{localJob.plateNumber} - {localJob.vin}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Date: {new Date(localJob.date).toLocaleDateString()} | 
                  Time: {localJob.timeRange.start} - {localJob.timeRange.end}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm border ${
                  localJob.status === 'WP' ? 'bg-orange-500/20 text-orange-700 border-orange-300/30' :
                  localJob.status === 'OG' ? 'bg-blue-500/20 text-blue-700 border-blue-300/30' :
                  'bg-gray-500/20 text-gray-700 border-gray-300/30'
                }`}>
                  {localJob.status === 'WP' ? 'Waiting Parts' :
                   localJob.status === 'OG' ? 'On Going' : localJob.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parts Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Parts Required</h4>
                <span className="text-xs text-gray-600">
                  {localJob.parts.filter((p: any) => p.availability === 'Available').length}/{localJob.parts.length} available
                </span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {localJob.parts.map((part: any, index: number) => (
                  <div key={index} className="bg-white/40 backdrop-blur-sm border border-white/40 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-900 text-sm">{part.name}</h5>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        part.availability === 'Available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {part.availability}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updatePartAvailability(index, 'Available')}
                        disabled={updating || part.availability === 'Available'}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          part.availability === 'Available'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Available
                      </button>
                      <button
                        onClick={() => updatePartAvailability(index, 'Unavailable')}
                        disabled={updating || part.availability === 'Unavailable'}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          part.availability === 'Unavailable'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 border border-red-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Unavailable
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">Job Tasks</h4>
                <span className="text-xs text-gray-600">
                  {localJob.jobList.filter((t: any) => t.status === 'Finished').length}/{localJob.jobList.length} finished
                </span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {localJob.jobList.map((task: any, index: number) => (
                  <div key={index} className="bg-white/40 backdrop-blur-sm border border-white/40 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-900 text-sm">{task.description}</h5>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        task.status === 'Finished'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateTaskStatus(index, 'Finished')}
                        disabled={updating || task.status === 'Finished'}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          task.status === 'Finished'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Finished
                      </button>
                      <button
                        onClick={() => updateTaskStatus(index, 'Unfinished')}
                        disabled={updating || task.status === 'Unfinished'}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          task.status === 'Unfinished'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30 border border-gray-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Unfinished
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Technician Assignment Section */}
          <div className="mt-6 p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/40">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h4 className="font-bold text-gray-900">Assigned Technician</h4>
                <p className="text-sm text-gray-700 font-medium">
                  {localJob.assignedTechnician ? localJob.assignedTechnician.name : (
                    <span className="text-orange-600 font-bold">⚠️ Not Assigned</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowReassign(!showReassign)}
                disabled={!allPartsAvailable}
                className="px-4 py-2 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all text-sm hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                title={!allPartsAvailable ? 'All parts must be available before assigning' : 'Assign or reassign technician'}
              >
                {localJob.assignedTechnician ? 'Reassign' : 'Assign Technician'}
              </button>
            </div>
            {!allPartsAvailable && (
              <p className="text-xs text-orange-600 mt-2 font-medium">
                ⚠️ All parts must be available before assigning a technician
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-white/30">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              Close
            </button>
            <button
              onClick={onSuccess}
              className="flex-1 px-6 py-2.5 ford-gradient text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              Save & Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Nested Reassignment Modal */}
      {showReassign && (
        <ReassignmentModal
          job={localJob}
          calculateEndTime={calculateEndTime}
          onClose={() => setShowReassign(false)}
          onSuccess={() => {
            setShowReassign(false)
            onSuccess()
          }}
        />
      )}
    </div>
  )
}

// Reassignment Modal Component
function ReassignmentModal({ job, calculateEndTime, onClose, onSuccess }: {
  job: any
  calculateEndTime: (startTime: string, duration: number) => string
  onClose: () => void
  onSuccess: () => void
}) {
  const [startTime, setStartTime] = useState(job.timeRange.start)
  const [duration, setDuration] = useState(120) // Default 2 hours in minutes
  const [endTime, setEndTime] = useState(calculateEndTime(job.timeRange.start, 120))
  const [selectedTechnician, setSelectedTechnician] = useState('')
  const [allTechnicians, setAllTechnicians] = useState<any[]>([])
  const [technicianSchedule, setTechnicianSchedule] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Fetch all technicians on mount
  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          const techs = (data.users || []).filter((u: any) => u.role === 'technician')
          setAllTechnicians(techs)
        }
      } catch (error) {
        console.error('Error fetching technicians:', error)
      }
    }
    fetchTechnicians()
  }, [])

  // Fetch selected technician's schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!selectedTechnician) {
        setTechnicianSchedule([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/job-orders?date=${selectedDate}&technician=${selectedTechnician}&limit=100`,
          { credentials: 'include' }
        )
        if (response.ok) {
          const data = await response.json()
          // Filter out the current job being reassigned
          const schedule = (data.jobOrders || []).filter((j: any) => j._id !== job._id)
          setTechnicianSchedule(schedule)
        }
      } catch (error) {
        console.error('Error fetching schedule:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSchedule()
  }, [selectedTechnician, selectedDate, job._id])

  // Recalculate end time when start time or duration changes
  useEffect(() => {
    if (startTime && duration) {
      const calculated = calculateEndTime(startTime, duration)
      setEndTime(calculated)
    }
  }, [startTime, duration, calculateEndTime])

  // Generate time slots (7 AM to 6 PM in 30-min intervals)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 7; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute > 0) break // Stop at 6:00 PM
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Check if a time slot is occupied
  const isSlotOccupied = (slotTime: string) => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin

    return technicianSchedule.some(job => {
      const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = startHour * 60 + startMin
      const jobEnd = endHour * 60 + endMin
      
      return slotMinutes >= jobStart && slotMinutes < jobEnd
    })
  }

  // Get job at specific time slot
  const getJobAtSlot = (slotTime: string) => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin

    return technicianSchedule.find(job => {
      const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = startHour * 60 + startMin
      const jobEnd = endHour * 60 + endMin
      
      return slotMinutes >= jobStart && slotMinutes < jobEnd
    })
  }

  // Check if proposed time conflicts
  const hasConflict = () => {
    if (!startTime || !endTime) return false

    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const proposedStart = startHour * 60 + startMin
    const proposedEnd = endHour * 60 + endMin

    return technicianSchedule.some(job => {
      const [jobStartHour, jobStartMin] = job.timeRange.start.split(':').map(Number)
      const [jobEndHour, jobEndMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = jobStartHour * 60 + jobStartMin
      const jobEnd = jobEndHour * 60 + jobEndMin
      
      return proposedStart < jobEnd && proposedEnd > jobStart
    })
  }

  const handleSlotClick = (slotTime: string) => {
    if (!isSlotOccupied(slotTime)) {
      setStartTime(slotTime)
    }
  }

  const handleSubmit = async () => {
    if (!selectedTechnician) {
      toast.error('Please select a technician')
      return
    }

    if (hasConflict()) {
      toast.error('Time slot conflicts with existing job')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/job-orders/${job._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignedTechnician: selectedTechnician,
          timeRange: { start: startTime, end: endTime },
          date: selectedDate,
          carriedOver: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reassign job')
      }

      toast.success('Job reassigned successfully!')
      onSuccess()
    } catch (error) {
      console.error('Error reassigning job:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to reassign job')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="floating-card max-w-6xl w-full max-h-[95vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-gray-900">Reassign Job Order - Visual Schedule</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">
              ×
            </button>
          </div>

          {/* Job Info */}
          <div className="bg-orange-500/20 backdrop-blur-sm border border-orange-300/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-orange-900">{job.jobNumber}</h4>
            <p className="text-sm text-gray-700 font-medium">{job.plateNumber} - {job.vin}</p>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Current: {job.timeRange.start} - {job.timeRange.end} ({job.assignedTechnician ? job.assignedTechnician.name : 'Unassigned'})
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Technician
                </label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose technician...</option>
                  {allTechnicians.map((tech) => (
                    <option key={tech._id} value={tech._id}>
                      {tech.name} {tech.level && `(${tech.level})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={duration / 60}
                  onChange={(e) => setDuration(parseFloat(e.target.value) * 60)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated with break</p>
              </div>

              {hasConflict() && (
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3">
                  <p className="text-sm text-red-800 font-bold">⚠️ Time Conflict Detected</p>
                  <p className="text-xs text-red-600 mt-1 font-medium">Selected time overlaps with existing job</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedTechnician || hasConflict()}
                  className="flex-1 px-6 py-2.5 ford-gradient disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>

            {/* Right: Visual Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/40">
                <h4 className="font-semibold mb-3">
                  {selectedTechnician ? (
                    <>Schedule for {allTechnicians.find(t => t._id === selectedTechnician)?.name}</>
                  ) : (
                    'Select a technician to view schedule'
                  )}
                </h4>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading schedule...</div>
                ) : !selectedTechnician ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">👤</div>
                    <p>Select a technician to see their availability</p>
                  </div>
                ) : (
                  <>
                    {/* Legend */}
                    <div className="flex gap-4 mb-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
                        <span>Occupied</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-blue-200 border-2 border-blue-600 rounded"></div>
                        <span>Your Selection</span>
                      </div>
                    </div>

                    {/* Timeline Grid */}
                    <div className="grid grid-cols-4 gap-2 max-h-[500px] overflow-y-auto">
                      {timeSlots.map((slot) => {
                        const occupied = isSlotOccupied(slot)
                        const jobAtSlot = getJobAtSlot(slot)
                        const isSelected = slot === startTime
                        const [slotHour, slotMin] = slot.split(':').map(Number)
                        const slotMinutes = slotHour * 60 + slotMin
                        const [startHour, startMin] = startTime.split(':').map(Number)
                        const [endHour, endMin] = endTime.split(':').map(Number)
                        const selectedStart = startHour * 60 + startMin
                        const selectedEnd = endHour * 60 + endMin
                        const isInSelectedRange = slotMinutes >= selectedStart && slotMinutes < selectedEnd

                        return (
                          <button
                            key={slot}
                            onClick={() => handleSlotClick(slot)}
                            disabled={occupied}
                            className={`
                              p-2 text-xs rounded border-2 transition-all
                              ${occupied 
                                ? 'bg-red-100 border-red-300 text-red-800 cursor-not-allowed' 
                                : isInSelectedRange
                                  ? 'bg-blue-200 border-blue-600 text-blue-900 font-bold'
                                  : 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
                              }
                              ${isSelected ? 'ring-2 ring-blue-500' : ''}
                            `}
                            title={occupied ? `Occupied: ${jobAtSlot?.jobNumber}` : 'Available - Click to select'}
                          >
                            <div className="font-semibold">{slot}</div>
                            {occupied && jobAtSlot && (
                              <div className="text-[10px] truncate mt-1">
                                {jobAtSlot.jobNumber}
                              </div>
                            )}
                            {isSelected && (
                              <div className="text-[10px] mt-1">START</div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Existing Jobs Summary */}
                    {technicianSchedule.length > 0 && (
                      <div className="mt-4 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50">
                        <h5 className="font-bold text-sm mb-2">Existing Jobs ({technicianSchedule.length})</h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {technicianSchedule.map((j: any) => (
                            <div key={j._id} className="text-xs flex justify-between items-center p-2 bg-white/40 rounded-xl">
                              <span className="font-bold">{j.jobNumber}</span>
                              <span className="text-gray-700 font-medium">{j.timeRange.start} - {j.timeRange.end}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

