export default function AdminAccountManagementPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Account Management</h2>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600">Administrators will include Name, login details, password.</div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600">Technicians will include Name, login details, picture, password.</div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600">Job Controllers will include Name, login details, password.</div>
      </div>
    </div>
  )
}


