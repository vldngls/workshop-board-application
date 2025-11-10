"use client"

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiAlertCircle } from 'react-icons/fi'
import { BugReport } from '@/types/bugReport'
import RoleGuard from '@/components/RoleGuard'
import ConfirmDialog from '@/components/ConfirmDialog'
import BugReportDetailModal from '@/components/BugReportDetailModal'
import { useBugReports, useMaintenanceSettings, useSystemStats, useUpdateBugReport, useInfiniteSystemLogs } from '@/hooks/useMaintenance'
import { useQueryClient } from '@tanstack/react-query'

interface SystemStats {
  totalUsers: number
  totalJobOrders: number
  totalAppointments: number
  totalBugReports: number
  openBugReports: number
  resolvedBugReports: number
  systemUptime: string
  lastBackup: string
}

interface ApiKeyStatus {
  isSet: boolean
  isValid: boolean
  lastValidated: string | null
}

interface MaintenanceSettings {
  isUnderMaintenance: boolean
  maintenanceMessage: string
  apiKey?: string | null // API key (masked when returned from server)
  apiKeyStatus?: ApiKeyStatus // API key validation status
}

export default function MaintenancePage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>({
    isUnderMaintenance: false,
    maintenanceMessage: '',
    apiKey: null,
    apiKeyStatus: {
      isSet: false,
      isValid: false,
      lastValidated: null
    }
  })
  const [apiKeyInput, setApiKeyInput] = useState<string>('') // Separate state for API key input (for editing)
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'bug-reports' | 'settings' | 'logs'>('overview')
  const [selectedBugReport, setSelectedBugReport] = useState<BugReport | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const queryClient = useQueryClient()

  // Queries - only fetch bug reports when on the bug-reports tab
  const bugReportsQuery = useBugReports(activeTab === 'bug-reports')
  const statsQuery = useSystemStats()
  const settingsQuery = useMaintenanceSettings()

  // Handle bug reports query errors silently (user might not have permission)
  useEffect(() => {
    if (bugReportsQuery.error) {
      // Only log unexpected errors (not permission errors)
      const errorMessage = bugReportsQuery.error.message || ''
      if (!errorMessage.includes('401') && !errorMessage.includes('403') && !errorMessage.includes('500')) {
        console.error('Bug reports query error:', bugReportsQuery.error)
      }
    }
  }, [bugReportsQuery.error])
  // Logs filters and infinite scroll
  const [logLevel, setLogLevel] = useState<string>('')
  const [logEmail, setLogEmail] = useState<string>('')
  const [logPath, setLogPath] = useState<string>('')

  const logsInfinite = useInfiniteSystemLogs({
    level: logLevel || undefined,
    userEmail: logEmail || undefined,
    path: logPath || undefined,
    limit: 50,
    enabled: activeTab === 'logs'
  })
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false)
  const [showConfirmSaveSettings, setShowConfirmSaveSettings] = useState(false)
  const updateBugReport = useUpdateBugReport()

  // Local derived state
  const stats = statsQuery.data || null

  useEffect(() => {
    if (bugReportsQuery.data) {
      setBugReports(bugReportsQuery.data.bugReports || [])
      }
  }, [bugReportsQuery.data])

  useEffect(() => {
    if (settingsQuery.data) {
      setMaintenanceSettings({
        isUnderMaintenance: !!settingsQuery.data.isUnderMaintenance,
        maintenanceMessage: settingsQuery.data.maintenanceMessage || '',
        apiKey: settingsQuery.data.apiKey || null,
        apiKeyStatus: settingsQuery.data.apiKeyStatus || {
          isSet: false,
          isValid: false,
          lastValidated: null
        }
      })
      // Don't populate input with actual key if masked (shows ***)
      if (settingsQuery.data.apiKey && settingsQuery.data.apiKey !== '***') {
        setApiKeyInput(settingsQuery.data.apiKey)
      } else {
        setApiKeyInput('') // Clear input if key is masked or not set
      }
    }
  }, [settingsQuery.data])
  
  // Function to manually refresh API key status
  const refreshApiKeyStatus = async () => {
    setIsValidatingApiKey(true)
    try {
      await settingsQuery.refetch()
      toast.success('API key status updated')
    } catch {
      toast.error('Failed to validate API key')
    } finally {
      setIsValidatingApiKey(false)
    }
  }

  // Logs are streamed via `logsInfinite`; no local copy needed

  const logsLoading = logsInfinite.isFetching || logsInfinite.isFetchingNextPage

  const updateBugReportStatus = async (id: string, status: string, resolution?: string) => {
    await updateBugReport.mutateAsync({ id, updates: { status, resolution } })
  }

  const handleBugReportUpdate = async (id: string, updates: any) => {
    await updateBugReport.mutateAsync({ id, updates })
        if (selectedBugReport && selectedBugReport._id === id) {
          setSelectedBugReport(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const openBugReportDetail = (bugReport: BugReport) => {
    setSelectedBugReport(bugReport)
    setShowDetailModal(true)
  }

  const updateMaintenanceSettings = async () => {
    const payload: any = {
      isUnderMaintenance: maintenanceSettings.isUnderMaintenance,
      maintenanceMessage: maintenanceSettings.maintenanceMessage
    }
    
    // Only include API key if it was entered (to update it)
    // If empty, don't send it (keeps existing key)
    if (apiKeyInput.trim()) {
      payload.apiKey = apiKeyInput.trim()
    }
    
    const response = await settingsQuery.updateSettings.mutateAsync(payload)
    
    // Update local state with API key status from response
    if (response.settings?.apiKeyStatus) {
      setMaintenanceSettings(prev => ({
        ...prev,
        apiKeyStatus: response.settings.apiKeyStatus
      }))
    }
    
    // Show success message with API key status
    if (payload.apiKey) {
      const status = response.settings?.apiKeyStatus
      if (status?.isValid) {
        toast.success('Maintenance settings updated successfully. API key is valid!')
      } else {
        toast.error('Maintenance settings updated, but API key is invalid. System will be in maintenance mode.')
      }
    } else {
      toast.success('Maintenance settings updated successfully')
    }
    
    // Clear input after save (will be masked on next fetch)
    setApiKeyInput('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (bugReportsQuery.isLoading || statsQuery.isLoading || settingsQuery.isLoading) {
    return (
      <RoleGuard allowedRoles={['superadmin']} fallbackPath="/admin-login">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading maintenance dashboard...</p>
          </div>
        </div>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['superadmin']} fallbackPath="/admin-login">
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Dashboard</h1>
            <p className="text-gray-600">System administration and maintenance tools</p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'bug-reports', label: 'Bug Reports' },
                { id: 'settings', label: 'Settings' },
                { id: 'logs', label: 'System Logs' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="floating-card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Users</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats?.totalUsers || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="floating-card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Job Orders</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats?.totalJobOrders || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="floating-card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Appointments</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats?.totalAppointments || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="floating-card p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Bug Reports</p>
                      <p className="text-2xl font-semibold text-gray-900">{stats?.totalBugReports || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="floating-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">99.9%</div>
                    <div className="text-sm text-gray-500">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{stats?.openBugReports || 0}</div>
                    <div className="text-sm text-gray-500">Open Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">{stats?.resolvedBugReports || 0}</div>
                    <div className="text-sm text-gray-500">Resolved Issues</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bug Reports Tab */}
          {activeTab === 'bug-reports' && (
            <div className="floating-card">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Bug Reports & Suggestions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bugReports.map((report) => (
                      <tr key={report._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{report.subject}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{report.description}</div>
                          {report.imageData && (
                            <div className="flex items-center mt-1">
                              <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-blue-600">Has image</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{report.submittedByName}</div>
                          <div className="text-sm text-gray-500">{report.submittedByRole}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(report.priority)}`}>
                            {report.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openBugReportDetail(report)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              View Details
                            </button>
                            <select
                              value={report.status}
                              onChange={(e) => updateBugReportStatus(report._id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="open">Open</option>
                              <option value="in-progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="floating-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Maintenance Settings</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Site Under Maintenance</h4>
                    <p className="text-sm text-gray-500">Enable maintenance mode to restrict access</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintenanceSettings.isUnderMaintenance}
                      onChange={(e) => setMaintenanceSettings(prev => ({ ...prev, isUnderMaintenance: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div>
                  <label htmlFor="maintenanceMessage" className="block text-sm font-medium text-gray-700 mb-2">
                    Maintenance Message
                  </label>
                  <textarea
                    id="maintenanceMessage"
                    value={maintenanceSettings.maintenanceMessage}
                    onChange={(e) => setMaintenanceSettings(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter maintenance message to display to users..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                      API Key
                    </label>
                    {/* API Key Status Indicator */}
                    {maintenanceSettings.apiKeyStatus && (
                      <div className="flex items-center gap-2">
                        {maintenanceSettings.apiKeyStatus.isSet ? (
                          maintenanceSettings.apiKeyStatus.isValid ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 border border-green-200">
                              <FiCheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-medium text-green-700">Valid</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-200">
                              <FiXCircle className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-medium text-red-700">Invalid</span>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-50 border border-yellow-200">
                            <FiAlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-xs font-medium text-yellow-700">Not Set</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={refreshApiKeyStatus}
                          disabled={isValidatingApiKey}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Refresh API key status"
                        >
                          <FiRefreshCw className={`w-4 h-4 ${isValidatingApiKey ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="password"
                      id="apiKey"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceSettings.apiKeyStatus?.isSet && !maintenanceSettings.apiKeyStatus?.isValid
                          ? 'border-red-300 bg-red-50'
                          : maintenanceSettings.apiKeyStatus?.isValid
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300'
                      }`}
                      placeholder={maintenanceSettings.apiKey ? "API key is set (enter new key to update)" : "Enter API key from https://api-key-manager-one.vercel.app/"}
                    />
                    <div className="flex items-start gap-2">
                      {maintenanceSettings.apiKeyStatus?.isSet ? (
                        maintenanceSettings.apiKeyStatus.isValid ? (
                          <>
                            <FiCheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-green-700">
                              API key is valid and working. Enter a new key above to update it, or leave empty to keep the current key.
                              {maintenanceSettings.apiKeyStatus.lastValidated && (
                                <span className="block text-gray-500 mt-0.5">
                                  Last validated: {new Date(maintenanceSettings.apiKeyStatus.lastValidated).toLocaleString()}
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <>
                            <FiXCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700">
                              API key is invalid. The system is currently in maintenance mode. Please update with a valid key from https://api-key-manager-one.vercel.app/
                            </p>
                          </>
                        )
                      ) : (
                        <>
                          <FiAlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-yellow-700">
                            API key is required. Get your key from https://api-key-manager-one.vercel.app/. The system will be in maintenance mode until a valid key is set.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowConfirmSaveSettings(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={settingsQuery.updateSettings.isPending}
                >
                  {settingsQuery.updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="floating-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">System Logs</h3>
                <div className="flex gap-2">
                  <select
                    value={logLevel}
                    onChange={(e) => { setLogLevel(e.target.value) }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All Levels</option>
                    <option value="info">INFO</option>
                    <option value="audit">AUDIT</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                  </select>
                  <input
                    value={logEmail}
                    onChange={(e) => { setLogEmail(e.target.value) }}
                    placeholder="User email"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    value={logPath}
                    onChange={(e) => { setLogPath(e.target.value) }}
                    placeholder="Path"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    className="btn-destructive px-3 py-2 rounded-md text-sm"
                    onClick={() => setShowClearLogsConfirm(true)}
                    disabled={logsInfinite.isFetching || logsInfinite.isFetchingNextPage}
                  >
                    Delete All
                  </button>
                </div>
              </div>
              <div
                className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-y-auto overflow-x-auto"
                style={{ maxHeight: 420 }}
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48 && logsInfinite.hasNextPage && !logsInfinite.isFetchingNextPage) {
                    logsInfinite.fetchNextPage()
                  }
                }}
              >
                {logsInfinite.isLoading ? (
                  <div className="text-gray-400">Loading logs...</div>
                ) : (
                  <div className="space-y-1">
                    {(logsInfinite.data?.pages || []).flatMap((p: any) => p.items || []).map((log: any) => (
                      <div key={log._id}>
                        [{new Date(log.createdAt).toLocaleString()}] {(log.level || '').toUpperCase()}: {log.message}
                        {log.userEmail ? ` - ${log.userEmail}` : ''}
                        {log.path ? ` (${log.method} ${log.path} ${log.status})` : ''}
                      </div>
                    ))}
                    {logsInfinite.isFetchingNextPage && (
                      <div className="text-gray-400">Loading more...</div>
                    )}
                    {!logsInfinite.hasNextPage && ((logsInfinite.data?.pages?.[0] as any)?.items?.length ? (
                      <div className="text-gray-500 text-xs mt-2">End of logs</div>
                    ) : (
                      <div className="text-gray-400">No logs found</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clear Logs Confirmation */}
          <ConfirmDialog
            isOpen={showClearLogsConfirm}
            title="Delete System Logs"
            message="Are you sure you want to permanently delete system logs? This cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            confirmVariant="danger"
            onConfirm={async () => {
              try {
                const url = new URL('/api/system-logs', window.location.origin)
                if (logLevel) url.searchParams.set('level', logLevel)
                if (logEmail) url.searchParams.set('userEmail', logEmail)
                if (logPath) url.searchParams.set('path', logPath)
                const res = await fetch(url.toString().replace(window.location.origin, ''), {
                  method: 'DELETE',
                  credentials: 'include'
                })
                if (!res.ok) throw new Error('Failed to delete logs')
                setShowClearLogsConfirm(false)
                await logsInfinite.refetch()
                toast.success('Logs deleted')
              } catch (e) {
                setShowClearLogsConfirm(false)
                toast.error('Failed to delete logs')
              }
            }}
            onCancel={() => setShowClearLogsConfirm(false)}
          />

          {/* Save Settings Confirmation */}
          <ConfirmDialog
            isOpen={showConfirmSaveSettings}
            title="Save Maintenance Settings"
            message="Apply these maintenance settings now? This will take effect immediately."
            confirmLabel="Save"
            cancelLabel="Cancel"
            confirmVariant="primary"
            onConfirm={async () => {
              setShowConfirmSaveSettings(false)
              await updateMaintenanceSettings()
            }}
            onCancel={() => setShowConfirmSaveSettings(false)}
          />
        </div>

        {/* Bug Report Detail Modal */}
        {selectedBugReport && (
          <BugReportDetailModal
            bugReport={selectedBugReport}
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedBugReport(null)
            }}
            onUpdate={handleBugReportUpdate}
          />
        )}
      </div>
    </RoleGuard>
  )
}
