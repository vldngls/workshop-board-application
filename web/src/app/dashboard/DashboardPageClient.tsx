'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import {
  FiClock,
  FiClipboard,
  FiTool,
  FiCheckCircle,
  FiPause,
  FiRefreshCw,
  FiSearch,
  FiPackage,
  FiTrendingUp,
  FiActivity,
  FiAlertTriangle,
  FiUserPlus,
  FiUsers,
  FiAlertCircle,
  FiZap
} from 'react-icons/fi'
import type { JobOrder } from '@/types/jobOrder'
import type { Role } from '@/types/auth'
import type { DashboardOverviewData } from '@/server/dashboard'
import SkeletonLoader from '@/components/SkeletonLoader'
import JobReassignmentModal from '@/components/JobReassignmentModal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface DashboardStats {
  total: number
  onGoing: number
  forRelease: number
  onHold: number
  carriedOver: number
  important: number
  qualityInspection: number
  finishedUnclaimed: number
  averageCompletedPerDay?: number
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

interface TodayMetrics {
  total: number
  completed: number
  inProgress: number
  onHold: number
  pendingQI: number
  overdue: number
  waitingParts: number
  totalHoursUsed: number
  averageCompletionTime: number
  technicianCount: number
  utilizationRate: number
}

interface DashboardPageClientProps {
  role: Role
  initialData?: DashboardOverviewData
}

export default function DashboardPageClient({
  role,
  initialData,
}: DashboardPageClientProps) {
  const initialJobOrders =
    (initialData?.jobOrders as { jobOrders: JobOrderWithTechnician[] } | undefined)?.jobOrders || []
  const initialTechnicians =
    (initialData?.technicians as { users: any[] } | undefined)?.users || []

  const queryClient = useQueryClient()
  const [carriedOverJobs, setCarriedOverJobs] = useState<JobOrderWithTechnician[]>([])
  const [anomalyJobs, setAnomalyJobs] = useState<JobOrderWithTechnician[]>([])
  const [allJobs, setAllJobs] = useState<JobOrderWithTechnician[]>(initialJobOrders)
  const [loading, setLoading] = useState(initialJobOrders.length === 0)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedJobForReassign, setSelectedJobForReassign] = useState<JobOrderWithTechnician | null>(null)
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false)
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobOrderWithTechnician | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isCheckingCarryOver, setIsCheckingCarryOver] = useState(false)
  const [technicians, setTechnicians] = useState<any[]>(initialTechnicians)

  const jobOrdersQuery = useQuery<{ jobOrders: JobOrderWithTechnician[] }>({
    queryKey: ['job-orders', { limit: 1000 }],
    queryFn: async () => {
      const res = await fetch('/api/job-orders?limit=1000')
      if (!res.ok) throw new Error('Failed to fetch job orders')
      return res.json()
    },
    staleTime: 60_000,
    enabled: role !== 'technician',
    initialData: initialData?.jobOrders as { jobOrders: JobOrderWithTechnician[] } | undefined,
  })

  const techniciansQuery = useQuery<{ users: any[] }>({
    queryKey: ['users', 'technicians'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=technician')
      if (!res.ok) throw new Error('Failed to fetch technicians')
      return res.json()
    },
    enabled: role !== 'technician',
    staleTime: 5 * 60_000,
    initialData: initialData?.technicians as { users: any[] } | undefined,
  })

  const dashboardStatsQuery = useQuery<{ stats: DashboardStats }>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch dashboard stats')
      return res.json()
    },
    enabled: role !== 'technician',
    staleTime: 60_000,
    initialData: initialData?.stats as { stats: DashboardStats } | undefined,
  })

  const todayMetrics = useMemo<TodayMetrics>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayJobs = allJobs.filter(job => {
      const jobDate = new Date(job.date)
      jobDate.setHours(0, 0, 0, 0)
      return jobDate.getTime() >= today.getTime() && jobDate.getTime() < tomorrow.getTime()
    })

    let totalHoursUsed = 0
    const technicianJobs: { [key: string]: number } = {}
    
    todayJobs.forEach(job => {
      if (job.assignedTechnician) {
        const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
        const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
        const startMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin
        const hours = (endMinutes - startMinutes) / 60
        totalHoursUsed += hours
        
        const techId = job.assignedTechnician._id.toString()
        technicianJobs[techId] = (technicianJobs[techId] || 0) + hours
      }
    })

    const completedToday = todayJobs.filter(job => ['FR', 'FU', 'CP'].includes(job.status))
    const inProgress = todayJobs.filter(job => job.status === 'OG')
    const onHold = todayJobs.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status))
    const pendingQI = todayJobs.filter(job => job.status === 'QI' && job.qiStatus === 'pending')
    
    const now = new Date()
    const overdue = todayJobs.filter(job => {
      if (['FR', 'FU', 'CP'].includes(job.status)) return false
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      const endTime = new Date(today)
      endTime.setHours(endHour, endMin, 0)
      return now > endTime && job.assignedTechnician
    })

    const waitingParts = todayJobs.filter(job => 
      job.parts && job.parts.some(part => part.availability === 'Unavailable')
    )

    const completionTimes = completedToday.map(job => {
      const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      return (endHour * 60 + endMin) - (startHour * 60 + startMin)
    })
    const avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0

    const totalAvailableHours = technicians.length * 7.5
    const utilizationRate = totalAvailableHours > 0 
      ? Math.round((totalHoursUsed / totalAvailableHours) * 100) 
      : 0

    return {
      total: todayJobs.length,
      completed: completedToday.length,
      inProgress: inProgress.length,
      onHold: onHold.length,
      pendingQI: pendingQI.length,
      overdue: overdue.length,
      waitingParts: waitingParts.length,
      totalHoursUsed: Math.round(totalHoursUsed * 10) / 10,
      averageCompletionTime: Math.round(avgCompletionTime),
      technicianCount: technicians.length,
      utilizationRate
    }
  }, [allJobs, technicians])

  useEffect(() => {
    if (!jobOrdersQuery.data) return
    const jobOrders = jobOrdersQuery.data.jobOrders || []
    const carried = jobOrders.filter(job => job.carriedOver && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP')
    const pendingJobs = jobOrders.filter(job => {
      if (job.status === 'FR' || job.status === 'FU' || job.status === 'CP') return false
      if (job.status === 'WP') return true
      const hasUnavailableParts = job.parts && job.parts.some(part => part.availability === 'Unavailable')
      const jobDate = new Date(job.date)
      const daysSinceJob = Math.floor((new Date().getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24))
      const isOverdue = daysSinceJob > 7 && !['HC', 'HW', 'HI', 'WP'].includes(job.status)
      const allTasksFinished = job.jobList && job.jobList.every(task => task.status === 'Finished')
      const notSubmittedForQI = allTasksFinished && job.status !== 'QI'
      return hasUnavailableParts || isOverdue || notSubmittedForQI
    })
    
    setAllJobs(jobOrders)
    setCarriedOverJobs(carried)
    setAnomalyJobs(pendingJobs)
    setLoading(false)
  }, [jobOrdersQuery.data])

  useEffect(() => {
    if (techniciansQuery.data) {
      setTechnicians(techniciansQuery.data.users || [])
    }
  }, [techniciansQuery.data])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const endOfDayMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const response = await fetch('/api/job-orders/end-of-day', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error((errorData as any).error || 'Failed to process end of day')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success(`End of day processing completed!`)
      queryClient.invalidateQueries({ queryKey: ['job-orders'] })
    },
    onError: (err) => {
      toast.error(err.message)
    }
  })

  const handleEndOfDay = async () => {
    if (isCheckingCarryOver) return
    setIsCheckingCarryOver(true)
    try {
      await endOfDayMutation.mutateAsync()
    } finally {
      setIsCheckingCarryOver(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 min-h-screen" style={{background: 'var(--ios-bg-secondary)'}}>
        <Toaster position="top-right" />
        <SkeletonLoader type="text" lines={1} width="40%" className="h-8 mb-4" />
      </div>
    )
  }

  const efficiency = todayMetrics.total > 0 
    ? Math.round((todayMetrics.completed / todayMetrics.total) * 100) 
    : 0

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-4" style={{background: 'var(--ios-bg-secondary)'}}>
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight" style={{color: 'var(--ios-text-primary)'}}>
            Dashboard
          </h1>
          <p className="text-sm font-medium" style={{color: 'var(--ios-text-secondary)'}}>
            {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Link 
          href="/dashboard/workshop"
          className="ios-button px-5 py-2.5 text-sm font-bold rounded-xl"
        >
          View Timetable
        </Link>
      </div>

      <div className="relative">
        <div className="glass p-6 rounded-3xl" style={{position: 'relative'}}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 relative z-10">
            {[
              { 
                icon: FiClipboard, 
                label: 'Total Today', 
                value: todayMetrics.total, 
                color: 'from-gray-500 to-gray-600',
                link: '/dashboard/job-orders'
              },
              { 
                icon: FiCheckCircle, 
                label: 'Completed', 
                value: todayMetrics.completed, 
                color: 'from-green-500 to-emerald-600',
                link: '/dashboard/job-orders?filter=FR'
              },
              { 
                icon: FiTool, 
                label: 'In Progress', 
                value: todayMetrics.inProgress, 
                color: 'from-blue-500 to-cyan-600',
                link: '/dashboard/job-orders?filter=OG'
              },
              { 
                icon: FiPause, 
                label: 'On Hold', 
                value: todayMetrics.onHold, 
                color: 'from-red-500 to-rose-600',
                link: '/dashboard/job-orders?filter=hold'
              },
            ].map((stat, index) => {
              const Icon = stat.icon
              return (
                <Link 
                  key={index}
                  href={stat.link}
                  className="group relative overflow-hidden p-4 rounded-2xl bg-white/40 backdrop-blur-md border border-white/30 hover:bg-white/50 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-700">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-md border border-green-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <FiTrendingUp size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Efficiency</h3>
                  <p className="text-xs text-gray-700">Completion rate</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{efficiency}%</span>
              </div>
              <div className="h-2 bg-white/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${efficiency}%` }}
                ></div>
              </div>
              <p className="text-xs mt-2 text-gray-700">
                {todayMetrics.completed} of {todayMetrics.total} jobs completed today
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 backdrop-blur-md border border-blue-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <FiActivity size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Utilization</h3>
                  <p className="text-xs text-gray-700">Technician hours</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{todayMetrics.utilizationRate}%</span>
              </div>
              <div className="h-2 bg-white/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${todayMetrics.utilizationRate}%` }}
                ></div>
              </div>
              <p className="text-xs mt-2 text-gray-700">
                {todayMetrics.totalHoursUsed}h of {technicians.length * 7.5}h • {todayMetrics.technicianCount} technicians
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-600/20 backdrop-blur-md border border-teal-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-green-600 flex items-center justify-center shadow-lg">
                  <FiCheckCircle size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Avg Completed</h3>
                  <p className="text-xs text-gray-700">Per day (30 days)</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">
                  {dashboardStatsQuery.data?.stats?.averageCompletedPerDay?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="h-2 bg-white/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-green-600 rounded-full transition-all duration-500 shadow-lg"
                  style={{ 
                    width: `${Math.min(100, ((dashboardStatsQuery.data?.stats?.averageCompletedPerDay || 0) / 20) * 100)}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs mt-2 text-gray-700">
                Average job orders completed per day
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 relative z-10">
            {[
              { icon: FiZap, label: 'Efficiency', value: `${efficiency}%`, color: 'from-green-500 to-emerald-600' },
              { icon: FiActivity, label: 'Hours', value: `${todayMetrics.totalHoursUsed}h`, color: 'from-blue-500 to-cyan-600' },
              { icon: FiUsers, label: 'Techs', value: todayMetrics.technicianCount, color: 'from-purple-500 to-violet-600' },
              { icon: FiClock, label: 'Avg Time', value: `${Math.round(todayMetrics.averageCompletionTime / 60)}h${todayMetrics.averageCompletionTime % 60}m`, color: 'from-orange-500 to-amber-600' },
              { icon: FiTrendingUp, label: 'Avg/Day', value: dashboardStatsQuery.data?.stats?.averageCompletedPerDay?.toFixed(1) || '0.0', color: 'from-green-500 to-teal-600' },
              { icon: FiAlertTriangle, label: 'Overdue', value: todayMetrics.overdue, color: 'from-red-500 to-rose-600' },
              { icon: FiPackage, label: 'Parts', value: todayMetrics.waitingParts, color: 'from-orange-500 to-red-600' },
            ].map((metric, i) => {
              const Icon = metric.icon
              return (
                <div key={i} className="p-3 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 hover:bg-white/40 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${metric.color} flex items-center justify-center shadow-md`}>
                      <Icon size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900 mb-0.5">{metric.value}</div>
                  <div className="text-xs font-medium text-gray-700">{metric.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {(todayMetrics.overdue > 0 || todayMetrics.waitingParts > 0 || todayMetrics.pendingQI > 0) && (
        <div className="relative">
          <div className="glass p-5 rounded-3xl" style={{position: 'relative'}}>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <FiAlertCircle size={18} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Requiring Attention</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
              {todayMetrics.overdue > 0 && (
                <Link 
                  href="/dashboard/job-orders?filter=overdue"
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-red-500/30 to-rose-600/30 backdrop-blur-md border-2 border-red-500/40 hover:border-red-500/60 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <FiClock size={20} className="text-red-600" />
                    <span className="font-bold text-gray-900">Overdue</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600 group-hover:scale-110 transition-transform">
                    {todayMetrics.overdue}
                  </span>
                </Link>
              )}
              {todayMetrics.waitingParts > 0 && (
                <Link 
                  href="/dashboard/job-orders?filter=WP"
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-orange-500/30 to-amber-600/30 backdrop-blur-md border-2 border-orange-500/40 hover:border-orange-500/60 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <FiPackage size={20} className="text-orange-600" />
                    <span className="font-bold text-gray-900">Waiting Parts</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600 group-hover:scale-110 transition-transform">
                    {todayMetrics.waitingParts}
                  </span>
                </Link>
              )}
              {todayMetrics.pendingQI > 0 && (
                <Link 
                  href="/dashboard/job-orders?filter=QI"
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-purple-500/30 to-violet-600/30 backdrop-blur-md border-2 border-purple-500/40 hover:border-purple-500/60 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <FiSearch size={20} className="text-purple-600" />
                    <span className="font-bold text-gray-900">Pending QI</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600 group-hover:scale-110 transition-transform">
                    {todayMetrics.pendingQI}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link 
          href="/dashboard/workshop"
          className="glass p-4 rounded-2xl hover:scale-105 transition-all group"
          style={{position: 'relative'}}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <FiTool size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">Timetable</h3>
              <p className="text-xs text-gray-700 truncate">View schedule</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/dashboard/job-orders"
          className="glass p-4 rounded-2xl hover:scale-105 transition-all group"
          style={{position: 'relative'}}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <FiClipboard size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">Job Orders</h3>
              <p className="text-xs text-gray-700 truncate">Manage all</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/dashboard/walk-in"
          className="glass p-4 rounded-2xl hover:scale-105 transition-all group"
          style={{position: 'relative'}}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <FiUserPlus size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">Walk-In</h3>
              <p className="text-xs text-gray-700 truncate">Create job</p>
            </div>
          </div>
        </Link>

        <button
          onClick={handleEndOfDay}
          disabled={isCheckingCarryOver}
          type="button"
          className="glass p-4 rounded-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed group text-left w-full"
          style={{position: 'relative'}}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              {isCheckingCarryOver ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FiRefreshCw size={18} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">End of Day</h3>
              <p className="text-xs text-gray-700 truncate">Process snapshot</p>
            </div>
          </div>
        </button>
      </div>

      {anomalyJobs.length > 0 && (
        <div className="relative">
          <div className="glass p-5 rounded-3xl" style={{position: 'relative'}}>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                  <FiAlertTriangle className="text-white" size={16} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Pending Jobs</h2>
              </div>
              <span className="text-sm font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-800">
                {anomalyJobs.length}
              </span>
            </div>
            <div className="overflow-x-auto pb-2 -mx-2 px-2 relative z-10">
              <div className="flex gap-3 min-w-max">
                {anomalyJobs.slice(0, 5).map((job) => {
                  const unavailableParts = job.parts?.filter(part => part.availability === 'Unavailable') || []
                  const hasUnavailableParts = unavailableParts.length > 0
                  const allTasksFinished = job.jobList?.every(task => task.status === 'Finished')
                  const notSubmittedForQI = allTasksFinished && job.status !== 'QI' && job.status !== 'FR'

                  return (
                    <button
                      key={job._id}
                      onClick={() => {
                        setSelectedJobForDetails(job)
                        setShowJobDetailsModal(true)
                      }}
                      className="bg-gradient-to-br from-orange-50/90 to-orange-100/90 backdrop-blur-md border border-orange-200 rounded-2xl p-4 hover:shadow-xl transition-all w-60 flex-shrink-0 hover:scale-105 text-left"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-sm text-gray-900">{job.jobNumber}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                          job.status === 'OG' ? 'bg-blue-100 text-blue-700' :
                          job.status === 'QI' ? 'bg-purple-100 text-purple-700' :
                          job.status === 'WP' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      
                      {(hasUnavailableParts || notSubmittedForQI) && (
                        <div className="space-y-1 mb-2">
                          {hasUnavailableParts && (
                            <div className="text-xs bg-orange-200 text-orange-900 px-2 py-0.5 rounded font-medium">
                              ⚠️ {unavailableParts.length} part{unavailableParts.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          {notSubmittedForQI && (
                            <div className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded font-medium">
                              ✓ Ready for QI
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-600">
                        {job.plateNumber}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            {anomalyJobs.length > 5 && (
              <Link 
                href="/dashboard/job-orders?filter=pending"
                className="block text-center mt-4 text-sm font-semibold text-ios-primary hover:underline"
              >
                View all {anomalyJobs.length} pending jobs →
              </Link>
            )}
          </div>
        </div>
      )}

      {carriedOverJobs.length > 0 && (
        <div className="relative">
          <div className="glass p-5 rounded-3xl" style={{position: 'relative'}}>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <FiRefreshCw className="text-white" size={16} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Carried Over</h2>
              </div>
              <span className="text-sm font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-800">
                {carriedOverJobs.length}
              </span>
            </div>
            <div className="overflow-x-auto pb-2 -mx-2 px-2 relative z-10">
              <div className="flex gap-3 min-w-max">
                {carriedOverJobs.slice(0, 5).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((job) => (
                  <button
                    key={job._id}
                    onClick={() => {
                      setSelectedJobForReassign(job)
                      setShowReassignModal(true)
                    }}
                    className="bg-gradient-to-br from-orange-50/90 to-orange-100/90 backdrop-blur-md border-2 border-orange-300 rounded-2xl p-4 hover:shadow-xl transition-all w-60 flex-shrink-0 hover:scale-105 text-left"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-sm text-gray-900">{job.jobNumber}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        job.status === 'OG' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'WP' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600 mb-2">
                      <div>{job.plateNumber}</div>
                      <div className="mt-1">
                        {job.assignedTechnician ? (
                          job.assignedTechnician.name
                        ) : (
                          <span className="text-red-600 font-bold">⚠️ Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r from-ios-primary to-ios-primary-light text-white text-center">
                      {job.assignedTechnician ? 'Reassign' : 'Assign'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {carriedOverJobs.length > 5 && (
              <Link 
                href="/dashboard/job-orders?filter=carried"
                className="block text-center mt-4 text-sm font-semibold text-ios-primary hover:underline"
              >
                View all {carriedOverJobs.length} carry-over jobs →
              </Link>
            )}
          </div>
        </div>
      )}

      {showJobDetailsModal && selectedJobForDetails && (
        <div className="modal-backdrop">
          <div className="glass max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in" style={{borderRadius: '24px', position: 'relative'}}>
            <div className="p-6 relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold tracking-tight text-gray-900">
                  Job Order Details
                </h3>
                <button 
                  onClick={() => {
                    setShowJobDetailsModal(false)
                    setSelectedJobForDetails(null)
                  }}
                  className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center text-2xl leading-none transition-colors text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-gray-900">
                      {selectedJobForDetails.jobNumber}
                    </h4>
                    <p className="text-sm font-medium mb-1 text-gray-700">
                      {selectedJobForDetails.plateNumber} - {selectedJobForDetails.vin}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(selectedJobForDetails.date).toLocaleDateString()} • {selectedJobForDetails.timeRange.start} - {selectedJobForDetails.timeRange.end}
                    </p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    selectedJobForDetails.status === 'WP' ? 'bg-orange-100 text-orange-700' :
                    selectedJobForDetails.status === 'OG' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedJobForDetails.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-base font-bold mb-3 text-gray-900">Parts Required</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedJobForDetails.parts.map((part, index) => (
                      <div key={index} className="p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-gray-900">{part.name}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                            part.availability === 'Available'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {part.availability}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-bold mb-3 text-gray-900">Job Tasks</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedJobForDetails.jobList.map((task, index) => (
                      <div key={index} className="p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-gray-900">{task.description}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                            task.status === 'Finished'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-base font-bold mb-1 text-gray-900">Assigned Technician</h4>
                    <p className="text-sm font-medium text-gray-700">
                      {selectedJobForDetails.assignedTechnician 
                        ? selectedJobForDetails.assignedTechnician.name 
                        : <span className="text-red-600 font-bold">⚠️ Not Assigned</span>
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowJobDetailsModal(false)
                      setSelectedJobForReassign(selectedJobForDetails)
                      setShowReassignModal(true)
                    }}
                    className="ios-button px-5 py-2.5 text-sm font-bold rounded-xl"
                  >
                    {selectedJobForDetails.assignedTechnician ? 'Reassign' : 'Assign'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowJobDetailsModal(false)
                    setSelectedJobForDetails(null)
                  }}
                  className="flex-1 ios-button-secondary py-2.5 rounded-xl font-bold text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowJobDetailsModal(false)
                    setSelectedJobForDetails(null)
                    queryClient.invalidateQueries({ queryKey: ['job-orders'] })
                  }}
                  className="flex-1 ios-button py-2.5 rounded-xl font-bold text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReassignModal && selectedJobForReassign && (
        <JobReassignmentModal
          jobOrder={selectedJobForReassign}
          onClose={() => {
            setShowReassignModal(false)
            setSelectedJobForReassign(null)
          }}
          onSuccess={() => {
            setShowReassignModal(false)
            setSelectedJobForReassign(null)
            queryClient.invalidateQueries({ queryKey: ['job-orders'] })
          }}
        />
      )}
    </div>
  )
}


