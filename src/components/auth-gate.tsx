"use client"

import { useSession } from "next-auth/react"
import { useFirebaseAuth } from "@/components/firebase-auth-provider"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const { ready: firebaseReady, authenticated: firebaseAuthenticated, error: firebaseError } =
    useFirebaseAuth()

  if (status === "loading" || !firebaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-400">로딩 중...</div>
      </div>
    )
  }

  if (status === "authenticated" && !firebaseAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="text-center text-zinc-500 max-w-md">
          <p className="mb-2 font-medium">데이터베이스 연결에 실패했습니다.</p>
          <p className="text-sm">{firebaseError || "잠시 후 다시 시도해주세요."}</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    return null
  }

  return <>{children}</>
}
