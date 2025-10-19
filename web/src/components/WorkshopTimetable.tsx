"use client"

import { useState, useEffect, useCallback, memo } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import type { JobOrder } from '@/types/jobOrder'
import type { Appointment } from '@/types/appointment'
import type { Role } from '@/types/auth'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'
import { useWorkshopData } from '@/hooks/useWorkshopData'
import { useJobActions } from '@/hooks/useJobActions'
import TimetableHeader from './timetable/TimetableHeader'
import TimetableGrid from './timetable/TimetableGrid'
import JobStatusSections from './status-sections/JobStatusSections'
import JobDetailsModal from './modals/JobDetailsModal'
import ReassignTimeSlotModal from './ReassignTimeSlotModal'
import ReplotJobOrderModal from './ReplotJobOrderModal'
import CreateJobOrderFromAppointmentModal from './CreateJobOrderFromAppointmentModal'
import ConfirmDialog from './ConfirmDialog'
import ReassignmentModal from './ReassignmentModal'

interface WorkshopTimetableProps {
  date: Date
  onDateChange: (date: Date) => void
  highlightJobId?: string
}

function WorkshopTimetable({ date, onDateChange, highlightJobId }: WorkshopTimetableProps) {
  const [userRole, setUserRole] = useState<Role | null>(null)
  
  // Get user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/auth/me', { 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.user.role as Role)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      }
    }

    fetchUserRole()
  }, [])

  // Use custom hooks for data and actions
  const {
    jobOrders,
    technicians,
    appointments,
    qiJobs,
    forReleaseJobs,
    waitingPartsJobs,
    forPlottingJobs,
    carriedOverJobs,
    holdCustomerJobs,
    holdWarrantyJobs,
    holdInsuranceJobs,
    finishedUnclaimedJobs,
    loading,
    updating,
    fetchData,
    setUpdating,
    updateJobOrders,
    updateQiJobs,
    updateForReleaseJobs,
    updateWaitingPartsJobs,
    updateHoldCustomerJobs,
    updateHoldWarrantyJobs,
    updateHoldInsuranceJobs,
    updateFinishedUnclaimedJobs
  } = useWorkshopData(date)

  // Modal and UI state
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showTechnicianModal, setShowTechnicianModal] = useState(false)
  const [availableTechnicians, setAvailableTechnicians] = useState<any[]>([])
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCreateJobOrderModal, setShowCreateJobOrderModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [reassignmentSlot, setReassignmentSlot] = useState<{
    technicianId: string
    technicianName: string
    startTime: string
    endTime: string
  } | null>(null)
  const [showReplotModal, setShowReplotModal] = useState(false)
  const [showCarryOverReassignModal, setShowCarryOverReassignModal] = useState(false)
  const [selectedCarryOverJob, setSelectedCarryOverJob] = useState<JobOrderWithDetails | null>(null)
  
  // Break time settings
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // Load break settings from localStorage
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
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

  // Handle carry-over job reassignment
  const handleCarryOverReassign = useCallback((job: JobOrderWithDetails) => {
    setSelectedCarryOverJob(job)
    setShowCarryOverReassignModal(true)
  }, [])

  // Use job actions hook
  const {
    toggleImportant,
    updateJobStatus,
    updateTaskStatus,
    updatePartAvailability,
    submitForQI,
    approveQI,
    rejectQI,
    completeJob,
    redoJob,
    markComplete,
    getCurrentTime
  } = useJobActions({
    jobOrders,
    selectedJob,
    updating,
    setUpdating,
    updateJobOrders,
    updateQiJobs,
    updateForReleaseJobs,
    updateWaitingPartsJobs,
    updateHoldCustomerJobs,
    updateHoldWarrantyJobs,
    updateHoldInsuranceJobs,
    updateFinishedUnclaimedJobs,
    setSelectedJob,
    fetchData
  })

  // Handle highlighting a specific job
  useEffect(() => {
    if (highlightJobId) {
      setHighlightedJobId(highlightJobId)
      
      // Scroll to the job after a short delay to ensure DOM is ready
      setTimeout(() => {
        const jobElement = document.querySelector(`[data-job-id="${highlightJobId}"]`)
        if (jobElement) {
          jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedJobId(null)
      }, 3500)
    }
  }, [highlightJobId])

  // Event handlers
  const handleCellClick = useCallback((job: any) => {
    setSelectedJob(job)
    setShowModal(true)
  }, [])

  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setShowCreateJobOrderModal(true)
  }, [])

  const handleDeleteAppointment = useCallback((appointmentId: string) => {
    setAppointmentToDelete(appointmentId)
    setShowDeleteConfirm(true)
  }, [])

  const confirmDeleteAppointment = useCallback(async () => {
    if (!appointmentToDelete) return

    try {
      const response = await fetch(`/api/appointments/${appointmentToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to delete appointment')
      }

      // Update appointments state
      // Note: This would need to be handled in the useWorkshopData hook
      toast.success('Appointment deleted (no show)')
    } catch (error) {
      console.error('Error deleting appointment:', error)
      toast.error('Failed to delete appointment')
    } finally {
      setShowDeleteConfirm(false)
      setAppointmentToDelete(null)
    }
  }, [appointmentToDelete])

  const cancelDeleteAppointment = useCallback(() => {
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }, [])

  const handleCreateJobOrderSuccess = useCallback(() => {
    setShowCreateJobOrderModal(false)
    setSelectedAppointment(null)
    fetchData()
    toast.success('Job order created from appointment!')
  }, [fetchData])

  const reassignTechnician = useCallback(async (technicianId: string) => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const response = await fetch(`/api/job-orders/${selectedJob._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTechnician: technicianId })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reassign technician')
      }
      const data = await response.json()
      setSelectedJob(data.jobOrder)
      setShowTechnicianModal(false)
      await fetchData()
      toast.success('Technician reassigned successfully')
    } catch (error: any) {
      console.error('Error reassigning technician:', error)
      toast.error(error.message || 'Failed to reassign technician')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData, setUpdating])

  // Fetch available technicians when modal opens
  useEffect(() => {
    const fetchAvailableTechnicians = async () => {
      if (!showTechnicianModal || !selectedJob) return
      
      try {
        const response = await fetch(
          `/api/job-orders/technicians/available?date=${selectedJob.date.split('T')[0]}&startTime=${selectedJob.timeRange.start}&endTime=${selectedJob.timeRange.end}`,
          { credentials: 'include' }
        )
        if (!response.ok) throw new Error('Failed to fetch available technicians')
        const data = await response.json()
        setAvailableTechnicians(data.technicians || [])
      } catch (error) {
        console.error('Error fetching technicians:', error)
        toast.error('Failed to fetch available technicians')
      }
    }
    
    fetchAvailableTechnicians()
  }, [showTechnicianModal, selectedJob])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading timetable...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <TimetableHeader
        date={date}
        onDateChange={onDateChange}
        jobOrders={jobOrders}
        forReleaseJobs={forReleaseJobs}
        holdCustomerJobs={holdCustomerJobs}
        holdWarrantyJobs={holdWarrantyJobs}
        holdInsuranceJobs={holdInsuranceJobs}
        waitingPartsJobs={waitingPartsJobs}
      />

      {/* Timetable Grid */}
      <TimetableGrid
        technicians={technicians}
        jobOrders={jobOrders}
        appointments={appointments}
        highlightedJobId={highlightedJobId}
        breakStart={breakStart}
        breakEnd={breakEnd}
        onJobClick={handleCellClick}
        onAppointmentClick={handleAppointmentClick}
        onDeleteAppointment={userRole === 'technician' ? undefined : handleDeleteAppointment}
      />

      {/* Job Status Sections */}
      <JobStatusSections
        qiJobs={qiJobs}
        forReleaseJobs={forReleaseJobs}
        waitingPartsJobs={waitingPartsJobs}
        forPlottingJobs={forPlottingJobs}
        carriedOverJobs={carriedOverJobs}
        holdCustomerJobs={holdCustomerJobs}
        holdWarrantyJobs={holdWarrantyJobs}
        holdInsuranceJobs={holdInsuranceJobs}
        finishedUnclaimedJobs={finishedUnclaimedJobs}
        updating={updating}
        onJobClick={handleCellClick}
        onApproveQI={userRole === 'technician' ? undefined : approveQI}
        onRejectQI={userRole === 'technician' ? undefined : rejectQI}
        onCompleteJob={userRole === 'technician' ? undefined : completeJob}
        onRedoJob={userRole === 'technician' ? undefined : redoJob}
        onMarkComplete={userRole === 'technician' ? undefined : markComplete}
        onReassignCarryOver={userRole === 'technician' ? undefined : handleCarryOverReassign}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={showModal}
        job={selectedJob}
        updating={updating}
        breakStart={breakStart}
        breakEnd={breakEnd}
        onClose={() => setShowModal(false)}
        onToggleImportant={userRole === 'technician' ? undefined : toggleImportant}
        onUpdateJobStatus={userRole === 'technician' ? undefined : updateJobStatus}
        onUpdateTaskStatus={userRole === 'technician' ? undefined : updateTaskStatus}
        onUpdatePartAvailability={userRole === 'technician' ? undefined : updatePartAvailability}
        onReassignTechnician={userRole === 'technician' ? undefined : () => setShowTechnicianModal(true)}
        onReplotJob={userRole === 'technician' ? undefined : () => {
                        setShowModal(false)
                        setShowReplotModal(true)
                      }}
        onSubmitForQI={userRole === 'technician' ? undefined : submitForQI}
      />

      {/* Technician Reassignment Modal */}
      {showTechnicianModal && selectedJob && userRole !== 'technician' && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Reassign Technician</h3>
                <button
                  onClick={() => setShowTechnicianModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl p-3">
                  <p className="text-sm text-gray-700 font-medium">
                    Current: <span className="font-bold text-gray-900">
                      {selectedJob.assignedTechnician ? selectedJob.assignedTechnician.name : (
                        <span className="text-red-600">Not Assigned</span>
                      )}
                    </span>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-800">Available Technicians:</p>
                  {availableTechnicians.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-4 font-medium">Loading available technicians...</p>
                  ) : (
                    availableTechnicians.map((tech) => (
                      <button
                        key={tech._id}
                        onClick={() => reassignTechnician(tech._id)}
                        disabled={updating || (selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id)}
                        className={`w-full p-3 rounded-xl text-sm font-semibold text-left transition-all duration-200 ${
                          selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border border-blue-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{tech.name}</span>
                          {tech.level && (
                            <span className="text-xs bg-blue-500/30 text-blue-800 px-2 py-1 rounded-lg border border-blue-400/30">{tech.level}</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Slot Reassignment Modal */}
      {showReassignModal && reassignmentSlot && (
        <ReassignTimeSlotModal
          onClose={() => {
            setShowReassignModal(false)
            setReassignmentSlot(null)
          }}
          technicianId={reassignmentSlot.technicianId}
          technicianName={reassignmentSlot.technicianName}
          date={date.toISOString().split('T')[0]}
          startTime={reassignmentSlot.startTime}
          endTime={reassignmentSlot.endTime}
          onJobAssigned={() => {
            fetchData()
          }}
        />
      )}

      {/* Replot Job Order Modal */}
      {showReplotModal && selectedJob && userRole !== 'technician' && (
        <ReplotJobOrderModal
          onClose={() => setShowReplotModal(false)}
          jobId={selectedJob._id}
          jobNumber={selectedJob.jobNumber}
          currentDate={selectedJob.date.split('T')[0]}
          onSuccess={() => {
            fetchData()
          }}
        />
      )}

      {/* Create Job Order from Appointment Modal */}
      {showCreateJobOrderModal && selectedAppointment && userRole !== 'technician' && (
        <CreateJobOrderFromAppointmentModal
          appointment={selectedAppointment}
          onClose={() => {
            setShowCreateJobOrderModal(false)
            setSelectedAppointment(null)
          }}
          onSuccess={handleCreateJobOrderSuccess}
        />
      )}

      {/* Delete Appointment Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Appointment"
        message="Mark this appointment as no-show and delete it? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteAppointment}
        onCancel={cancelDeleteAppointment}
      />

      {/* Carry-Over Reassignment Modal */}
      {showCarryOverReassignModal && selectedCarryOverJob && (
        <ReassignmentModal
          job={selectedCarryOverJob}
          breakStart={breakStart}
          breakEnd={breakEnd}
          calculateEndTime={calculateEndTime}
          onClose={() => {
            setShowCarryOverReassignModal(false)
            setSelectedCarryOverJob(null)
          }}
          onSuccess={() => {
            setShowCarryOverReassignModal(false)
            setSelectedCarryOverJob(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(WorkshopTimetable)
