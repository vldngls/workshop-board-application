"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Role } from "@/types/auth"

type User = {
  _id: string
  name: string
  email: string
  role: Role
  pictureUrl?: string | null
}

export default function AccountManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Account Management</h2>
        <CreateUserForm apiBase={apiBase} onCreated={fetchUsers} />
      </div>

      {loading ? <div className="text-sm text-neutral-600">Loading users...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role.replace("-", " ")}</td>
                  <td className="px-4 py-2">
                    <EditUserForm apiBase={apiBase} user={u} onUpdated={fetchUsers} />
                    <DeleteUserButton apiBase={apiBase} id={u._id} onDeleted={fetchUsers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function CreateUserForm({ apiBase, onCreated }: { apiBase: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("technician")
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
        body: JSON.stringify({ name, email, password, role }),
      })
      if (!res.ok) throw new Error("Failed to create user")
      setOpen(false)
      setName("")
      setEmail("")
      setPassword("")
      setRole("technician")
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creating user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>New User</button>
      {open ? (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-medium">Create User</h3>
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
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input className="w-full rounded-md border border-neutral-300 px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select className="w-full rounded-md border border-neutral-300 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="administrator">Administrator</option>
                <option value="job-controller">Job Controller</option>
                <option value="technician">Technician</option>
              </select>
            </div>
            {error ? <div className="col-span-full text-sm text-red-600">{error}</div> : null}
            <div className="col-span-full flex gap-2">
              <button disabled={submitting} type="submit" className="btn btn-primary">Create</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
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
