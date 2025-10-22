import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface EditJobTasksModalProps {
  isOpen: boolean
  job: JobOrderWithDetails | null
  onClose: () => void
  onSave: (jobId: string, jobList: Array<{ description: string; status: 'Finished' | 'Unfinished' }>, parts: Array<{ name: string; availability: 'Available' | 'Unavailable' }>) => void
  updating: boolean
}

export default function EditJobTasksModal({ isOpen, job, onClose, onSave, updating }: EditJobTasksModalProps) {
  const [jobList, setJobList] = useState<Array<{ description: string; status: 'Finished' | 'Unfinished' }>>([])
  const [parts, setParts] = useState<Array<{ name: string; availability: 'Available' | 'Unavailable' }>>([])

  useEffect(() => {
    if (job) {
      setJobList([...job.jobList])
      setParts([...job.parts])
    }
  }, [job])

  const addTask = () => {
    setJobList([...jobList, { description: '', status: 'Unfinished' }])
  }

  const removeTask = (index: number) => {
    setJobList(jobList.filter((_, i) => i !== index))
  }

  const updateTask = (index: number, field: 'description' | 'status', value: string) => {
    const updated = [...jobList]
    updated[index] = { ...updated[index], [field]: value }
    setJobList(updated)
  }

  const addPart = () => {
    setParts([...parts, { name: '', availability: 'Available' }])
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const updatePart = (index: number, field: 'name' | 'availability', value: string) => {
    const updated = [...parts]
    updated[index] = { ...updated[index], [field]: value }
    setParts(updated)
  }

  const handleSave = () => {
    if (!job) return
    
    // Filter out empty tasks and parts
    const validJobList = jobList.filter(task => task.description.trim() !== '')
    const validParts = parts.filter(part => part.name.trim() !== '')
    
    onSave(job._id, validJobList, validParts)
  }

  const isValid = jobList.some(task => task.description.trim() !== '') && parts.some(part => part.name.trim() !== '')

  if (!isOpen || !job) return null

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Edit Job Tasks & Parts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-8">
            {/* Job Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Job Number</label>
                  <p className="text-lg font-semibold">{job.jobNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Plate Number</label>
                  <p className="text-lg">{job.plateNumber}</p>
                </div>
              </div>
            </div>

            {/* Job Tasks Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Job Tasks</h3>
                <button
                  onClick={addTask}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiPlus size={16} />
                  Add Task
                </button>
              </div>
              
              <div className="space-y-3">
                {jobList.map((task, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={task.description}
                        onChange={(e) => updateTask(index, 'description', e.target.value)}
                        placeholder="Enter task description..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={task.status}
                        onChange={(e) => updateTask(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Unfinished">Unfinished</option>
                        <option value="Finished">Finished</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeTask(index)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              {jobList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No tasks added yet. Click "Add Task" to get started.</p>
                </div>
              )}
            </div>

            {/* Parts Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Parts Required</h3>
                <button
                  onClick={addPart}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FiPlus size={16} />
                  Add Part
                </button>
              </div>
              
              <div className="space-y-3">
                {parts.map((part, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updatePart(index, 'name', e.target.value)}
                        placeholder="Enter part name..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={part.availability}
                        onChange={(e) => updatePart(index, 'availability', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removePart(index)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              {parts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No parts added yet. Click "Add Part" to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updating || !isValid}
              className="px-6 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
