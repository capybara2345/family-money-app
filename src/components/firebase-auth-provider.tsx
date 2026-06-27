"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { signInWithCustomToken, signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

type FirebaseAuthState = {
  ready: boolean
  authenticated: boolean
  error: string | null
}

const FirebaseAuthContext = createContext<FirebaseAuthState>({
  ready: false,
  authenticated: false,
  error: null,
})

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext)
}

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user?.id) {
      setAuthenticated(false)
      setError(null)
      signOut(auth).catch(() => {})
      setReady(true)
      return
    }

    let cancelled = false
    const userId = session.user.id

    async function syncFirebaseAuth() {
      try {
        setError(null)
        const res = await fetch("/api/firebase-token")
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to fetch Firebase token")
        }
        const { token } = await res.json()
        if (!token) throw new Error("Firebase token is empty")
        if (cancelled) return

        const credential = await signInWithCustomToken(auth, token)
        if (cancelled) return

        const isMatch = credential.user.uid === userId
        setAuthenticated(isMatch)
        if (!isMatch) {
          setError("Firebase 계정 연동에 실패했습니다.")
        }
        setReady(true)
      } catch (err) {
        console.error("Firebase auth sync failed:", err)
        if (cancelled) return
        const code = (err as { code?: string })?.code
        if (code === "auth/configuration-not-found") {
          setError(
            "Firebase Authentication이 활성화되지 않았습니다. Firebase Console → Authentication → 시작하기를 눌러 활성화해주세요."
          )
        } else {
          setError("Firebase 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.")
        }
        setAuthenticated(false)
        setReady(true)
      }
    }

    if (auth.currentUser?.uid === userId) {
      setAuthenticated(true)
      setError(null)
      setReady(true)
      return
    }

    setReady(false)
    setAuthenticated(false)
    syncFirebaseAuth()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id, status])

  return (
    <FirebaseAuthContext.Provider value={{ ready, authenticated, error }}>
      {children}
    </FirebaseAuthContext.Provider>
  )
}
