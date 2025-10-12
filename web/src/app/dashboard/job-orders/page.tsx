'use client'

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import type { JobOrder, JobStatus } from "@/types/jobOrder"
import JobOrderCard from "@/components/JobOrderCard"

// Lazy load the modal for better initial load performance
const AddJobOrderModal = lazy(() => import("@/components/AddJobOrderModal"))

// Status mapping for display
const STATUS_LABELS: Record<JobStatus | 'all', string> = {
  'all': 'All Statuses',
  'OG': 'On Going',
  'WP': 'Waiting Parts',
  'QI': 'Quality Inspection',
  'HC': 'Hold Customer',
  'HW': 'Hold Warranty',
  'HI': 'Hold Insurance',
  'FR': 'For Release',
  'FU': 'Finished Unclaimed',
  'CP': 'Complete'
}

export default function JobOrdersPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState<JobStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  })
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null)

  const fetchJobOrders = useCallback(async (page = 1, search = '', status = 'all') => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (status !== 'all') params.append('status', status)
      params.append('page', page.toString())
      params.append('limit', '10')
      
      const response = await fetch(`/api/job-orders?${params.toString()}`, {
        credentials: 'include' // Include cookies for authentication
      })
      if (!response.ok) {
        throw new Error('Failed to fetch job orders')
      }
      const data = await response.json()
      
      // Sort job orders - important ones first, then carried over, then regular
      const sortedJobs = (data.jobOrders || []).sort((a: JobOrder, b: JobOrder) => {
        if (a.isImportant && !b.isImportant) return -1
        if (!a.isImportant && b.isImportant) return 1
        if (a.carriedOver && !b.carriedOver) return -1
        if (!a.carriedOver && b.carriedOver) return 1
        return 0
      })
      
      setJobOrders(sortedJobs)
      setPagination(data.pagination || pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    const timeout = setTimeout(() => {
      fetchJobOrders(currentPage, searchTerm, filter)
    }, 300) // 300ms debounce

    setDebounceTimeout(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [currentPage, filter, searchTerm, fetchJobOrders])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    // Search now triggers via debounced effect
  }, [])

  const handleFilterChange = useCallback((newFilter: JobStatus | 'all') => {
    setFilter(newFilter)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleJobOrderCreated = useCallback(() => {
    setShowAddModal(false)
    fetchJobOrders(currentPage, searchTerm, filter)
  }, [currentPage, searchTerm, filter, fetchJobOrders])

  const handleJobOrderUpdated = useCallback(() => {
    fetchJobOrders(currentPage, searchTerm, filter)
  }, [currentPage, searchTerm, filter, fetchJobOrders])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Job Orders</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Add Job Order
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Job Orders
            </label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search by job number, plate number, VIN, or technician name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Search
              </button>
            </form>
            {searchTerm && (
              <div className="mt-2 text-sm text-gray-600">
                Press Enter or click Search to find results
              </div>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="lg:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value as JobStatus | 'all')}
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
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      fetchJobOrders(1, '', filter)
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-800"
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

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {jobOrders.length} of {pagination.totalItems} job orders
        {searchTerm && ` for "${searchTerm}"`}
        {filter !== 'all' && ` with status "${STATUS_LABELS[filter]}"`}
      </div>

      {/* Job Orders Grid */}
      {loading ? (
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
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobOrders.map((jobOrder) => (
              <JobOrderCard
                key={jobOrder._id}
                jobOrder={jobOrder}
                onUpdate={handleJobOrderUpdated}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages} 
                ({pagination.totalItems} total items)
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`px-3 py-2 text-sm rounded-lg ${
                          pageNum === pagination.currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
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
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
