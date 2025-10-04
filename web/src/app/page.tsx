"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    router.prefetch("/login")
    const t1 = setTimeout(() => setFadeOut(true), 1600)
    const t2 = setTimeout(() => router.push("/login"), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [router])

  return (
    <main className={`grid min-h-dvh place-items-center bg-neutral-50 p-6 transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
      <div className="flex flex-col items-center">
        <div className="mb-6 animate-pulse-slow">
          <Image src="/globe.svg" alt="Workshop Board" width={80} height={80} priority />
        </div>
        <h1 className="animate-fade-in text-2xl font-semibold text-[color:var(--color-ford-blue)]">Welcome to the Workshop Board</h1>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseSlow { 0%,100% { opacity: .7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        .animate-fade-in { animation: fadeIn 800ms ease-out both; }
        .animate-pulse-slow { animation: pulseSlow 1600ms ease-in-out infinite; }
      `}</style>
    </main>
  )
}
