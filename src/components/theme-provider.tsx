"use client"

import { useLayoutEffect } from "react"
import { THEME_STORAGE_KEY, applyTheme, readTheme } from "@/lib/theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    applyTheme(readTheme())
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      let stored: string | null = null
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY)
      } catch {
        stored = null
      }
      if (stored === "light" || stored === "dark") return
      applyTheme(media.matches ? "dark" : "light")
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  return children
}
