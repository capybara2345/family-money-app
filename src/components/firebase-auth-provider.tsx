"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

type FirebaseAuthState = {
  ready: boolean
  authenticated: boolean
}

const FirebaseAuthContext = createContext<FirebaseAuthState>({
  ready: false,
  authenticated: false,
})

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext)
}

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user?.id) {
      setAuthenticated(false)
      signOut(auth).catch(() => {})
      setReady(true)
      return
    }

    let cancelled = false

    async function syncFirebaseAuth() {
      try {
        const res = await fetch("/api/firebase-token")
        if (!res.ok) throw new Error("Failed to fetch Firebase token")
        const { token } = await res.json()
        if (cancelled) return
        await signInWithCustomToken(auth, token)
      } catch (error) {
        console.error("Firebase auth sync failed:", error)
        if (!cancelled) {
          setAuthenticated(false)
          setReady(true)
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return
      const isMatch = user?.uid === session.user.id
      setAuthenticated(isMatch)
      setReady(true)
    })

    if (auth.currentUser?.uid !== session.user.id) {
      setReady(false)
      syncFirebaseAuth()
    } else {
      setAuthenticated(true)
      setReady(true)
    }

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [session?.user?.id, status])

  return (
    <FirebaseAuthContext.Provider value={{ ready, authenticated }}>
      {children}
    </FirebaseAuthContext.Provider>
  )
}
