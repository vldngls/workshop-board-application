"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        // Check if user has a valid token by making a request to a protected endpoint
        const response = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include', // Include cookies
        })

        if (response.ok) {
          // User is authenticated, redirect to workshop dashboard
          router.prefetch("/dashboard/workshop")
          const t1 = setTimeout(() => setFadeOut(true), 1600)
          const t2 = setTimeout(() => router.push("/dashboard/workshop"), 2000)
          return () => { clearTimeout(t1); clearTimeout(t2) }
        } else {
          // User is not authenticated, redirect to login
          router.prefetch("/login")
          const t1 = setTimeout(() => setFadeOut(true), 1600)
          const t2 = setTimeout(() => router.push("/login"), 2000)
          return () => { clearTimeout(t1); clearTimeout(t2) }
        }
      } catch (error) {
        // Error occurred, redirect to login as fallback
        console.error('Auth check failed:', error)
        router.prefetch("/login")
        const t1 = setTimeout(() => setFadeOut(true), 1600)
        const t2 = setTimeout(() => router.push("/login"), 2000)
        return () => { clearTimeout(t1); clearTimeout(t2) }
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuthAndRedirect()
  }, [router])

  return (
    <main className={`grid min-h-dvh place-items-center bg-neutral-50 p-6 transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
      <div className="flex flex-col items-center">
        <div className="mb-6 animate-pulse-slow">
          <Image src="/globe.svg" alt="Workshop Board" width={80} height={80} priority />
        </div>
        <h1 className="animate-fade-in text-2xl font-semibold text-ford-blue">
          {isCheckingAuth ? "Checking authentication..." : "Welcome to the Workshop Board"}
        </h1>
      </div>
    </main>
  )
}
