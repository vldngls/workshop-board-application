import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardPageClient from './DashboardPageClient'
import { fetchDashboardOverview } from '@/server/dashboard'
import { getSession } from '@/server/auth/session'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role === 'technician') {
    redirect('/dashboard/technician')
  }

  const headerStore = await headers()
  const protocol =
    headerStore.get('x-forwarded-proto') ||
    headerStore.get('x-forwarded-protocol') ||
    'http'
  const host =
    headerStore.get('x-forwarded-host') ||
    headerStore.get('host') ||
    'localhost:3000'
  const origin = `${protocol}://${host}`

  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()
  const cookieHeaders = cookieHeader ? { cookie: cookieHeader } : undefined
  const initialData = await fetchDashboardOverview(origin, cookieHeaders)

  return (
    <DashboardPageClient
      role={session.role}
      initialData={initialData}
    />
  )
}

 
