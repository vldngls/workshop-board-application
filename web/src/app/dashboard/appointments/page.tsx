'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { FiTrash2, FiCalendar } from 'react-icons/fi'
import type { Appointment, CreateAppointmentRequest } from "@/types/appointment"
import CreateJobOrderFromAppointmentModal from '@/components/CreateJobOrderFromAppointmentModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import TechnicianScheduleView from '@/components/TechnicianScheduleView'

interface Technician {
  _id: string
  name: string
  email: string
  level: string
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient()
  const plateInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  
  const [formData, setFormData] = useState({
    technician: '',
    plateNumber: '',
    startTime: '07:00',
    duration: 300 // Duration in minutes (default 5 hours)
  })

  // Calculate end time based on start time and duration
  const calculateEndTime = (start: string, durationMinutes: number): string => {
    const [hours, minutes] = start.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  const endTime = calculateEndTime(formData.startTime, formData.duration)

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCreateJobOrderModal, setShowCreateJobOrderModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showReappointModal, setShowReappointModal] = useState(false)
  const [appointmentToReappoint, setAppointmentToReappoint] = useState<Appointment | null>(null)
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // Load break settings from localStorage
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
  }, [])

  // Check if an appointment would overlap with break time
  const wouldOverlapWithBreak = (startTime: string, duration: number): boolean => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = startMinutes + duration
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    // Check if appointment overlaps with break time
    return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes
  }

  // Fetch technicians
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians', 'role=technician'],
    queryFn: async () => {
      const res = await fetch(`/api/users?role=technician`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch technicians')
      return res.json() as Promise<{ users: Technician[] }>
    }
  })

  // Fetch appointments for selected date (excluding no shows)
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ['appointments', selectedDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments?date=${selectedDate}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch appointments')
      const data = await res.json() as { appointments: Appointment[] }
      // Filter out no-show appointments
      return { appointments: data.appointments.filter(apt => !apt.noShow) }
    }
  })

  // Fetch no-show appointments
  const { data: noShowsData } = useQuery({
    queryKey: ['no-show-appointments'],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch no-show appointments')
      const data = await res.json() as { appointments: Appointment[] }
      // Filter only no-show appointments
      return { appointments: data.appointments.filter(apt => apt.noShow) }
    }
  })

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAppointmentRequest) => {
      const res = await fetch(`/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details ? `${error.error}\n${error.details}` : error.error || 'Failed to create appointment'
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment added!')
      // Clear only plate number for quick re-entry
      setFormData(prev => ({ ...prev, plateNumber: '' }))
      // Auto-focus plate number input for next entry
      setTimeout(() => plateInputRef.current?.focus(), 100)
    },
    onError: (error: Error) => {
      toast.error(error.message, { duration: 5000 })
    }
  })

  // Mark as no show mutation
  const markNoShowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noShow: true })
      })
      if (!res.ok) throw new Error('Failed to mark appointment as no show')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['no-show-appointments'] })
      toast.success('Appointment marked as no show')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Delete all no-show appointments mutation
  const deleteAllNoShowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/appointments/delete-all-no-show', {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to delete all no-show appointments')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['no-show-appointments'] })
      toast.success('All no-show appointments deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Delete individual no-show appointment mutation
  const deleteNoShowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to delete appointment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['no-show-appointments'] })
      toast.success('Appointment deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Reappoint mutation
  const reappointMutation = useMutation({
    mutationFn: async ({ id, newDate, newTimeRange, newTechnician }: { 
      id: string, 
      newDate: string, 
      newTimeRange: { start: string, end: string }, 
      newTechnician: string 
    }) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          date: newDate,
          timeRange: newTimeRange,
          assignedTechnician: newTechnician,
          noShow: false
        })
      })
      if (!res.ok) throw new Error('Failed to reappoint')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['no-show-appointments'] })
      toast.success('Appointment rescheduled')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    if (!formData.technician || !formData.plateNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    // Check if appointment would overlap with break time
    if (wouldOverlapWithBreak(formData.startTime, formData.duration)) {
      toast.error(`Appointment cannot be scheduled during break time (${breakStart} - ${breakEnd})`)
      return
    }

    createMutation.mutate({
      assignedTechnician: formData.technician,
      plateNumber: formData.plateNumber,
      timeRange: {
        start: formData.startTime,
        end: endTime
      },
      date: selectedDate
    })
  }

  const handleNoShow = (id: string) => {
    setAppointmentToDelete(id)
    setShowDeleteConfirm(true)
  }

  const confirmNoShow = () => {
    if (appointmentToDelete) {
      markNoShowMutation.mutate(appointmentToDelete)
    }
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  const handleDeleteAllNoShow = () => {
    setShowDeleteAllConfirm(true)
  }

  const confirmDeleteAllNoShow = () => {
    deleteAllNoShowMutation.mutate()
    setShowDeleteAllConfirm(false)
  }

  const cancelDeleteAll = () => {
    setShowDeleteAllConfirm(false)
  }

  const handleDeleteNoShow = (id: string) => {
    deleteNoShowMutation.mutate(id)
  }

  const handleReappoint = (appointment: Appointment) => {
    setAppointmentToReappoint(appointment)
    setShowReappointModal(true)
  }

  const handleReappointSuccess = () => {
    setShowReappointModal(false)
    setAppointmentToReappoint(null)
  }

  const handleCreateJobOrder = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setShowCreateJobOrderModal(true)
  }

  const handleCreateJobOrderSuccess = () => {
    setShowCreateJobOrderModal(false)
    setSelectedAppointment(null)
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    toast.success('Job order created from appointment!')
  }

  const handleTimeSlotSelect = (startTime: string) => {
    // Just set the start time, duration is already set
    setFormData(prev => ({
      ...prev,
      startTime
    }))
  }

  const technicians = techniciansData?.users || []
  const appointments = appointmentsData?.appointments || []
  const noShowAppointments = noShowsData?.appointments || []

  // Filter appointments based on search term
  const filteredAppointments = appointments.filter(appointment =>
    appointment.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.assignedTechnician?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredNoShowAppointments = noShowAppointments.filter(appointment =>
    appointment.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.assignedTechnician?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate statistics
  const stats = {
    total: appointments.length,
    noShow: noShowAppointments.length,
    completed: appointments.filter(apt => apt.noShow === false).length,
    today: appointments.filter(apt => apt.date === selectedDate).length
  }

  // Auto-focus plate input on mount
  useEffect(() => {
    plateInputRef.current?.focus()
  }, [])

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        <div className="text-sm text-gray-600">
          Record appointments and convert them to job orders
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="floating-card p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Appointments</div>
        </div>
        <div className="floating-card p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="floating-card p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.noShow}</div>
          <div className="text-sm text-gray-600">No Shows</div>
        </div>
        <div className="floating-card p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.today}</div>
          <div className="text-sm text-gray-600">Today</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" suppressHydrationWarning>
        {/* Quick Entry Form */}
        <div className="floating-card p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Quick Entry</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Date
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0]
                    setSelectedDate(today)
                  }}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
                  title="Set to today"
                >
                  Today
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Work Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                suppressHydrationWarning
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={150}>2.5 hours</option>
                <option value={180}>3 hours</option>
                <option value={210}>3.5 hours</option>
                <option value={240}>4 hours</option>
                <option value={270}>4.5 hours</option>
                <option value={300}>5 hours</option>
                <option value={330}>5.5 hours</option>
                <option value={360}>6 hours</option>
                <option value={420}>7 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Technician *
              </label>
              <select
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                suppressHydrationWarning
              >
                <option value="">Select technician...</option>
                {technicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name} ({tech.level})
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Schedule Selector */}
            {formData.technician && (
              <div className="border-t border-neutral-200 pt-4">
                <TechnicianScheduleView
                  technicianId={formData.technician}
                  date={selectedDate}
                  duration={formData.duration}
                  onTimeSlotSelect={handleTimeSlotSelect}
                  selectedStart={formData.startTime}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Time {formData.technician && <span className="text-xs text-neutral-500">(or select from schedule above)</span>}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                suppressHydrationWarning
              />
              <div className="text-xs text-neutral-500 mt-1">
                End time: {endTime}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Plate Number *
              </label>
              <input
                ref={plateInputRef}
                type="text"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                placeholder="ABC1234"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                required
                suppressHydrationWarning
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full workshop-button disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Appointment'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl">
            <p className="text-xs text-blue-800 font-medium">
              <strong>Workflow:</strong> 1) Select work duration, 2) Select technician to see their schedule, 
              3) Click an available time slot to set start time, 4) Enter plate number, 5) Click &quot;Add Appointment&quot;. 
              The form stays open for quick successive entries!
            </p>
          </div>
        </div>

        {/* Appointments List */}
        <div className="floating-card p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-neutral-900">
              Appointments for {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-6 text-neutral-500">Loading...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-6 text-neutral-500">
              {searchTerm ? 'No appointments match your search' : 'No appointments scheduled for this date'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment._id}
                  className="bg-white/40 backdrop-blur-sm border border-white/40 rounded-md p-3 hover:bg-white/60 transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-900 text-sm">
                        {appointment.plateNumber}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {appointment.assignedTechnician?.name || 'No technician assigned'}
                        {appointment.assignedTechnician?.level && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {appointment.assignedTechnician.level}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-600">
                      {appointment.timeRange.start} - {appointment.timeRange.end}
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleCreateJobOrder(appointment)}
                      className="flex-1 create-job-button text-xs py-1.5"
                    >
                      Create JO
                    </button>
                    <button
                      onClick={() => handleNoShow(appointment._id)}
                      disabled={markNoShowMutation.isPending}
                      className="flex-1 no-show-button text-xs py-1.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      ✕ No Show
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* No Show Appointments List */}
        <div className="floating-card p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-neutral-900">
              No Show List ({filteredNoShowAppointments.length})
            </h2>
            {filteredNoShowAppointments.length > 0 && (
              <button
                onClick={handleDeleteAllNoShow}
                disabled={deleteAllNoShowMutation.isPending}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
              >
                <FiTrash2 size={14} className="inline mr-1" />
                Delete All
              </button>
            )}
          </div>

          {filteredNoShowAppointments.length === 0 ? (
            <div className="text-center py-6 text-neutral-500">
              {searchTerm ? 'No no-show appointments match your search' : 'No appointments marked as no show'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredNoShowAppointments.map((appointment) => (
                <div
                  key={appointment._id}
                  className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-md p-3"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-900 text-sm">
                        {appointment.plateNumber}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {appointment.assignedTechnician?.name || 'No technician assigned'}
                        {appointment.assignedTechnician?.level && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {appointment.assignedTechnician.level}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(appointment.date).toLocaleDateString()} • {appointment.timeRange.start} - {appointment.timeRange.end}
                      </div>
                    </div>
                    <span className="text-xs bg-red-500/30 backdrop-blur-sm text-red-800 px-2 py-1 rounded-md font-bold border border-red-400/30">
                      NO SHOW
                    </span>
                  </div>
                  
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => handleReappoint(appointment)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1.5 px-2 rounded transition-colors"
                    >
                      <FiCalendar size={14} className="inline mr-1" />
                      Reappoint
                    </button>
                    <button
                      onClick={() => handleDeleteNoShow(appointment._id)}
                      disabled={deleteNoShowMutation.isPending}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1.5 px-2 rounded transition-colors disabled:opacity-50"
                    >
                      <FiTrash2 size={14} className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Job Order from Appointment Modal */}
      {showCreateJobOrderModal && selectedAppointment && (
        <CreateJobOrderFromAppointmentModal
          appointment={selectedAppointment}
          onClose={() => {
            setShowCreateJobOrderModal(false)
            setSelectedAppointment(null)
          }}
          onSuccess={handleCreateJobOrderSuccess}
        />
      )}

      {/* No Show Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Mark as No Show"
        message="Mark this appointment as no-show? It will be moved to the No Show List."
        confirmLabel="Mark as No Show"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmNoShow}
        onCancel={cancelDelete}
      />

      {/* Delete All No-Show Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        title="Delete All No-Show Appointments"
        message={`Are you sure you want to permanently delete all ${filteredNoShowAppointments.length} no-show appointments? This action cannot be undone.`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteAllNoShow}
        onCancel={cancelDeleteAll}
      />

      {/* Reappoint Modal */}
      {showReappointModal && appointmentToReappoint && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Reappoint Appointment</h3>
                <button
                  onClick={() => setShowReappointModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-lg p-3">
                  <p className="text-sm text-gray-700 font-medium">
                    <strong>Plate:</strong> {appointmentToReappoint.plateNumber}
                  </p>
                  <p className="text-sm text-gray-700 font-medium">
                    <strong>Technician:</strong> {appointmentToReappoint.assignedTechnician?.name || 'No technician assigned'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    New Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    New Time Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={appointmentToReappoint.timeRange.start}
                      onChange={(e) => {
                        const newEndTime = calculateEndTime(e.target.value, formData.duration)
                        setAppointmentToReappoint({
                          ...appointmentToReappoint,
                          timeRange: {
                            start: e.target.value,
                            end: newEndTime
                          }
                        })
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="time"
                      value={appointmentToReappoint.timeRange.end}
                      onChange={(e) => {
                        setAppointmentToReappoint({
                          ...appointmentToReappoint,
                          timeRange: {
                            ...appointmentToReappoint.timeRange,
                            end: e.target.value
                          }
                        })
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Technician
                  </label>
                  <select
                    value={appointmentToReappoint.assignedTechnician?._id || ''}
                    onChange={(e) => {
                      const technician = technicians.find(t => t._id === e.target.value)
                      setAppointmentToReappoint({
                        ...appointmentToReappoint,
                        assignedTechnician: technician ? {
                          _id: technician._id,
                          name: technician.name,
                          email: technician.email,
                          level: technician.level
                        } : null
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select technician...</option>
                    {technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name} ({tech.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/30 mt-6">
                <button
                  type="button"
                  onClick={() => setShowReappointModal(false)}
                  className="flex-1 px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-lg font-semibold text-neutral-700 transition-all duration-200 border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (appointmentToReappoint.assignedTechnician) {
                      reappointMutation.mutate({
                        id: appointmentToReappoint._id,
                        newDate: selectedDate,
                        newTimeRange: appointmentToReappoint.timeRange,
                        newTechnician: appointmentToReappoint.assignedTechnician._id
                      })
                      handleReappointSuccess()
                    }
                  }}
                  disabled={!appointmentToReappoint.assignedTechnician || reappointMutation.isPending}
                  className="flex-1 workshop-button disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {reappointMutation.isPending ? 'Reappointing...' : 'Reappoint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

