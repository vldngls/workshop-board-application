"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Role, TechnicianLevel, User } from "@/types/auth"
import RoleGuard from "@/components/RoleGuard"
import BreakTimeManager from "@/components/BreakTimeManager"

export default function AccountManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'technicians' | 'service-advisors'>('all')
  const [showBreakTimeManager, setShowBreakTimeManager] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<User | null>(null)

  const apiBase = useMemo(() => "/api/users", [])

  const fetchUsers = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiBase)
      if (!res.ok) throw new Error("Failed to load users")
      const data: { users: User[] } = await res.json()
      setUsers(data.users)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error loading users")
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const technicians = users.filter(user => user.role === 'technician')
  const serviceAdvisors = users.filter(user => user.role === 'service-advisor')
  const otherUsers = users.filter(user => user.role !== 'technician' && user.role !== 'service-advisor')

  return (
    <RoleGuard allowedRoles={['administrator']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
            <div className="text-sm text-gray-600">
              Manage users and technician levels
            </div>
          </div>
          <CreateUserForm apiBase={apiBase} onCreated={fetchUsers} />
        </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('technicians')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'technicians'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Technicians ({technicians.length})
          </button>
          <button
            onClick={() => setActiveTab('service-advisors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'service-advisors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Service Advisors ({serviceAdvisors.length})
          </button>
        </nav>
      </div>

      {/* Loading and Error States */}
      {loading && <div className="text-center py-8 text-gray-600">Loading users...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      {/* Content */}
      {!loading && !error && (
        <>
          {activeTab === 'all' ? (
            <div className="grid gap-6">
              {/* Technicians Section */}
              <div className="floating-card">
                <div className="px-6 py-4 border-b border-white/30">
                  <h2 className="text-lg font-bold text-gray-900">Technicians</h2>
                  <p className="text-sm text-gray-600 font-medium">Manage technician levels and assignments</p>
                </div>
                <TechnicianTable 
                  technicians={technicians} 
                  apiBase={apiBase} 
                  onUpdated={fetchUsers}
                  onManageBreakTimes={(technician) => {
                    // Find the most current technician data from the users list
                    const currentTechnician = users.find(u => u._id === technician._id) || technician
                    setSelectedTechnician(currentTechnician)
                    setShowBreakTimeManager(true)
                  }}
                />
              </div>

              {/* Service Advisors Section */}
              {serviceAdvisors.length > 0 && (
                <div className="floating-card">
                  <div className="px-6 py-4 border-b border-white/30">
                    <h2 className="text-lg font-bold text-gray-900">Service Advisors</h2>
                    <p className="text-sm text-gray-600 font-medium">Customer service and appointment management</p>
                  </div>
                  <UserTable users={serviceAdvisors} apiBase={apiBase} onUpdated={fetchUsers} />
                </div>
              )}

              {/* Other Users Section */}
              {otherUsers.length > 0 && (
                <div className="floating-card">
                  <div className="px-6 py-4 border-b border-white/30">
                    <h2 className="text-lg font-bold text-gray-900">Other Users</h2>
                    <p className="text-sm text-gray-600 font-medium">System administrators and job controllers</p>
                  </div>
                  <UserTable users={otherUsers} apiBase={apiBase} onUpdated={fetchUsers} />
                </div>
              )}
            </div>
          ) : activeTab === 'technicians' ? (
            <div className="floating-card">
              <div className="px-6 py-4 border-b border-white/30">
                <h2 className="text-lg font-bold text-gray-900">Technician Management</h2>
                <p className="text-sm text-gray-600 font-medium">View and manage all technicians with their levels</p>
              </div>
              <TechnicianTable 
                technicians={technicians} 
                apiBase={apiBase} 
                onUpdated={fetchUsers}
                onManageBreakTimes={(technician) => {
                  // Find the most current technician data from the users list
                  const currentTechnician = users.find(u => u._id === technician._id) || technician
                  setSelectedTechnician(currentTechnician)
                  setShowBreakTimeManager(true)
                }}
              />
            </div>
          ) : (
            <div className="floating-card">
              <div className="px-6 py-4 border-b border-white/30">
                <h2 className="text-lg font-bold text-gray-900">Service Advisor Management</h2>
                <p className="text-sm text-gray-600 font-medium">View and manage all service advisors</p>
              </div>
              <UserTable users={serviceAdvisors} apiBase={apiBase} onUpdated={fetchUsers} />
            </div>
          )}
        </>
      )}

      {/* Break Time Manager Modal */}
      {showBreakTimeManager && selectedTechnician && (
        <BreakTimeManager
          technician={selectedTechnician}
          onUpdate={async (breakTimes) => {
            // Update the user in the local state
            setUsers(prev => prev.map(user => 
              user._id === selectedTechnician._id 
                ? { ...user, breakTimes }
                : user
            ))
            // Refresh the users list to ensure we have the latest data
            await fetchUsers()
            setShowBreakTimeManager(false)
            setSelectedTechnician(null)
          }}
          onClose={() => {
            setShowBreakTimeManager(false)
            setSelectedTechnician(null)
          }}
        />
      )}
      </div>
    </RoleGuard>
  )
}

function CreateUserForm({ apiBase, onCreated }: { apiBase: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("technician")
  const [level, setLevel] = useState<TechnicianLevel>("untrained")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, phone, password, role, level: role === 'technician' ? level : undefined }),
      })
      if (!res.ok) throw new Error("Failed to create user")
      setOpen(false)
      setName("")
      setUsername("")
      setEmail("")
      setPhone("")
      setPassword("")
      setRole("technician")
      setLevel("untrained")
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creating user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
      <div>
        <button 
          onClick={() => setOpen(true)}
          className="bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue text-white px-6 py-2.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          + New User
        </button>
      {open ? (
        <div className="modal-backdrop">
          <div className="floating-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-red-700 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      type="tel" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={role} 
                      onChange={(e) => setRole(e.target.value as Role)}
                    >
                      <option value="administrator">Administrator</option>
                      <option value="job-controller">Job Controller</option>
                      <option value="technician">Technician</option>
                      <option value="service-advisor">Service Advisor</option>
                    </select>
                  </div>
                </div>

                {role === 'technician' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Technician Level *</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      value={level} 
                      onChange={(e) => setLevel(e.target.value as TechnicianLevel)}
                    >
                      <option value="untrained">Untrained</option>
                      <option value="level-0">Level 0</option>
                      <option value="level-1">Level 1</option>
                      <option value="level-2">Level 2</option>
                      <option value="level-3">Level 3</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-white/30">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-6 py-2.5 text-gray-700 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EditUserForm({ apiBase, user, onUpdated }: { apiBase: string; user: User; onUpdated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>(user.role)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password: password || undefined }),
      })
      if (!res.ok) throw new Error("Failed to update user")
      setOpen(false)
      onUpdated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error updating user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button className="text-[color:var(--color-ford-blue)]" onClick={() => setOpen(true)}>Edit</button>
      {open ? (
        <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-medium">Edit User</h3>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input className="w-full rounded-md border border-neutral-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input className="w-full rounded-md border border-neutral-300 px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password (leave blank to keep)</label>
              <input className="w-full rounded-md border border-neutral-300 px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select className="w-full rounded-md border border-neutral-300 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="administrator">Administrator</option>
                <option value="job-controller">Job Controller</option>
                <option value="technician">Technician</option>
                <option value="service-advisor">Service Advisor</option>
              </select>
            </div>
            {error ? <div className="col-span-full text-sm text-red-600">{error}</div> : null}
            <div className="col-span-full flex gap-2">
              <button disabled={submitting} type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </span>
  )
}

function DeleteUserButton({ apiBase, id, onDeleted }: { apiBase: string; id: string; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(): Promise<void> {
    if (!confirm("Delete this user?")) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete user")
      onDeleted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error deleting user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button className="text-red-600" onClick={remove} disabled={loading}>{loading ? "Deleting..." : "Delete"}</button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  )
}

// New Technician Table Component
function TechnicianTable({ technicians, apiBase, onUpdated, onManageBreakTimes }: { 
  technicians: User[]; 
  apiBase: string; 
  onUpdated: () => void;
  onManageBreakTimes: (technician: User) => void;
}) {
  if (technicians.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No technicians found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {technicians.map((technician) => (
            <tr key={technician._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {technician.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{technician.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{technician.email}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <LevelBadge level={technician.level || 'untrained'} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  onClick={() => onManageBreakTimes(technician)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Break Times
                </button>
                <EditTechnicianForm apiBase={apiBase} technician={technician} onUpdated={onUpdated} />
                <DeleteUserButton apiBase={apiBase} id={technician._id} onDeleted={onUpdated} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Regular User Table Component
function UserTable({ users, apiBase, onUpdated }: { users: User[]; apiBase: string; onUpdated: () => void }) {
  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No users found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.role.replace('-', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <EditUserForm apiBase={apiBase} user={user} onUpdated={onUpdated} />
                <DeleteUserButton apiBase={apiBase} id={user._id} onDeleted={onUpdated} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Level Badge Component
function LevelBadge({ level }: { level: TechnicianLevel }) {
  const colors = {
    'untrained': 'bg-yellow-100 text-yellow-800',
    'level-0': 'bg-blue-100 text-blue-800',
    'level-1': 'bg-green-100 text-green-800',
    'level-2': 'bg-purple-100 text-purple-800',
    'level-3': 'bg-red-100 text-red-800'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
      {level}
    </span>
  )
}

// Edit Technician Form Component
function EditTechnicianForm({ apiBase, technician, onUpdated }: { apiBase: string; technician: User; onUpdated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(technician.name)
  const [email, setEmail] = useState(technician.email)
  const [level, setLevel] = useState<TechnicianLevel>(technician.level || 'untrained')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/${technician._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, level }),
      })
      if (!res.ok) throw new Error("Failed to update technician")
      setOpen(false)
      onUpdated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error updating technician")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="text-blue-600 hover:text-blue-900 font-medium"
      >
        Edit
      </button>
      {open && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Edit Technician</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-red-700 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as TechnicianLevel)}
                  >
                    <option value="untrained">Untrained</option>
                    <option value="level-0">Level 0</option>
                    <option value="level-1">Level 1</option>
                    <option value="level-2">Level 2</option>
                    <option value="level-3">Level 3</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-white/30">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-6 py-2.5 text-gray-700 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
