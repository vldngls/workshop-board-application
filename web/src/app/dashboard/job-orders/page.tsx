'use client'

import { useState, useCallback, useMemo, lazy, Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import type { JobOrder, JobStatus } from "@/types/jobOrder"
import JobOrderCard from "@/components/JobOrderCard"
import JobDetailsModal from "@/components/modals/JobDetailsModal"
import { useJobOrders, useUpdateJobOrder } from '@/hooks/useJobOrders'
import RoleGuard from "@/components/RoleGuard"

// Lazy load the modal for better initial load performance
const AddJobOrderModal = lazy(() => import("@/components/AddJobOrderModal"))

// Status mapping for display
const STATUS_LABELS: Record<JobStatus | 'all' | 'hold' | 'carried' | 'important' | 'unclaimed', string> = {
  'all': 'All Statuses',
  'OG': 'On Going',
  'WP': 'Waiting Parts',
  'UA': 'Unassigned',
  'QI': 'Quality Inspection',
  'HC': 'Hold Customer',
  'HW': 'Hold Warranty',
  'HI': 'Hold Insurance',
  'HF': 'Hold Ford',
  'SU': 'Sublet',
  'FR': 'For Release',
  'FU': 'Finished Unclaimed',
  'CP': 'Complete',
  'hold': 'On Hold (HC/HW/HI/WP)',
  'carried': 'Carried Over',
  'important': 'Important',
  'unclaimed': 'Unclaimed (FU/CP)'
}

export default function JobOrdersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState<JobStatus | 'all' | 'hold' | 'carried' | 'important' | 'unclaimed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<JobOrder | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  const updateJobMutation = useUpdateJobOrder()

  // Read filter from URL parameters on mount
  useEffect(() => {
    const urlFilter = searchParams?.get('filter')
    if (urlFilter) {
      setFilter(urlFilter as any)
    }
  }, [searchParams])

  // Read highlight parameter from URL
  useEffect(() => {
    const highlightParam = searchParams?.get('highlight')
    if (highlightParam) {
      setHighlightedJobId(highlightParam)
      
      // Scroll to the highlighted job after a short delay to ensure it's rendered
      setTimeout(() => {
        const element = document.querySelector(`[data-job-id="${highlightParam}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      
      // Clear the highlight after a delay
      const clearHighlightTimeout = setTimeout(() => {
        setHighlightedJobId(null)
        // Remove highlight from URL without page reload
        const url = new URL(window.location.href)
        url.searchParams.delete('highlight')
        window.history.replaceState({}, '', url.toString())
      }, 3000) // Highlight for 3 seconds
      
      // Cleanup timeout on unmount
      return () => clearTimeout(clearHighlightTimeout)
    }
  }, [searchParams])

  // Debounce search term
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchTerm])

  // Determine API status filter based on special filters
  const getApiStatusFilter = () => {
    if (filter === 'all' || filter === 'carried' || filter === 'important') {
      return undefined // Fetch all, filter locally
    }
    if (filter === 'hold') {
      return undefined // Fetch all, filter locally for HC/HW/HI/WP
    }
    if (filter === 'unclaimed') {
      return undefined // Fetch all, filter locally for FU/CP
    }
    return filter // Use the actual status
  }

  // Use TanStack Query to fetch job orders
  const { data, isLoading, error, refetch } = useJobOrders({
    search: debouncedSearch,
    status: getApiStatusFilter(),
    page: 1, // Fetch more for local filtering
    limit: 1000, // Get all jobs for local filtering
  })

  // Apply local filtering for special filters
  const getFilteredJobOrders = useMemo(() => {
    const allJobs = data?.jobOrders || []
    
    if (filter === 'all') return allJobs
    if (filter === 'hold') return allJobs.filter((job: JobOrder) => ['HC', 'HW', 'HI', 'WP'].includes(job.status))
    if (filter === 'carried') return allJobs.filter((job: JobOrder) => job.carriedOver)
    if (filter === 'important') return allJobs.filter((job: JobOrder) => job.isImportant)
    if (filter === 'unclaimed') return allJobs.filter((job: JobOrder) => job.status === 'FU' || job.status === 'CP')
    
    // For regular status filters
    return allJobs.filter((job: JobOrder) => job.status === filter)
  }, [data?.jobOrders, filter])

  // Paginate filtered results
  const paginatedJobOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * 10
    const endIndex = startIndex + 10
    return getFilteredJobOrders.slice(startIndex, endIndex)
  }, [getFilteredJobOrders, currentPage])

  const pagination = useMemo(() => {
    const totalItems = getFilteredJobOrders.length
    const itemsPerPage = 10
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
    
    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    }
  }, [getFilteredJobOrders, currentPage])

  const jobOrders = paginatedJobOrders

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    // Search is handled by debounced effect
  }, [])

  const handleFilterChange = useCallback((newFilter: JobStatus | 'all' | 'hold' | 'carried' | 'important' | 'unclaimed') => {
    setFilter(newFilter)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleOpenDetails = useCallback((job: JobOrder) => {
    setSelectedJob(job)
    setShowDetails(true)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setShowDetails(false)
    setSelectedJob(null)
  }, [])

  const handleUpdateJob = useCallback((jobId: string, updates: Partial<{ plateNumber: string, vin: string, timeRange: { start: string, end: string } }>) => {
    updateJobMutation.mutate({ id: jobId, updates: updates as any }, {
      onSuccess: () => {
        // Keep modal open and refresh list state via query invalidation
      }
    })
  }, [updateJobMutation])

  const handleViewIn = useCallback((jobId: string, jobDate: string, status: string) => {
    const dateParam = (() => {
      const d = new Date(jobDate)
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0,10)
      return d.toISOString().slice(0,10)
    })()
    router.push(`/dashboard/workshop?date=${encodeURIComponent(dateParam)}&highlight=${encodeURIComponent(jobId)}`)
  }, [router])

  const handleJobOrderCreated = useCallback(() => {
    setShowAddModal(false)
    // TanStack Query will automatically refetch due to cache invalidation
  }, [])

  const handleUpdateJobStatus = useCallback((jobId: string, status: string, remarks?: string) => {
    // For now, just show a toast - in a real implementation, you'd call an API
    console.log('Update job status:', { jobId, status, remarks })
  }, [])

  const handleCarryOver = useCallback((jobId: string) => {
    // For now, just show a toast - in a real implementation, you'd call an API
    console.log('Carry over job:', jobId)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error.message}</div>
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={['administrator', 'job-controller']}>
      <div className="space-y-6">
        <Toaster position="top-right" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Orders</h1>
          <div className="text-sm text-gray-600">
            Manage and track all job orders
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="ford-gradient text-white px-6 py-2.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          Add Job Order
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="floating-card p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Job Orders
            </label>
            <form onSubmit={handleSearch} className="flex gap-2" suppressHydrationWarning>
              <input
                type="text"
                placeholder="Search by job number, plate number, VIN, or technician name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ford-blue focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 ford-gradient text-white rounded-lg transition-colors font-medium"
              >
                Search
              </button>
            </form>
          </div>

          {/* Status Filter Dropdown */}
          <div className="lg:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchTerm || filter !== 'all') && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-ford-blue/10 text-ford-blue">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-ford-blue hover:text-ford-blue-light"
                  >
                    ×
                  </button>
                </span>
              )}
              {filter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  Status: {STATUS_LABELS[filter]}
                  <button
                    onClick={() => handleFilterChange('all')}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search helper text */}
      {searchTerm && (
        <div className="mt-[-12px] mb-2 text-sm text-gray-600">
          Press Enter or click Search to find results
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {jobOrders.length} of {pagination.totalItems} job orders
        {searchTerm && ` for "${searchTerm}"`}
        {filter !== 'all' && ` with status "${STATUS_LABELS[filter]}"`}
      </div>

      {/* Job Orders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading job orders...</div>
        </div>
      ) : jobOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {searchTerm 
              ? `No job orders found for "${searchTerm}"`
              : filter === 'all' 
                ? 'No job orders found' 
                : `No job orders found with status "${STATUS_LABELS[filter]}"`
            }
          </div>
          {(searchTerm || filter !== 'all') && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchTerm('')
                  handleFilterChange('all')
                }}
                className="text-ford-blue hover:text-ford-blue-light font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {jobOrders.map((jobOrder: JobOrder) => (
              <JobOrderCard
                key={jobOrder._id}
                jobOrder={jobOrder}
                onClick={handleOpenDetails}
                onViewIn={handleViewIn}
                highlighted={highlightedJobId === jobOrder._id}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between floating-card p-4">
              <div className="text-sm text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages} 
                ({pagination.totalItems} total items)
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="px-4 py-2 text-sm bg-white/50 hover:bg-white/70 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/50"
                >
                  Previous
                </button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.currentPage - 2)
                    const pageNum = startPage + i
                    if (pageNum > pagination.totalPages) return null
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-xl font-semibold transition-all ${
                          pageNum === pagination.currentPage
                            ? 'bg-gradient-to-r from-ford-blue to-ford-blue-light text-white shadow-lg'
                            : 'bg-white/50 hover:bg-white/70 border border-white/50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-4 py-2 text-sm bg-white/50 hover:bg-white/70 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Job Order Modal */}
      {showAddModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
          <AddJobOrderModal
            onClose={() => setShowAddModal(false)}
            onSuccess={handleJobOrderCreated}
          />
        </Suspense>
      )}

      {/* Job Details Modal */}
      {showDetails && selectedJob && (
        <JobDetailsModal
          isOpen={showDetails}
          job={selectedJob as any}
          updating={false}
          onClose={handleCloseDetails}
          onUpdateJob={handleUpdateJob}
          onViewIn={handleViewIn}
          onViewInJobOrders={(jobId: string) => {
            // Already on job orders page, just set the highlight
            setHighlightedJobId(jobId)
            // Clear highlight after 3 seconds
            setTimeout(() => setHighlightedJobId(null), 3000)
          }}
          onUpdateJobStatus={handleUpdateJobStatus}
          onCarryOver={handleCarryOver}
        />
      )}
      </div>
    </RoleGuard>
  )
}
