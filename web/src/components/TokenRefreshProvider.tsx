"use client"

import { useTokenRefresh } from "@/hooks/useTokenRefresh"
import type { ReactNode } from "react"

/**
 * Provider component that handles automatic token refresh
 * Wrap authenticated routes with this component
 */
export default function TokenRefreshProvider({ children }: { children: ReactNode }) {
  useTokenRefresh()
  return <>{children}</>
}

