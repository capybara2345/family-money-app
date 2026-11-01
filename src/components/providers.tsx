"use client"

import { SessionProvider } from "next-auth/react"
import { FirebaseAuthProvider } from "@/components/firebase-auth-provider"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
