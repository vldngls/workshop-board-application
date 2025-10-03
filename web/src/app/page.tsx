import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-3 text-2xl font-semibold">Workshop Board</h1>
        <p className="mb-6 text-neutral-600">Proceed to the login page to continue.</p>
        <Link href="/login" className="btn btn-primary">Go to Login</Link>
      </div>
    </main>
  )
}
