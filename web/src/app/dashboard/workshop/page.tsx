import { cookies, headers } from 'next/headers'
import WorkshopPageClient from './WorkshopPageClient'
import { fetchWorkshopData, type WorkshopDataPayload } from '@/lib/workshopData'

type SearchParams = Record<string, string | string[] | undefined>

function parseParam(param: string | string[] | undefined) {
  if (!param) return undefined
  return Array.isArray(param) ? param[0] : param
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const resolvedParams = await searchParams
  const highlightId = parseParam(resolvedParams?.highlight)
  const dateParam = parseParam(resolvedParams?.date)
  
  const dateForFetch =
    dateParam && !Number.isNaN(new Date(dateParam).getTime())
      ? dateParam
      : new Date().toISOString().split('T')[0]

  let initialData: WorkshopDataPayload | undefined

  try {
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
    const cookieHeaderValue = cookieStore.toString()
    const cookieHeaders = cookieHeaderValue ? { cookie: cookieHeaderValue } : undefined
    initialData = await fetchWorkshopData(dateForFetch, cookieHeaders, origin)
  } catch (error) {
    console.warn('[workshop] Failed to preload timetable data:', error)
    initialData = undefined
  }

  return (
    <WorkshopPageClient
      highlightId={highlightId}
      dateParam={dateParam}
      initialData={initialData}
      />
  )
}
