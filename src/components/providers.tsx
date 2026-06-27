"use client"

import { SessionProvider } from "next-auth/react"
import { FirebaseAuthProvider } from "@/components/firebase-auth-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
    </SessionProvider>
  )
}
